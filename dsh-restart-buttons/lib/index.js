/**
 * dsh-restart-buttons — host half.
 *
 * Serves the two routes the browser half talks to:
 *
 *   GET  /dsh-restart-buttons/status   read-only capability probe
 *   POST /dsh-restart-buttons/restart  schedule a full DSH Desktop relaunch
 *
 * The restart route answers 200 BEFORE any process is touched: the HTTP reply
 * is the schedule acknowledgement, not the restart itself. The actual work runs
 * in a detached worker spawned by `lib/restart.mjs`, because the host that
 * would perform the restart is the very process being restarted.
 * @module dsh-restart-buttons
 */
import { isLoopbackRequest, isTrustedRequest } from './guard.mjs'
import { appendLine, pluginLogPath } from './paths.mjs'
import { scheduleRestart } from './restart.mjs'

/** Plugin name, matched by the profile patch row. */
export const name = 'dsh-restart-buttons'

/** Plugin version, reported by the status probe. */
export const version = '1.0.0'

/** The web server is the only service this host half needs. */
export const inject = ['webServer']

/** Route prefix shared by both endpoints. */
const PREFIX = '/dsh-restart-buttons'

/** Response headers for every JSON answer: never cache a capability answer. */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
}

/**
 * Write one JSON response.
 * @param res - the HTTP response.
 * @param status - HTTP status code.
 * @param body - JSON-serializable payload.
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { ...JSON_HEADERS, 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/** Whether this process runs inside the Electron desktop shell. */
function isElectronHost() {
  return process.env.ELECTRON_RUN_AS_NODE === '1'
}

/**
 * Mount the two routes on the host web server.
 * @param ctx - host context exposing `webServer`.
 * @param config - reserved for future options; unused today.
 */
export function apply(ctx, config) {
  void config
  const port = ctx.webServer?.port ?? 0
  const log = (text) => appendLine(pluginLogPath(), text)
  const stamp = () => new Date().toISOString()

  log(`${stamp()} activation pid=${process.pid} platform=${process.platform} port=${port} electron=${String(isElectronHost())} execPath=${process.execPath} ppid=${process.ppid}`)

  const disposers = []

  try {
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/status`,
      handler: (req, res) => {
        try {
          // Read-only, but still loopback-fenced: the answer names the app
          // executable path and the parent pid, which is local reconnaissance.
          if (!isLoopbackRequest(req)) {
            sendJson(res, 403, { ok: false, error: 'forbidden' })
            return
          }
          sendJson(res, 200, {
            ok: true,
            plugin: name,
            version,
            port,
            electron: isElectronHost(),
            appExecutable: process.execPath,
            parentPid: process.ppid,
            restartEnabled: isElectronHost() && process.platform === 'win32',
          })
        } catch (error) {
          log(`${stamp()} status handler failed: ${String(error)}`)
          sendJson(res, 500, { ok: false, error: 'internal' })
        }
      },
    }))
  } catch (error) {
    log(`${stamp()} status route registration failed: ${String(error)}`)
    throw error
  }

  try {
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/restart`,
      handler: async (req, res) => {
        try {
          if (!isTrustedRequest(req)) {
            sendJson(res, 403, { ok: false, error: 'forbidden' })
            return
          }
          if (!isElectronHost()) {
            // A plain `dsh web` host must never be killable through this route.
            sendJson(res, 409, { ok: false, error: 'not-desktop' })
            return
          }
          if (process.platform !== 'win32') {
            sendJson(res, 409, { ok: false, error: 'unsupported-platform' })
            return
          }
          const result = await scheduleRestart({ port })
          log(`${stamp()} restart requested ok=${String(result.ok)} id=${result.id} log=${result.logPath}`)
          if (!result.ok) {
            sendJson(res, 500, { ok: false, error: 'schedule-failed', id: result.id, logPath: result.logPath })
            return
          }
          sendJson(res, 200, {
            ok: true,
            id: result.id,
            logPath: result.logPath,
            delaySeconds: result.delaySeconds,
          })
        } catch (error) {
          log(`${stamp()} restart handler failed: ${String(error)}`)
          sendJson(res, 500, { ok: false, error: 'internal' })
        }
      },
    }))
  } catch (error) {
    log(`${stamp()} restart route registration failed: ${String(error)}`)
    for (const dispose of disposers.splice(0)) dispose()
    throw error
  }

  log(`${stamp()} routes registered count=${disposers.length}`)

  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose()
    log(`${stamp()} routes released`)
  }, 'restart-buttons: routes')
}
