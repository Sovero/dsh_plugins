/**
 * Loopback trust fence for the restart routes.
 *
 * The restart route can terminate the desktop application, so it is fenced on
 * four independent markers: the TCP peer address, the `Host` header, the
 * browser's same-origin marker `Sec-Fetch-Site`, and — when present — the
 * `Origin` header. The socket address is authoritative; `X-Forwarded-For` is
 * never trusted, because a proxy header is attacker-controlled.
 *
 * Ported from the task-board plugin's loopback fence, which is the pattern
 * proven on this host.
 * @module dsh-restart-buttons/guard
 */

/** IPv4 127/8 predicate (four decimal octets, first == 127). */
export function isIPv4Loopback(v4) {
  const parts = String(v4).split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
export function isLoopbackAddress(address) {
  if (address === undefined || address === null) return false
  const normalized = String(address).toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice('::ffff:'.length))
  return isIPv4Loopback(normalized)
}

/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
export function isLoopbackHostname(hostname) {
  const value = String(hostname).toLowerCase()
  if (value === 'localhost' || value === '[::1]') return true
  return isIPv4Loopback(value)
}

/**
 * Request-level trust fence: a loopback socket address AND a loopback `Host`
 * header, plus the browser same-origin markers.
 * @param request - IncomingMessage-shaped object.
 * @returns whether the request comes from a trusted same-origin loopback page.
 */
export function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request?.socket?.remoteAddress)) return false
  const host = request?.headers?.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    // Exact host match: `localhost:19387` and `127.0.0.1:19387` are different
    // authorities even though both resolve to loopback.
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/**
 * The full fence for a state-changing request: loopback same-origin AND POST.
 *
 * A GET is refused even from a trusted page so a plain navigation or an
 * `<img src>` can never reach the restart handler.
 * @param request - IncomingMessage-shaped object.
 * @returns whether the request may perform a state-changing action.
 */
export function isTrustedRequest(request) {
  return isLoopbackRequest(request) && request?.method === 'POST'
}
