# dsh-client-voice-eternia — "Voice of Eternia"

Voice input for DeepSeek Harness: two buttons in the composer — a microphone for
dictation and a conversation button for talking out loud.

## Why a separate plugin

DSH ships an experimental voice plugin. This one differs:

| | this plugin | official (experimental) |
|---|---|---|
| Russian speech | **yes** — cloud recognition | the local SenseVoice engine has no Russian |
| Where the text goes | at the caret, without breaking `@file` chips | at the end of the draft |
| Spoken replies | **yes** — the answer is read aloud | — |
| Where the API key lives | on the host only | — |

## Two buttons

| Button | Icon | What it does |
|---|---|---|
| Microphone | microphone | records, recognises, inserts the text at the caret |
| Conversation | microphone with waves | listens continuously, sends each phrase to the chat, speaks the reply |

Earlier there was one button, and a setting decided what it meant: pressing the
microphone while expecting dictation could start a conversation instead. Two
buttons remove the guess — the mode is visible before you press.

## How the microphone works

Audio is captured by the **host**, not by the page: the DSH process runs
`ffmpeg` and reads the stream. This is what makes dictation work inside the DSH
Desktop window, where the browser `getUserMedia` is blocked by the Electron
permission allow-list.

In conversation mode the recording never stops. A level detector decides where a
phrase ends: a pause closes it, while a click or a chair creak never reaches
recognition. Finished phrases wait on the host and are taken one at a time.

## Latency, honestly

| Step | Time |
|---|---|
| Pause that closes a phrase | 0.7 s |
| Recognition (cloud) | 3–5 s |
| Reply of the agent | its own |
| Start of the spoken answer | ~0.05 s (local voice) |

Recognition dominates. The model that reads Russian audio (`google/gemini-3.5-flash`)
spends most of its tokens on internal reasoning, and its cheaper "lite" variants
return an empty string on real speech. Local recognition would cut this to about
a second; it is not implemented here.

## Installation

From this repository:

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-client-voice-eternia
```

After installing, restart DSH Desktop: the host composes the profile config at
startup.

## Settings

The page lives in the general DSH settings — section **Voice settings** — and is
also reachable from the **Voice settings** entry in the left sidebar. It is split
into two columns, **Dictation** and **Conversation**. Every field has a hint.

| Column | Groups |
|---|---|
| Dictation | Recognition, Text polish, Microphone and recording, Insertion |
| Conversation | Conversation, Reply voice, Interface |

### Models

The model list is read from the DSH profile — the same list you see in the
**Models** section. Only free models are offered, since a paid one in the list
would be a trap. A value can still be typed by hand for a model the profile does
not list.

### API keys

The provider field is a list of **credential record names**, not a place for a
key. The key itself is entered in the DSH Models section and stays on the host.

### Reply voice

Voices come from this machine (Windows SAPI), listed by name and culture. Rate
runs from −10 to 10, volume from 0 to 100. The answer is read after it is
finished, and can be interrupted.

### Interface languages

Russian, English and Chinese. The plugin follows the language of the DSH window
and switches with it.

## Development

```bash
npm run build   # assemble lib/
npm run test    # run the test suite
npm run check   # syntax check
```

Changes to the **client** half need only a build and `Ctrl+R`. Changes to the
**host** half (routes, profile reading) require a DSH **restart**: the host is an
ordinary Node module, imported once at startup.

## Licence

MIT — see [LICENSE](LICENSE).
