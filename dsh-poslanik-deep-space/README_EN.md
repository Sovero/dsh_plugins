# `dsh-poslanik-deep-space` — Deep Space theme

A deep-space theme for DSH Web. Behind the interface text: twinkling stars in three
depth layers, drifting nebulae, planets with a terminator and a ring, ships that
leave trails and change course on stored energy, comets with tails, passing
meteors. Pointer movement applies an electromagnetic perturbation: space warps,
glows and rings around the cursor.

The panel is bilingual: **Auto / Русский / English**. The choice is stored by the
host, so it survives restarts.

## Layers

| Layer | What is drawn |
| --- | --- |
| Background | gradient `#04060f → #0a0c1e` |
| Nebulae | 4–6 radial patches, slow drift |
| Stars | 3 depth layers, density 160/100/50k per screen, twinkle `sin(t·f+φ)` |
| Planets | 2–4 spheres, one ringed, drift ~1–2 px/s |
| Comets | 1–2, gradient tail, sine wobble |
| Meteors | spawn every 2.5–9 s, 700–1300 px/s, 12 % trail |
| Ships | 5–8, 5–27 px, 3–29 px/s, fading trail, course turns costing energy, navigation light |
| Field | glow, force arcs and rings around the cursor |

## Layout modes

- **Default (off "Under the text")** — the canvas sits above the interface with
  `mix-blend-mode: screen` at low opacity: it always shows, and `screen` only
  brightens, so text stays readable.
- **"Under the text" on** — the canvas drops to `z-index: -1` behind a
  transparent `#root`. Fully behind the UI, but panels with their own opaque
  background will hide it. The plugin clears full-viewport opaque backdrops it
  can find, and only their background — never `position` or `z-index` of foreign
  nodes.

## Install

From GitHub:

```bash
dsh plugin --profile web add github:<owner>/dsh-poslanik-deep-space
```

From a local path (development):

```bash
dsh plugin --profile web add /absolute/path/to/dsh-poslanik-deep-space
```

The package carries the bundle configuration, so installing the plugin adds it to
the profile automatically. Remove:

```bash
dsh plugin --profile web remove dsh-poslanik-deep-space
```

Restart DSH Desktop afterwards: the host composes the profile config at startup.

## Check and version

```bash
npm run check                 # syntax, version agreement, tests
npm run version:set -- 1.2.0  # updates package.json and dsh.plugin.json together
```

There is no build step: the client half is hand-written as a plain script, so a
bundler would be a needless step.

## Settings

DSH: Settings → General → «Космос / Deep space». Switches for the scene, the
pointer perturbation, the layout mode, brightness, and the panel language. The
host stores everything in `profiles/web/cordis.patch.yml`.

Frame rate is a dropdown next to brightness: off / 15 / 30 / 60, 30 by default.
Leftover time accumulates and a frame is skipped whole rather than partially, so
the scene never renders in halves; on a 144 Hz display the cap visibly saves
power.

Planet drift speed is the second slider, next to brightness: 10–200 %, step 5,
100 % by default. It is the `planetSpeed` host setting (0.1–2), scaling both the
spawn speed and the speed ceiling, so gravity cannot push the planets back up to
the old cap in the half-speed mode. Disk spin and satellite orbits are not
scaled — that is not drift.

## Files

| File | Purpose |
| --- | --- |
| `dsh.plugin.json` | plugin manifest: `main`, `client.main` (no `client.inject`, on purpose) |
| `lib/index.js` | host half: `Config` and settings registration |
| `lib/client.js` | client half: style, layer, engine, bilingual settings panel |
| `cordis.patch.yml` | loader patch inserting the plugin into the profile |
| `tests/theme.test.mjs` | shape tests: manifest, no ESM, layers, dispose, i18n |
| `README.md` | русская версия |
