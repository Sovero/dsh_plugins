/**
 * Windows restart mechanics for dsh-restart-buttons.
 *
 * The work is split in two because the process that would perform the restart
 * is the very process being restarted:
 *
 *   schedule mode  validates the options, writes the `scheduled` phase, spawns
 *                  a DETACHED worker, waits only for the spawn acknowledgement,
 *                  and returns immediately. It never waits for the app.
 *
 *   worker mode    runs in the detached child: sleeps the delay, verifies the
 *                  target, kills the Electron main process, waits for the GUI
 *                  port to be released, relaunches the executable, and waits
 *                  until the port answers again.
 *
 * Every phase is appended to a durable log, so the outcome is readable after
 * the application that wrote it is gone.
 * @module dsh-restart-buttons/restart
 */
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logDir, restartLogPath } from './paths.mjs'

/** Default grace period before the app goes down. */
const DEFAULT_DELAY_SECONDS = 45
/**
 * Production floor. The caller must be able to finish its report before the
 * restart lands, so a smaller delay is only honoured under the test hook.
 */
const MIN_DELAY_SECONDS = 30
/** Port of the GUI when the caller does not supply one. */
const DEFAULT_PORT = 19387
/** How long to wait for the GUI port to stop accepting connections. */
const PORT_FREE_TIMEOUT_MS = 60_000
/** How long to wait for the relaunched app to answer on the port. */
const READY_TIMEOUT_MS = 120_000
/** Delay between port probes. */
const PORT_POLL_INTERVAL_MS = 500
/** Extra settle time after the port frees, before relaunching. */
const SETTLE_MS = 1_000

/** Environment flag that switches the worker into a simulated, hermetic run. */
const TEST_MODE_ENV = 'DSH_RESTART_BUTTONS_TEST_MODE'

/** Whether this run must not touch real processes. */
function isSimulated() {
  return process.env[TEST_MODE_ENV] !== undefined
}

/** Sleep without keeping the event loop's timers alive longer than needed. */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Read `--name value` from argv. */
function flag(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

/** Whether a flag is present in argv. */
function hasFlag(name, argv = process.argv.slice(2)) {
  return argv.includes(name)
}

/**
 * Parse an integer option, rejecting NaN and out-of-range values.
 * @throws when the raw value is present but not a valid integer.
 */
function integerOption(name, raw, { minimum = 0, fallback }) {
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum) {
    throw new Error(`restart-buttons: ${name} must be an integer >= ${String(minimum)}, got ${JSON.stringify(raw)}`)
  }
  return value
}

/**
 * Durable, timestamped phase recorder. Every entry carries an ISO timestamp and
 * the writing pid, so a log that outlives its process is still attributable.
 * @param logPath - absolute log file path.
 */
function createRecorder(logPath) {
  mkdirSync(dirname(logPath), { recursive: true })
  return (phase, detail) => {
    const entry = { at: new Date().toISOString(), pid: process.pid, phase, ...(detail === undefined ? {} : { detail }) }
    appendFileSync(logPath, `${JSON.stringify(entry)}\n`)
  }
}

/** Build the schedule id: an ISO timestamp plus the scheduling pid. */
function makeId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
}

/**
 * Environment for the relaunched application.
 *
 * `ELECTRON_RUN_AS_NODE` must be REMOVED: the Electron executable is launched
 * by the shell with that flag set so it boots as a plain Node host. Inheriting
 * it here would start the app as a headless Node process instead of the GUI,
 * which looks like a silent failure to the user. `DSH_DESKTOP_NODE_EXECUTABLE`
 * is removed for the same reason — it belongs to the host's CLI plumbing, not
 * to a fresh GUI launch.
 * @returns a copy of the current environment with the host-only flags dropped.
 */
export function relaunchEnv() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.DSH_DESKTOP_NODE_EXECUTABLE
  return env
}

/**
 * Probe the GUI port by CONNECTING to it.
 *
 * Connecting is deliberate: binding would take the port the app needs and could
 * itself cause the EADDRINUSE failure this wait exists to prevent.
 * @param port - TCP port to probe.
 * @param timeoutMs - per-attempt timeout.
 * @returns whether something accepted the connection.
 */
