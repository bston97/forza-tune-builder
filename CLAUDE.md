# FH6 Tune Builder

A Forza Horizon 6 tuning calculator: enter a car's stat block, get a full tune,
fix what the car actually did on track, plan the upgrade path, and export a
sheet. Single self-contained `index.html` — no server, no build step, no
dependencies. Deployed via GitHub Pages, auto-publishing from `main` on every
push (usually live within a couple of minutes; verify with
`gh api repos/bston97/forza-tune-builder/pages/builds/latest --jq .status`).

Live at **https://bston97.github.io/forza-tune-builder/**.

## Before changing anything

**Run the tests before and after every change:**

```
node tests/run.js
```

381+ assertions across thirteen files, plus a 684-build structural sweep, a
2,304-combination render/export sweep over every gated-part combination, and a
monotonicity sweep. Exits non-zero on any failure or crash — safe to use as a
gate. See `tests/shim.js` for how a plain-Node DOM shim runs the app's real
`<script>` block with no browser; see any `tests/*.test.js` for the pattern
(`ok(label, condition, extraInfoIfFailed)`).

**What the tests do NOT catch:** calibration drift. A change that shifts every
ARB value by 10x still passes the stress sweep, because that sweep only checks
structural validity (in-range for the game's real sliders, finite, bump ≤
rebound) — not "is this the right number." There is no automated check against
the community baselines (HokiHoshi's axle-share method, ForzaTune's documented
FH6 bands). If you touch a formula in the `compute()` function, sanity-check
the output against a few real cars by hand, not just the test suite.

## Architecture

Everything lives in `index.html`: styles, the tune-calculation engine
(`compute()`), the fine-tune symptom→fix engine (`FIX`, `applyDeltas()`), the
build-plan generator (`buildPlan()`, `carNotes()`), two localStorage-backed
stores (finished builds in `fh6lib`, per-car starting stats in `fh6plan`), and
the sheet exporter (`sheet()`, using the `SHEET_CSS` template — the user's own
card design, kept deliberately separate from the on-page working view).

**One CSS ordering constraint that bit us once, will bite again if violated:**
the `@media(max-width:900px)` mobile block must stay the *last* rule in
`<style>`. Earlier control styles use the `font` shorthand, which resets
`font-size` — an earlier media query gets silently overridden by rules later
in the file. Cost real mobile usability before it was caught by literally
measuring rendered font sizes in a browser, not by reading the CSS.

**Upgrade gating is load-bearing, not cosmetic.** Which sliders exist depends
on what's installed — a Sport diff gives acceleration lock only, no decel, no
AWD centre split; a Street/Sport suspension gives spring rate and ride height
but not damping or alignment; stock ARBs/diff/suspension/transmission give
nothing at all. `compute()` sets the corresponding `v.*` fields to `null` when
locked, and every render path (on-page card, sheet export, library row) must
treat `null` as "not adjustable," never as zero or blank-string. See the
`gates.test.js` suite for the full matrix — extend it if you add a new
gated part.

**The prose has to be gated too, not just the values.** This is the failure
mode that actually shipped: values correctly rendered as `—` while the notes
beside them went on coaching a slider the car does not have — an exported sheet
telling you to target Mechanical Balance on a car with stock anti-roll bars,
and an aero note that said "rear aero only" whichever end was fitted. The sheet
is read away from the app, at the console, so it also has to account for its
own dashes: `sheet()` closes the tune notes with a "Not adjustable on this
build" list and marks locked sections in their headers. `locked.test.js` holds
the line on all three render paths, including a sweep of every gated-part
combination.

**Stock stats vs. finished-build stats are genuinely different data,** stored
separately on purpose: `fh6plan` (one entry per car+year, written by Build
Plan, pre-upgrade numbers — weight, HP, PI as it stands) and `fh6lib` (one
entry per car+year+class+event, written by Save Sheet, post-upgrade numbers).
Find searches both and labels which is which. Don't merge them — a stock HP
figure prefilling a tune would be confidently wrong.

## Formula provenance — what's verified vs. house heuristic

Comments in `compute()` say where each formula comes from and how confident it
is. Rough tiers, most to least trustworthy:

1. **Confirmed on Boston's own screen** — Mechanical Balance and Aero Balance
   are real in-game readouts (confirmed 2026-07-30); the exact target bands
   (0.55–0.65 / 0.42–0.48) are still house numbers, not published. The gearing
   graph and the `SPREAD` gear tables (confirmed 2026-07-31, see below).
2. **Traceable FH6-specific source** — ForzaTune's guide, Game8, official
   patch notes. Diff accel bands, aero balance range, the drag-tire nerf.
