/**
 * Path helpers for dsh-restart-buttons.
 *
 * Every path derives from `os.homedir()`, so the plugin writes its logs to the
 * same place regardless of the process's working directory. The DSH home is the
 * `~/.dsh` directory that owns the profiles tree and the desktop logs.
 * @module dsh-restart-buttons/paths
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Root of the DSH home: `~/.dsh`. */
export function dshHome() {
  return join(homedir(), '.dsh')
}

/** Directory holding this plugin's logs: `~/.dsh/logs/restart-buttons`. */
export function logDir() {
  return join(dshHome(), 'logs', 'restart-buttons')
}

/** Activation and lifecycle log of the host half. */
export function pluginLogPath() {
  return join(logDir(), 'plugin.log')
}

/**
 * Durable log of one scheduled restart.
 * @param id - schedule id produced by the scheduler.
 */
export function restartLogPath(id) {
  return join(logDir(), `restart-${id}.log`)
}

/**
 * Append one line to a log file, creating its directory when needed.
 *
 * Logging must never be the reason a restart fails, so every filesystem error
 * is swallowed: the caller gets a boolean instead of an exception.
 * @param file - absolute log file path.
 * @param text - line content, written with a trailing newline.
 * @returns whether the line was written.
 */
export function appendLine(file, text) {
  try {
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, `${text}\n`)
    return true
  } catch {
    return false
  }
}
