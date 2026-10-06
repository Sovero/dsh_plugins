/**
 * Host-route fence test for dsh-restart-buttons.
 *
 * Exercises lib/guard.mjs with hand-built IncomingMessage-shaped objects. The
 * fence is what stops a hostile page (or a plain `dsh web` host) from reaching
 * the restart handler, so every positive and negative case is asserted
 * explicitly.
 *
 * Every assertion prints PASS/FAIL; any failure exits non-zero.
 */
import { isIPv4Loopback, isLoopbackAddress, isLoopbackHostname, isLoopbackRequest, isTrustedRequest } from '../lib/guard.mjs'

let fails = 0

/** Print one assertion result and track failures. */
function check(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`)
  if (!ok) fails += 1
  return ok
}

/**
 * Build an IncomingMessage-shaped fake.
 *
 * `omitHost` removes the header entirely, which is different from passing
 * `host: undefined` — that would trigger the default parameter instead.
 */
function makeRequest({ remoteAddress = '127.0.0.1', host = '127.0.0.1:19387', method = 'POST', headers = {}, omitHost = false } = {}) {
  return {
    socket: { remoteAddress },
    method,
    headers: {
      ...(omitHost ? {} : { host }),
      ...headers,
    },
  }
}

console.log('=== UNIT: ADDRESS AND HOSTNAME PREDICATES ===')
check(isIPv4Loopback('127.0.0.1') === true, "isIPv4Loopback('127.0.0.1') === true")
check(isIPv4Loopback('127.255.255.254') === true, "isIPv4Loopback('127.255.255.254') === true")
check(isIPv4Loopback('10.0.0.2') === false, "isIPv4Loopback('10.0.0.2') === false")
check(isIPv4Loopback('127.0.0') === false, "isIPv4Loopback('127.0.0') === false (short form rejected)")
check(isIPv4Loopback('127.0.0.256') === false, "isIPv4Loopback('127.0.0.256') === false (octet > 255)")
check(isLoopbackAddress('::1') === true, "isLoopbackAddress('::1') === true")
check(isLoopbackAddress('::ffff:127.0.0.1') === true, "isLoopbackAddress('::ffff:127.0.0.1') === true")
check(isLoopbackAddress(undefined) === false, 'isLoopbackAddress(undefined) === false')
check(isLoopbackHostname('localhost') === true, "isLoopbackHostname('localhost') === true")
check(isLoopbackHostname('[::1]') === true, "isLoopbackHostname('[::1]') === true")
check(isLoopbackHostname('evil.example.com') === false, "isLoopbackHostname('evil.example.com') === false")

console.log('\n=== REQUEST FENCE: POSITIVE CASES ===')
check(
  isTrustedRequest(makeRequest()) === true,
  'loopback peer + loopback Host + no origin + POST -> trusted',
)
check(
  isTrustedRequest(makeRequest({ headers: { origin: 'http://127.0.0.1:19387' } })) === true,
  "loopback peer + matching Origin 'http://127.0.0.1:19387' -> trusted",
)
check(
  isTrustedRequest(makeRequest({ remoteAddress: '::1', host: 'localhost:19387' })) === true,
  "peer '::1' + Host 'localhost:19387' -> trusted",
)
check(
  isTrustedRequest(makeRequest({ remoteAddress: '::ffff:127.0.0.1' })) === true,
  "peer '::ffff:127.0.0.1' -> trusted",
)
check(
  isTrustedRequest(makeRequest({ host: 'localhost:19387' })) === true,
  "Host 'localhost:19387' -> trusted",
)

console.log('\n=== REQUEST FENCE: NEGATIVE CASES ===')
check(
  isTrustedRequest(makeRequest({ remoteAddress: '10.0.0.2' })) === false,
  "non-loopback peer '10.0.0.2' -> refused",
)
check(
  isTrustedRequest(makeRequest({ host: 'evil.example.com' })) === false,
  "loopback peer but Host 'evil.example.com' -> refused",
)
check(
  isTrustedRequest(makeRequest({ headers: { 'sec-fetch-site': 'cross-site' } })) === false,
  "sec-fetch-site: cross-site -> refused",
)
check(
  isTrustedRequest(makeRequest({ headers: { origin: 'http://evil.example.com' } })) === false,
  "Origin 'http://evil.example.com' with loopback Host -> refused",
)
check(
  isTrustedRequest(makeRequest({ host: '127.0.0.1:19387', headers: { origin: 'http://localhost:19387' } })) === false,
  "Origin 'http://localhost:19387' vs Host '127.0.0.1:19387' -> refused (hosts must match exactly)",
)
check(
  isTrustedRequest(makeRequest({ method: 'GET' })) === false,
  'GET method -> refused by the POST requirement',
)
check(
  isTrustedRequest(makeRequest({ omitHost: true })) === false,
  'missing Host header -> refused',
)
check(
  isTrustedRequest(makeRequest({ host: 'not a valid host' })) === false,
  'unparseable Host header -> refused',
)
check(
  isTrustedRequest(makeRequest({ headers: { origin: 'not-a-url' } })) === false,
  'unparseable Origin header -> refused',
)

console.log('\n=== READ-ONLY ROUTE FENCE (no POST requirement) ===')
check(
  isLoopbackRequest(makeRequest({ method: 'GET' })) === true,
  'GET from a loopback same-origin page is allowed for the read-only status route',
)
check(
  isLoopbackRequest(makeRequest({ method: 'GET', remoteAddress: '10.0.0.2' })) === false,
  'GET from a non-loopback peer is still refused for the status route',
)
check(
  isLoopbackRequest(makeRequest({ method: 'GET', host: 'evil.example.com' })) === false,
  'GET with a non-loopback Host is refused for the status route',
)

console.log(`\n${fails === 0 ? 'ALL ASSERTIONS PASSED' : `${fails} ASSERTION(S) FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
