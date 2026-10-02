# `dsh-poslanik-deep-space` — Deep Space theme

A deep-space theme for DSH Web. Behind the interface text: twinkling stars in three
depth layers, drifting nebulae, planets with a terminator and a ring, ships that
leave trails and change course on stored energy, comets with tails, passing
meteors. Pointer movement applies an electromagnetic perturbation: space warps,
glows and rings around the cursor.

The panel speaks the interface language: it reads the locale the host already
publishes in the `lang` attribute and switches with it. There is no language
switcher of its own.

## Layers

| Layer | What is drawn |
| --- | --- |
| Background | gradient `#04060f → #0a0c1e` |
| Nebulae | 4–6 radial patches, slow drift |
| Distant clouds | 7 coloured masses with a core, lobes and star grain; they breathe and sway |
| Stars | 3 depth layers, density 160/100/50k per screen, twinkle `sin(t·f+φ)` |
| Constellations | far plane: 14 figures with faint lines and silhouette hints; count is a setting |
| Planets | 2–3 spheres, one ringed; speed is inversely proportional to radius (≈12 px/s small, ≈3 px/s large) |
| Comets | 4–6 of three sizes: dust, ion and plasma tails, a core and a coma; shallow course in any direction, entering from the frame edge |
| Meteors | spawn every 2.5–9 s, 700–1300 px/s, 12 % trail |
| Ships | 3–4, waypoint routing, inertia, banked turns, fading trail, navigation light |
| Field | glow, force arcs and rings around the cursor |

## Where comets fly

The course is full: a comet goes left or right, up or down, and its entry is
picked together with the course. The sign of the vertical speed used to be
nobody's job — the line `vy: rand(2, 7) * spec.speed` was always positive — so
every comet fell from top to bottom, and `x` at spawn was random, so some
appeared in the middle of the frame. Nothing in the docs or the code ever
promised that: it just happened, and the sky looked one-sided.

Measured on the real `launchComet`, 4000 launches: up 49.7 %, down 50.3 %,
left 50.2 %, right 49.8 %, entry from the edge in 100 % of cases. The slope stayed
shallow — median |vy/vx| = 0.31, so comets still sweep across the frame instead
of falling steeply.

Entry is by the dominant axis: for a shallow comet that is a side edge, so it is
visible at once instead of after a long run above the frame.

## Why planets no longer gather into a trio

The report was not about overlap — separation already forbids that. Planets simply
**lived next to each other**: the group held for minutes and read as «all the
planets in one clump». The cause is the nature of symmetric gravity: a bound
trio has a shape that does not fall apart, and only a dispersal or an off-screen
exit could break it.

A **soft core** (`PLANET_PERSONAL = 3.4`, `PLANET_REPEL = 0.24`) makes the clump
unstable: closer than a personal space of 3.4 times the summed radii, planets no
longer attract, they push apart, and the push grows towards contact while being
exactly zero at the zone edge — outside it the law is unchanged and the path still
bends slightly. Planet attraction is also scaled by the **same multiplier as the
drift** now: it did not depend on the setting before, so at 15 % «Planet speed»
did the opposite of what it says — the planets barely crawled while being pulled
together at full strength.

Measured on the real code, 12 runs of 600 s, a clump being all three closer than
3.5 summed radii:

| Planet speed | Share of frames in a clump, before → after | Longest clump, before → after |
| --- | --- | --- |
| 15 % (the reported case) | 13 % → **0 %** | 292 s → **0 s** |
| 100 % | 27 % → 5 % | 402 s → 60 s |
| 200 % | 9 % → 6 % | 188 s → 39 s |

Sticking fell as a side effect: frames spent in hard separation 0.136 → 0.002
(p90), no off-screen exits, and the paths stayed almost straight (loop metric
p90 = 0.025).

## Why planets no longer circle

With the old acceleration cap of 5 px/s², gravity accelerated a planet to
roughly three times its own starting speed. The impulses were strictly
symmetric and the system conservative, so a captured pair honestly repeated its
orbit forever. The circle was not a drawing bug but a consequence of
conservation: such a system has no way out of a capture.

The model now has four things it lacked:

- gravity is capped at 0.06 px/s² — the path visibly bends but the heading
  never turns back on itself;
- **speed homeostasis** — the velocity magnitude eases toward its cruise
  value, so gravity and separation can no longer drag the pace anywhere;
