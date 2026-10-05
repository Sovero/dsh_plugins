# dsh-client-voice-eternia — "Voice of Eternia"

Voice input for DeepSeek Harness: a microphone button in the composer, speech
recognition, and text inserted at the caret.

## Why a separate plugin

DSH ships an experimental voice plugin. This one differs:

| | this plugin | official (experimental) |
|---|---|---|
| Russian speech | **yes** — cloud recognition | the local SenseVoice engine has no Russian |
| Where the text goes | at the caret, without breaking `@file` chips | at the end of the draft |
| Where the API key lives | on the host only | — |

The local DSH engine (SenseVoice) declares the languages `auto, zh, en, yue, ja,
ko` — Russian is not among them. Recognition therefore goes through the cloud,
and the key stays on the host, never reaching the browser.

## How the microphone works

Audio is captured by the **host**, not by the page: the DSH process runs
`ffmpeg` and reads the stream. This is what makes dictation work inside the DSH
Desktop window, where the browser `getUserMedia` is blocked by the Electron
permission allow-list (`canGrantWindowPermission` permits only
`clipboard-sanitized-write` and `notifications`).

The page only asks the host to start and stop, and polls the level meter.

## Installation

From this repository:

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-client-voice-eternia
```

After installing, restart DSH Desktop: the host builds the profile
configuration at startup.

## Settings

The settings page lives in the general DSH settings — section **Voice settings**
— and is also reachable from the **Voice settings** entry in the left sidebar.
Every field has a hint underneath it.

| Group | What it configures |
|---|---|
| Recognition | credential record name, model, own API address, speech language |
| Text polish | on/off, ready-made task, editor instruction, temperature |
| Microphone and recording | device, time limit, gain, background rumble removal |
| Insertion | insertion target, `@file` chip handling |
| Interface | browser address on failure, show text before insertion |

### Models

The model list is read from the DSH profile — the same list you see in the
**Models** section. Only free models (the `:free` suffix) are offered: dictation
and polishing are not worth paying for, and a paid model in the list would be a
trap. A value can still be typed by hand for a model the profile does not list.

### API keys

The provider field is a list of **credential record names**, not a place for a
key. The key itself is entered in the DSH Models section and stays on the host;
only its name travels to the interface.

### Polishing tasks

Polishing uses the same model that runs the conversation, so there is no second
model setting. The task picker fills the instruction field with a ready prompt —
plain text, business letter, work note, meeting minutes, technical speech, chat
message, or spelling only — and the text stays editable.

### Interface languages

Russian, English and Chinese. Prompts are translated into all three, so the
instruction in the field matches the language of the window.

## Development

```bash
npm run build   # assemble lib/
npm run test    # run the test suite
npm run check   # syntax check
```

Changes to the **client** half need only a build and `Ctrl+R`. Changes to the
**host** half (routes, profile reading) require a DSH **restart**: the host is an
ordinary Node module and is imported once at startup.

## Licence

MIT — see [LICENSE](LICENSE).
