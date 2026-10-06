#!/usr/bin/env node
/**
 * Manual entry point for the dsh-restart-buttons restart mechanism.
 *
 * Schedule mode prints the schedule id and log path and returns IMMEDIATELY —
 * it never sleeps, polls or tails, because the app it just scheduled to die is
 * the one hosting this process.
 *
 *   node lib/restart-cli.mjs --delay-seconds 45
 *   node lib/restart-cli.mjs --worker --log <path> --port 19387 ...
 *   node lib/restart-cli.mjs --help
 *
 * Test hooks (used only by the hermetic tests):
 *   DSH_RESTART_BUTTONS_TEST_MODE  simulates the destructive steps
 * @module dsh-restart-buttons/restart-cli
 */
import { isWorkerInvocation, runWorker, scheduleRestart } from './restart.mjs'

/** Default GUI port of the DSH Desktop web server. */
const DEFAULT_PORT = 19387

/** Read `--name value` from argv. */
function flag(name, argv) {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

/** Print usage. */
function help() {
  process.stdout.write([
    'restart-cli: schedule a full DSH Desktop relaunch, or run as its worker.',
    '',
    '  node lib/restart-cli.mjs [options]',
    '  node lib/restart-cli.mjs --worker --log <path> [options]',
    '',
    'Options:',
    '  --delay-seconds <n>  Grace period before the app goes down (default 45;',
    '                       production floor 30 unless the test hook is set).',
    `  --port <n>           GUI port to wait on (default ${String(DEFAULT_PORT)}).`,
    '  --target-pid <n>     Process to terminate (default: our parent).',
    '  --app <path>         Executable to relaunch (default: our own executable).',
    '  --help               Print this help and exit 0.',
    '',
    'Schedule mode prints two lines and returns immediately:',
    '  scheduled id=<id> log=<path>',
    '  report the scheduled restart now; do not wait for it in this call',
    '',
  ].join('\n'))
}

const argv = process.argv.slice(2)

if (argv.includes('--help')) {
  help()
  process.exit(0)
}

if (isWorkerInvocation(argv)) {
  process.exit(await runWorker())
}

const port = flag('--port', argv) === undefined ? DEFAULT_PORT : Number(flag('--port', argv))
const delayRaw = flag('--delay-seconds', argv)
const targetPidRaw = flag('--target-pid', argv)
const app = flag('--app', argv)

const result = await scheduleRestart({
  port,
  ...(delayRaw === undefined ? {} : { delaySeconds: Number(delayRaw) }),
  ...(targetPidRaw === undefined ? {} : { targetPid: Number(targetPidRaw) }),
  ...(app === undefined ? {} : { appExecutable: app }),
})

if (result.ok) {
  process.stdout.write(`scheduled id=${result.id} log=${result.logPath}\n`)
  process.stdout.write('report the scheduled restart now; do not wait for it in this call\n')
  process.exit(0)
}

process.stderr.write(`restart-cli: scheduling failed${result.error === undefined ? '' : `: ${result.error}`}\n`)
if (result.logPath !== undefined) process.stderr.write(`restart-cli: log=${result.logPath}\n`)
process.exit(1)