3. **Community-standard but FH4/FH5-era** (carried forward, not FH6-confirmed)
   — HokiHoshi's axle-share ARB/damper method, the bump=0.63×rebound
   convention, the spring frequency-vs-PI curve.
4. **House heuristics with no external source** — the final-drive fallbacks
   (see gearing below), brake-bias-per-width-step, the `vFrac` per-discipline
   targets, most of the `carNotes()` discipline-fit thresholds.

### Gearing — settled 2026-07-31 against the real screen

A photo of the Gearing tab (2022 GR86, A 700) established what the graph
actually is, and it is not what earlier versions of this app claimed:

- It plots **rpm against speed, one straight line per gear**. There is no power
  curve on it. Any instruction to "move the final drive until the power curve
  reaches the edge of the graph" is describing a graph that does not exist —
  that text shipped for a while and was wrong.
- Its **x-axis maximum is the speed at which the top gear meets the limiter**,
  and the axis rescales as the final drive moves, so the last gear always ends
  at the right edge. The edge number *is* the reading, not a target to line up.
- The `SPREAD` tables are the game's own race-box ratios — the 7-speed on that
  screen was 2.92/2.05/1.60/1.30/1.10/0.95/0.82, matching `SPREAD[7]` exactly.
  So only the final drive needs solving; leave the ratios alone.

That gives an exact solve from three numbers on that one screen — top speed,
graph max, current final drive — with tire circumference and redline cancelling
out: `FD_new = FD_now × graphMax / (topSpeed × vFrac)`. Prefer it over both
older paths. The tire-size/redline solve still works but needs a second screen
and trusts the tire you typed; the power-to-weight fallback is a placeholder
that knew nothing about tires or gearing and was badly out on the reference car
(3.73 against a correct 4.29).

**The one trap:** the Top Speed readout is only the car's drag-limited maximum
while the gearing can out-run it. Once the car is on the limiter, that readout
just echoes the gearing back, and solving from it chases its own tail — hence
the `revBound` guard (2%).

That guard has a subtlety worth not undoing. Because the solve only runs when
there is a gap, and a gap always means over-geared, **it only ever shortens** —
so applying its answer puts the car on the limiter at `vFrac` of top speed,
which then trips `revBound` on a re-read. That is correct and intended, not a
bug, but it means both the warning and the card must say so: lengthening is a
*measurement* step to recover the true top speed, never the setting to leave
it at, and once the answer is applied you do not feed the new readings back in.
Any rewrite of that copy has to keep that, or the app talks the user in a
circle. `gearing.test.js` holds all of it, with the GR86 screen as the
reference case.

### ARB increments

Anti-roll bars move in **0.1 steps** — 29.60, 29.70, 29.80, never 29.65
(confirmed 2026-07-31). `VMETA.arF/arR` already carry `s:0.1, d:1` and `snap()`
enforces it on every path including the multiplicative fix deltas; `arb.test.js`
sweeps 17k baseline values plus every fix stacked 25 deep to keep it that way.
Worth knowing the grain differs per slider — final drive is 0.01, ARBs and
damping 0.1, springs and the percentage sliders 1 — so `s` is the single source
of truth, not a shared rounding constant.

Search results for "FH6 tuning" are dominated by AI content farms that
fabricate specifics and copy each other; `forums.forza.net` is dead. Treat any
new source with real suspicion — cross-check against Boston's own tuning menu
before trusting a specific number over what's already here. The build-plan's
"Worth reading" section links the two sources that held up.

## Working style

Boston is an experienced FH6 tuner — no beginner explanations, no hedging on
a direct question, dense stat blocks worked from directly. Minimize input
friction relentlessly (this is why nearly every field either auto-defaults
from class/event or is optional), but never at the cost of correctness —
"quick is not as important as making the perfect build" was said explicitly
when the tradeoff came up. When a claim can be verified against the actual
game, that beats any external source, including prior research in this repo's
history.

## Known gaps / honest limitations

- No car database. Deliberate — there's no FH6 API and the one real stat
  source (Kudosprime) is stock-only, which would be actively wrong for a
  tune that needs post-upgrade numbers. `fh6plan`/`fh6lib` are the only
  "database," and they only know cars you've entered.
- localStorage is per-device and per-browser. The build library and starting
  stats don't sync across phone/PC. No backend exists to fix this; would need
  one (Boston's other project, Budgeter, already uses Supabase — same pattern
  would work here if this ever becomes worth it).
- Discipline constants (camber targets, damping ratios, ARB multipliers,
  final-drive bases) are theory-derived, not validated against extensive
  seat time. They're plain data tables at the top of the script — expect
  Boston to report specific values feeling off after driving builds, and
  treat that feedback as higher-priority than any published source.
