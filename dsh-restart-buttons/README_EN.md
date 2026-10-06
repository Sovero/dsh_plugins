# Restart buttons for DSH Desktop

Two buttons in the DSH Web GUI sidebar foot: reload the interface, or fully
relaunch DSH Desktop on Windows.

| Button | Behaviour |
| --- | --- |
| **Reload DSH** | `window.location.reload()` — reloads the page and reconnects. Applies client-plugin changes and rebuilds the UI. No host involvement, no confirmation, non-destructive. |
| **Restart app** | Quits and relaunches DSH Desktop through a durable detached helper. Two-step inline confirmation: the first click arms the button for 5 seconds and changes its label, the second click fires. |

## Where they live

Both buttons register into the root-scoped list slot **`sidebar.footer.action`**
with id `dsh-restart-buttons` and `order: 100`, so they render beside the
shipped Cordis badge (`cordis-panel`, order 0) in the sidebar foot — directly
above the settings area holding the account / "⋯ More" row.

The slot's owner props are `{ wide: boolean }`; when the sidebar collapses to
its 56px rail (`wide: false`) the buttons render their glyphs only.

## Install

From this repository (the subpath to the plugin folder is given):

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-restart-buttons
```

Restart DSH Desktop afterwards: the host composes the profile configuration at
startup. To remove it: `dsh plugin --profile web remove dsh-restart-buttons`.

If your DSH version does not support the subpath, unpack the release archive and
install from a local path:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-restart-buttons
```

## HTTP API

Both routes are served by the DSH host web server on the GUI port.

### `GET /dsh-restart-buttons/status`

Read-only capability probe. Loopback-fenced, but does not require POST.

```json
{
  "ok": true,
  "plugin": "dsh-restart-buttons",
  "version": "1.0.0",
  "port": 19387,
  "electron": true,
  "appExecutable": "C:\\...\\DeepSeek Harness.exe",
  "parentPid": 19252,
  "restartEnabled": true
}
```

`403 {"ok": false, "error": "forbidden"}` when the request is not a trusted
loopback same-origin request.

### `POST /dsh-restart-buttons/restart`

Schedules a full relaunch and answers **before** any process is touched.

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ ok, id, logPath, delaySeconds }` | Scheduled. The worker is already spawned. |
| 403 | `{ ok: false, error: "forbidden" }` | Not a trusted loopback same-origin POST. |
| 409 | `{ ok: false, error: "not-desktop" }` | Not running under the Electron shell. |
| 409 | `{ ok: false, error: "unsupported-platform" }` | Not Windows. |
| 500 | `{ ok: false, error: "schedule-failed" \| "internal" }` | The worker could not be spawned. |

## Security

The restart route can terminate the application, so it is fenced on four
independent markers before anything happens:

1. **Loopback socket peer** — RFC 5735 127/8, `::1`, and IPv4-mapped
   `::ffff:127/8`. The socket address is authoritative; `X-Forwarded-For` is
   never trusted.
2. **Loopback `Host` header** — `localhost`, `[::1]`, or 127/8.
3. **`Sec-Fetch-Site` is not `cross-site`.**
4. **`Origin`, when present, must match `Host` exactly** — `localhost:19387` and
   `127.0.0.1:19387` are different authorities.

On top of that the route is **POST-only** (a navigation or an `<img src>` cannot
reach it) and refuses with 409 when the process is not running under the
Electron shell, so a plain `dsh web` host can never be killed through it.

The browser half additionally requires a **second click within 5 seconds**
before the restart is sent.

## Restart mechanics

`lib/restart.mjs` splits the work in two, because the process that would perform
the restart is the one being restarted:

- **Schedule mode** validates the options, writes the `scheduled` phase line,
  spawns a detached worker with `stdio: 'ignore'` + `unref()`, awaits only the
  spawn acknowledgement, and returns immediately.
- **Worker mode** sleeps the delay, verifies the target pid is alive, runs
  `taskkill /PID <pid> /F` — **never `/T`**, because the worker is itself a
  descendant of the host process and a tree kill would destroy the worker that
  must relaunch the app — waits for the port to stop accepting connections,
  relaunches the executable with `ELECTRON_RUN_AS_NODE` removed from the
  environment (otherwise the app would start as a plain Node process instead of
  the GUI), and polls until the port answers.

`lib/restart-cli.mjs` exposes the scheduler for manual use:

```
node lib/restart-cli.mjs --delay-seconds 45
node lib/restart-cli.mjs --help
```

## Verification

Dependency-free; React is resolved from the profile's installed copy:

```
npm test
```

## License

MIT — see [LICENSE](LICENSE).
