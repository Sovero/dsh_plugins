# DSH plugins

Plugins for [DSH Desktop](https://www.deepseek.com/harness/): themes, tools and
extensions. Every plugin lives in its own folder and is installed with the DSH
command.

| Plugin | What it does | Version |
| --- | --- | --- |
| [`dsh-poslanik-deep-space`](dsh-poslanik-deep-space) | Deep space theme: stars, nebulae, dwarfs, suns, black holes, planets, ships with trails, comets, meteors. Pointer movement applies an electromagnetic perturbation to space. Bilingual settings panel. | 1.1.0 |
| [`dsh-ocean-theme`](dsh-ocean-theme) | Ocean theme: small-fish schools, whales, sharks, jellyfish, kelp, corals and a shipwreck on the seabed. Pointer movement breaks the surface into ripples. Dark and light schemes. | 1.0.0 |

## Install

From this repository (a subdirectory path is required):

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-poslanik-deep-space
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-ocean-theme
```

Restart DSH Desktop afterwards: the host composes the profile config at startup.
Remove with `dsh plugin --profile web remove <plugin-id>`.

If your DSH version does not support the subdirectory form, unpack a release
archive and install from a local path:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-poslanik-deep-space
dsh plugin --profile web add /absolute/path/to/dsh-ocean-theme
```

## License

MIT — see [LICENSE](dsh-poslanik-deep-space/LICENSE) next to the plugin.