export function probePort(port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    let settled = false
    const done = (result) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

/** Wait until the port stops accepting connections, or the bound expires. */
async function waitForPortFree(port, timeoutMs = PORT_FREE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (!(await probePort(port))) return true
    if (Date.now() >= deadline) return false
    await sleep(PORT_POLL_INTERVAL_MS)
  }
}

/** Wait until the port accepts a connection, or the bound expires. */
async function waitForPortReady(port, timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await probePort(port)) return true
    if (Date.now() >= deadline) return false
    await sleep(1_000)
  }
}

/** Whether a pid is alive, via the signal-0 probe. */
export function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Windows-only pid check through `tasklist`, which also proves the pid belongs
 * to a real process image rather than to a stale handle.
 * @returns whether `tasklist` reported a row for the pid.
 */
export function tasklistHasPid(pid) {
  const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0) return false
  const output = String(result.stdout ?? '').trim()
  return output !== '' && output.includes(String(pid))
}

/**
 * Spawn one process detached and resolve only on the spawn acknowledgement.
 * @returns whether the OS confirmed the child.
 */
function spawnDetached(executable, argv, options) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(executable, argv, { detached: true, stdio: 'ignore', windowsHide: true, ...options })
    } catch {
      resolve({ ok: false, child: undefined })
      return
    }
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      resolve({ ok, child })
    }
    child.once('spawn', () => finish(true))
    child.once('error', () => finish(false))
  })
}

/**
 * Schedule one full DSH Desktop relaunch.
 *
 * Returns as soon as the detached worker is confirmed spawned — never after the
 * restart itself, which would be unobservable from a process being restarted.
 * @param options - schedule options.
 * @param options.port - GUI port to wait on.
 * @param options.delaySeconds - grace period before the app goes down.
 * @param options.targetPid - process to terminate (defaults to our parent).
 * @param options.appExecutable - executable to relaunch (defaults to ours).
 * @param options.logPath - durable log path (defaults to the standard location).
 * @returns the schedule outcome with the id and log path.
 */
export async function scheduleRestart(options = {}) {
  const simulated = isSimulated()
  let delaySeconds
  try {
    delaySeconds = integerOption('--delay-seconds', options.delaySeconds, {
      minimum: 0,
      fallback: DEFAULT_DELAY_SECONDS,
    })
  } catch (error) {
    return { ok: false, id: undefined, logPath: undefined, error: String(error?.message ?? error) }
  }
  // Production floor: the caller must have time to report before the app dies.
  if (!simulated) delaySeconds = Math.max(delaySeconds, MIN_DELAY_SECONDS)

  const port = Number.isInteger(options.port) ? options.port : DEFAULT_PORT
  const targetPid = Number.isInteger(options.targetPid) ? options.targetPid : process.ppid
  const appExecutable = typeof options.appExecutable === 'string' && options.appExecutable !== ''
    ? options.appExecutable
    : process.execPath

  const id = makeId()
  const logPath = options.logPath ?? restartLogPath(id)
  let record
  try {
    record = createRecorder(logPath)
  } catch (error) {
    return { ok: false, id, logPath, error: `cannot open log ${logPath}: ${String(error?.message ?? error)}` }
  }

  // The schedule record is written BEFORE the spawn, so it is deterministically
  // the first line and a spawn failure is appended right after it.
  record('scheduled', { delaySeconds, port, targetPid, appExecutable, simulated })

  const workerPath = fileURLToPath(new URL('./restart.mjs', import.meta.url))
  const argv = [
    workerPath,
    '--worker',
    '--id', id,
    '--log', logPath,
    '--port', String(port),
    '--target-pid', String(targetPid),
    '--app', appExecutable,
    '--delay-seconds', String(delaySeconds),
  ]

  const spawned = await spawnDetached(process.execPath, argv, {})
  if (!spawned.ok || spawned.child === undefined) {
    record('failed', { step: 'spawn', message: `cannot spawn worker ${process.execPath}` })
    return { ok: false, id, logPath }
  }
  record('worker-spawned', { workerPid: spawned.child.pid })
  // Detach fully: the worker must outlive this process, which is about to die.
  spawned.child.unref()
  return { ok: true, id, logPath, delaySeconds }
}