- **heading wander** — a slow random rotation of the velocity vector. It is
  the only irreversible force in the model;
- the **soft core** described above.

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
test requires each of four physics rollbacks to produce a non-zero share. The
metric was validated by breaking the real code: cap 5 → 0.45, softening 400 →
0.045.

The metric states its limits honestly. First, the lag window stays at 60 s or
below — over a longer lag the recurrence falls in both models and the separation
disappears. Second, it does **not** see the soft core being switched off: the
recurrence stays at 0.0000, because circles were born of the acceleration cap,
not of attraction as such. The core is protected by a different metric — the
clump (98.6 % of frames and a worst clump of 219 s on rollback, against 0 % and
0 s for the healthy model) — and its control sits next to it. Softening 400 left
the rollback list for the same reason: with the core, even a strong long-range
pull no longer closes a loop (0.0149).

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
dsh plugin --profile web add github:Sovero/dsh_plugins#path:dsh-poslanik-deep-space
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
the scene, the pointer perturbation, the layout mode, brightness and the rest. The
host stores everything in `profiles/web/cordis.patch.yml`.

**The panel language is not chosen — it follows the interface language.** The host
picks the locale (`@deepseek-ai/dsh-client-locale`) and writes it into the `lang`
attribute of the document element; the panel reads that attribute and switches
language with the interface, live and without a restart. There is no second place
where the panel language could drift away from the interface. A note at the bottom
of the window says so.

The dropdown is 420 px wide and up to 640 px tall (never more than 82 % of the
viewport height, so it always fits). Inside it is a single column of rows built
after the «Ocean» panel: glyph and label on the left, control on the right,
nothing in between. The label gives up width first and ends in an ellipsis, while
the control keeps its own width, so checkboxes, sliders and the frame-rate select
stand in one column. The font is 12 px for labels and 11 px for values, hints and
the select.

**Hints moved out of the rows into a tooltip.** Every setting has a «?» button:
on hover (or keyboard focus) a card with the explanation appears next to it. The
card is rendered in a portal — the window body scrolls and clips anything outside
the flow — and lands to the left of the button, because the panel hugs the screen
edge; where it does not fit, it opens below the row. The card ignores the pointer,
so it never blocks a slider sitting under it.

Every setting carries its own glyph: a ringed planet, a comet, a ship, a star, a
constellation, a rayed sun, a black hole, a mouse trail, layers, a binary star,
brightness, a frame-rate clock and a figure counter. The interface icon set has no
planet, no comet and no black hole, and «Archive» or «Clock» would have lied, so
the glyphs are our own (`GLYPHS`): a single 1.5 px stroke on a 16 unit box,
coloured by `currentColor`, zero external requests, excluded from tab order. A
disabled switch dims its glyph too — otherwise the row would still look switched
on.

Frame rate is a dropdown next to brightness: off / 15 / 30 / 60, 30 by default.
Leftover time accumulates and a frame is skipped whole rather than partially, so
the scene never renders in halves; on a 144 Hz display the cap visibly saves
power.

Constellations sit on the **far plane**: their layer is drawn first, right after
the canvas is cleared, so the gas, the stars and every body — planets included —
are in front of the figures. Their points are smaller than near lights (sky share
0.16, stars × 0.78), because a distant figure read like a sticker on the glass.

The far plane used to cost the figure almost all of its brightness, twice over: the
layer glows at 40 % in the default mode (so it cannot wash out the interface),
and on top of that the thread was 0.34 under an overall dimming of 0.62 — 0.07 on
screen. No lines were visible at all, only a few pale dots, and a figure without
lines does not read as a constellation. The numbers now live in
`CONSTELLATION_STYLE` and are split by mode: in the default mode the thread is
0.95, the glow 0.35, a star 1 and the silhouette 0.19; in «under the text» mode
the numbers stay as they were, because there the layer moves behind the interface
and extra brightness would fight the text. The sky share went from 0.12 to 0.16 —
at 1080p it was 130 px, and the lines did not fold into a recognisable drawing
even at good brightness. Measured on screen: thread 0.071 → **0.319**, star
0.198 → 0.336.

Below the «Constellations» switch a slider
«How many constellations» sets the figure count, shown in its own column to the
right: 0…14, 8 by default. The host
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
