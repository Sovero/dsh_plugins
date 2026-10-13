# DSH plugins

Plugins for [DSH Desktop](https://www.deepseek.com/harness/): themes, tools and
extensions. Every plugin lives in its own folder and is installed with the DSH
command.

| Plugin | What it does | Version |
| --- | --- | --- |
| [`dsh-poslanik-deep-space`](dsh-poslanik-deep-space) | Deep space theme: stars, nebulae, dwarfs, suns, black holes, planets, ships with trails, comets, meteors. Pointer movement applies an electromagnetic perturbation to space. Bilingual settings panel. | 1.4.0 |
| [`dsh-ocean-theme`](dsh-ocean-theme) | Ocean theme: small-fish schools, whales, sharks, jellyfish, kelp, corals and a shipwreck on the seabed. Pointer movement breaks the surface into ripples. Dark and light schemes. | 1.0.1 |
| [`dsh-client-voice-eternia`](dsh-client-voice-eternia) | "Voice of Eternia" voice input: two buttons in the composer — a microphone for dictation and a conversation button for talking out loud. Russian speech recognition, phrases sent without Enter, spoken replies with a local voice, voice histogram. Three interface languages. | 0.2.1 |
| [`dsh-restart-buttons`](dsh-restart-buttons) | "Reload" buttons in the sidebar footer: reload the interface, or fully relaunch DSH Desktop on Windows through a detached worker. Two-step confirmation, four-sided safety fence, bilingual labels. | 1.0.0 |
| [`dsh-veil-of-ulgard`](dsh-veil-of-ulgard) | "Veil of Ulgard" theme: a night over a dead city — towers in three planes, a veiled moon, mist, ravens and ash. A living seeker's lantern follows the pointer and drives the darkness back; ash flares up inside its light. Its own settings panel in the left column. Dark and light schemes. | 1.1.0 |

## Install

From this repository (a subdirectory path is required):

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-poslanik-deep-space
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-ocean-theme
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-client-voice-eternia
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-restart-buttons
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-veil-of-ulgard
```

Restart DSH Desktop afterwards: the host composes the profile config at startup.
Remove with `dsh plugin --profile web remove <plugin-id>`.

If your DSH version does not support the subdirectory form, unpack a release
archive and install from a local path:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-poslanik-deep-space
dsh plugin --profile web add /absolute/path/to/dsh-ocean-theme
dsh plugin --profile web add /absolute/path/to/dsh-client-voice-eternia
dsh plugin --profile web add /absolute/path/to/dsh-restart-buttons
dsh plugin --profile web add /absolute/path/to/dsh-veil-of-ulgard
```

## License

MIT — see [LICENSE](dsh-poslanik-deep-space/LICENSE) next to the plugin.
