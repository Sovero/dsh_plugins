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
| Distant clouds | 7 coloured masses with a core, lobes and star grain; they breathe and sway |
| Stars | 3 depth layers, density 160/100/50k per screen, twinkle `sin(t·f+φ)` |
| Constellations | far plane: 14 figures with faint lines and silhouette hints; count is a setting |
| Planets | 2–3 spheres, one ringed; speed is inversely proportional to radius (≈12 px/s small, ≈3 px/s large) |
| Comets | 1–2, gradient tail, sine wobble |
| Meteors | spawn every 2.5–9 s, 700–1300 px/s, 12 % trail |
| Ships | 3–4, waypoint routing, inertia, banked turns, fading trail, navigation light |
| Field | glow, force arcs and rings around the cursor |

## Why planets no longer circle

With the old acceleration cap of 5 px/s², gravity accelerated a planet to
roughly three times its own starting speed. The impulses were strictly
symmetric and the system conservative, so a captured pair honestly repeated its
orbit forever. The circle was not a drawing bug but a consequence of
conservation: such a system has no way out of a capture.

The model now has three things it lacked:

- gravity is capped at 0.06 px/s² — the path visibly bends but the heading
  never turns back on itself;
- **speed homeostasis** — the velocity magnitude eases toward its cruise
  value, so gravity and separation can no longer drag the pace anywhere;
- **heading wander** — a slow random rotation of the velocity vector. It is
  the only irreversible force in the model.

What breaks the circle is the **acceleration cap**, and measurement shows it:
homeostasis and wander barely move the recurrence figure on their own (0.944
without wander against 0.950 for the healthy model, 0.919 without homeostasis),
while restoring the cap to 5 brings the circle straight back. They work in
combination, but the cap is the lever.

Frames spent overlapping fell from 0.88 to 0.01. Off-screen exits: zero.

### How "no circling" is measured

The signal is taken straight from the report: a planet **comes back to where it
left from** after a noticeable lag. The metric is the minimum, over lags of
1–60 s, of the normalised displacement `|p(t+L) − p(t)| / (mean speed × L)`.
A straight line scores exactly 1 at every lag; a closed orbit scores near zero
at the lag of its period. The first version of the test measured something
else — how much the path resembles a loop — and it was bad: on that metric the
**broken model was caught less often than the healthy one** (median 0.45
against 0.08). A loop metric has no scale, so a slow lazy drift scores the same
as a real circle.

The test pins 40 generator seeds, counts the share of windows whose recurrence
falls below 0.65, and requires **exactly zero**. A control check in the same
test requires each of five physics rollbacks to produce a non-zero share. The
metric was validated by breaking the real code: cap 5 → 0.45, softening 400 →
0.045.

The metric has an honest limit: the lag window stays at 60 s or below — over a
longer lag the recurrence falls in both models and the separation disappears.

## Bigger planet, slower drift

Cruise speed is inversely proportional to radius: `8 × (60 / radius)`. A planet
twice the reference size moves at half the speed. The relation is a true
inverse, not "size subtracted", so the slowdown holds across the whole 34–92 px
range. Depth and the "Planet speed" slider multiply on top: the slider scales
the pace without breaking the rule.

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

DSH: the settings live in the **left sidebar** — a «Deep space» item with an icon
in the sidebar footer (next to settings); clicking it opens a dropdown with every
theme switch. When the sidebar is collapsed only the icon remains. Switches for
the scene, the pointer perturbation, the layout mode, brightness, and the panel
language. The host stores everything in `profiles/web/cordis.patch.yml`.

The dropdown is 420 px wide and up to 640 px tall (never more than 82 % of the
viewport height, so it always fits). Inside it is a single column: the checkbox,
the glyph, the label and the hint stand in a row, the label never breaks between
words, and the flexible hint gives up width first. The font inside is smaller —
12 px for switch labels, 11 px for slider captions, 10 px for hints, the language
buttons and the select. The old grid reserved 220 px of minimum text width and
kept a second column, so at 340 px the combined minimum did not fit: the second
column pushed its neighbours past the edge and long labels wrapped onto three
lines.

Every setting carries its own glyph: a ringed planet, a comet, a ship, a star, a
constellation, a rayed sun, a black hole, a mouse trail, layers, a binary star, a
language, brightness and a frame counter. The interface icon set has no planet,
no comet and no black hole, and «Archive» or «Clock» would have lied, so the
glyphs are our own (`GLYPHS`): a single 1.5 px stroke on a 16 unit box, coloured
by `currentColor`, zero external requests, excluded from tab order. A disabled
switch dims its glyph too — otherwise the row would still look switched on.

Frame rate is a dropdown next to brightness: off / 15 / 30 / 60, 30 by default.
Leftover time accumulates and a frame is skipped whole rather than partially, so
the scene never renders in halves; on a 144 Hz display the cap visibly saves
power.

Constellations sit on the **far plane**: their layer is drawn first, right after
the canvas is cleared, so the gas, the stars and every body — planets included —
are in front of the figures. They are also smaller and dimmer than near lights
(sky share 0.12, stars × 0.78, overall alpha 0.62), because a distant figure read
like a sticker on the glass. Below the «Constellations» switch a slider
«How many constellations: N» sets the figure count: 0…14, 8 by default. The host
stores the value; the slider appears only while constellations are on.

Ships no longer circle. The old build accumulated small heading nudges
(`targetHeading += rand(-0.8, 0.8)`) and kept speeds of 2–16 px/s. Thirty seconds —
the time it takes an eye to notice a ship at all — carried it across 8 % of the
screen, and its turn radius at full energy was 10–29 px against a 1080 px tall
screen: it could not physically leave its own patch, so it kept coming back.
Ships now route between waypoints placed 0.35–1.2 screens from their current
position and run at 14–60 px/s. The waypoint is measured **from the ship**, not
from the screen centre: a centre-relative goal closed the route around the middle
of the sky (median trajectory box 0.44 of the screen width over 30 s), while a
ship-relative goal pushes the route away (p90 grows from 0.71 to 1.16). Inertia
survived the change — turn rate is still clamped by the energy reserve, the speed
magnitude still ramps with acceleration, and the nose follows actual velocity, so
it lags the goal through a turn.

Distant clouds are seven large coloured masses on the far plane, meant to read as
star clusters: a dense core, several lobes that break the silhouette out of a
circle, and star grain inside. They breathe (radius pulsing 25–60 %, period
50–125 s) and sway vertically, each with its own rate and phase so nothing pulses
in unison. Unlike the nebulae they are painted **per frame, not into the parallax
band cache**: the bands rebuild only on resize and dpr, and inside the cache time
stands still, so breathing clouds would freeze forever. Layer order is gas →
clouds → bright stars → bodies.

## Files

| File | Purpose |
| --- | --- |
| `dsh.plugin.json` | plugin manifest: `main`, `client.main`, `client.inject` |
| `lib/index.js` | host half: `Config` and settings registration |
| `lib/client.js` | client half: style, layer, engine, bilingual settings panel |
| `cordis.patch.yml` | loader patch inserting the plugin into the profile |
| `tests/theme.test.mjs` | shape tests: manifest, no ESM, layers, dispose, i18n |
| `README.md` | русская версия |
