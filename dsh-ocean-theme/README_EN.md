# Ocean theme for DSH Desktop

An ocean under the interface. DSH's glass surfaces stay where they are, and
under them there is water: schools of small fish, whales and sharks, jellyfish,
kelp, corals and a shipwreck on the seabed. Pointer movement breaks the surface
into ripples, small fish scatter away from the cursor, and bubbles rise from the
bottom.

Dark and light schemes. The palette follows the DSH theme: night depths or
shallow sunlit water.

## What lives in the ocean

| Dweller | Who it is |
| --- | --- |
| Small-fish schools | Seven species across five depths, each with its own size spread |
| Whales | Blue, humpback, orca |
| Predators | Two sharks, hammerhead, sailfish, sawfish, narwhal |
| Other large bodies | Dolphin, ray, anglerfish, seahorse, squid |
| Jellyfish | Three bell shapes, drifting through the water column |
| Seabed | Kelp, corals, rocks, a shipwreck |
| Live motion | A diver descending from above, bubbles from the floor, cursor ripples |

Fish swim in schools at varying depths: the deeper and further away, the darker
the silhouette and the smaller the body. Large bodies move slowly — in inverse
proportion to their size, not by a shared multiplier.

## Installation

From this repository:

```bash
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-ocean-theme
```

Restart DSH Desktop afterwards: the host composes the profile configuration at
startup. To remove it:

```bash
dsh plugin --profile web remove dsh-ocean-theme
```

If your DSH version does not support the subpath, unpack the archive and
install from a local path:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-ocean-theme
```

## Settings

The theme panel lives in **Settings → General → Ocean**.

- **Ocean** — enable or disable the theme entirely.
- **Population density** — how much fish, jellyfish and seabed life appears.
- **Water brightness** — overall lightness of the scene.
- **Build** — the plugin's version marker, so you can see which build is loaded.

Settings survive a restart and apply without reloading the window.

## How it works

The theme is split in two halves.

**`lib/index.js` — host.** Does nothing and touches no services. It exists only
so the package is recognised as loaded and its browser half reaches the bundle.
Reaching for a service without a declared inject tears down the whole mount,
browser half included — the log keeps a single vendor line, and from the outside
it looks like the plugin broke.

**`lib/client.js` — browser.** All of the picture: a `.dsh-ocean-layer` at
`z-index: -1` inside an isolated `body` context, with `#root` above it restored
to transparency by the plugin. The layer is a separate element rather than a
document background, because the shell paints an opaque background on `#root` and
a picture on `html, body` would end up behind it.

The live layer is a real `<canvas>` inside that layer. Cursor ripples, bubbles
and the diver are drawn on it. The static part — fish, seabed, jellyfish — is an
SVG scene, rebuilt on theme or setting changes and cached as a background.

## Verification

```bash
npm run check
```

Builds the scene into `scene.svg` and prints its size, body count and listener
count. The scene is plain XML, so you can open it in a browser and look at it.

## License

MIT — see [LICENSE](LICENSE).