/** Normalized worker configuration, parsed from the scheduler's argv. */
function readWorkerConfig() {
  const argv = process.argv.slice(2)
  return {
    id: flag('--id', argv) ?? makeId(),
    logPath: flag('--log', argv),
    port: integerOption('--port', flag('--port', argv), { minimum: 1, fallback: DEFAULT_PORT }),
    targetPid: integerOption('--target-pid', flag('--target-pid', argv), { minimum: 1, fallback: process.ppid }),
    appExecutable: flag('--app', argv) ?? process.execPath,
    delaySeconds: integerOption('--delay-seconds', flag('--delay-seconds', argv), { minimum: 0, fallback: DEFAULT_DELAY_SECONDS }),
  }
}

/**
 * Worker body: quit the app, wait for the port to free, relaunch, wait ready.
 *
 * Under the test hook every destructive step is simulated while the recorded
 * phases keep the exact production construction, so the protocol is provable
 * without touching a real desktop.
 * @returns the process exit code.
 */
export async function runWorker() {
  const argv = process.argv.slice(2)
  const id = flag('--id', argv) ?? makeId()
  const logPath = flag('--log', argv) ?? restartLogPath(id)
  // The recorder exists before ANY option is parsed, so a malformed invocation
  // still leaves durable failure evidence instead of an empty log.
  let record
  try {
    record = createRecorder(logPath)
  } catch (error) {
    process.stderr.write(`restart-buttons: cannot open log ${logPath}: ${String(error?.message ?? error)}\n`)
    return 1
  }

  try {
    const { port, targetPid, appExecutable, delaySeconds } = readWorkerConfig()
    const simulated = isSimulated()

    record('worker-started', { delaySeconds, port, targetPid, appExecutable, simulated })

    await sleep(delaySeconds * 1_000)
    record('delay-elapsed')

    // Validate the target BEFORE touching it: killing a recycled pid would take
    // down an unrelated process, which is far worse than not restarting at all.
    if (!simulated) {
      if (!isPidAlive(targetPid)) {
        record('failed', { step: 'target-missing', targetPid })
        return 1
      }
      if (process.platform === 'win32' && !tasklistHasPid(targetPid)) {
        record('failed', { step: 'target-missing', targetPid })
        return 1
      }
    }

    // NEVER `/T`. The worker is itself a descendant of the Electron main
    // process, so a tree kill would destroy the very worker that has to
    // relaunch the app. `/PID <pid> /F` terminates exactly one process.
    const quitArgv = ['/PID', String(targetPid), '/F']
    record('quit', { executable: 'taskkill', argv: quitArgv })
    if (!simulated) {
      const result = spawnSync('taskkill', quitArgv, { stdio: 'ignore', windowsHide: true })
      if (result.status !== 0) {
        record('failed', { step: 'quit', status: result.status })
        return 1
      }
    }

    let freed = true
    if (!simulated) freed = await waitForPortFree(port)
    record(freed ? 'port-free' : 'port-still-busy', { port })
    if (!simulated) await sleep(SETTLE_MS)

    record('open', { executable: appExecutable, strippedEnv: ['ELECTRON_RUN_AS_NODE', 'DSH_DESKTOP_NODE_EXECUTABLE'] })
    if (!simulated) {
      const opened = await spawnDetached(appExecutable, [], { env: relaunchEnv() })
      if (!opened.ok) {
        record('failed', { step: 'open', executable: appExecutable })
        return 1
      }
      opened.child.unref()
    }

    let ready = true
    if (!simulated) ready = await waitForPortReady(port)
    if (!ready) {
      record('failed', { step: 'ready-wait', port })
      return 1
    }
    record('ready', { port })
    return 0
  } catch (error) {
    record('failed', { step: 'worker', message: String(error?.message ?? error) })
    return 1
  }
}

/** Path of this module's directory, exported for tests and diagnostics. */
export const restartDir = logDir()

/** Whether the current process was started as the restart worker. */
export function isWorkerInvocation(argv = process.argv.slice(2)) {
  return hasFlag('--worker', argv)
}

/**
 * Self-execute as the worker when this module IS the spawned script.
 *
 * The guard is deliberately narrow — the `--worker` flag AND this file being
 * the entry script — so importing `scheduleRestart` from the host half can
 * never start a worker by accident.
 */
function isMainModule() {
  const entry = process.argv[1]
  if (typeof entry !== 'string' || entry === '') return false
  try {
    return fileURLToPath(import.meta.url) === entry
  } catch {
    return false
  }
}

if (isMainModule() && isWorkerInvocation()) {
  process.exitCode = await runWorker()
}
