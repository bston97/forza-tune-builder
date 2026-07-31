# Tune Goon

A Forza Horizon 6 tuning calculator: enter a car's stat block, get a full tune,
fix what the car actually did on track, plan the upgrade path, and export a
sheet. Single self-contained `index.html` — no server, no build step, no
dependencies. Deployed via GitHub Pages, auto-publishing from `main` on every
push (usually live within a couple of minutes; verify with
`gh api repos/bston97/tune-goon/pages/builds/latest --jq .status`).

Live at **https://bston97.github.io/tune-goon/**.

**The project is Tune Goon; the page heading is not.** The repo, URL, PWA name
and docs all say Tune Goon, but the `<h1>` still reads "FH6 Tune Builder" and
the exported sheet still says "Forza Horizon 6 · Tune Sheet" — that is
deliberate, asked for directly, not something left half-renamed. The local
working directory is still `Forza Tune Builder`; renaming it is safe but has to
happen outside a session, since it is the cwd.

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

### Gearing — and a worked example of getting it wrong

The Gearing tab's graph plots **rpm against speed, one straight line per gear**.
There is no power curve on it, so the long-standing instruction to "move the
final drive until the power curve reaches the edge of the graph" was describing
something that does not exist.

**The bottom axis does not rescale.** Its range is a property of the car, not of
the gearing, so a gear geared taller than the chart runs off the right-hand end
and is not drawn at all. Confirmed on Boston's screen 2026-07-31: a 7-speed
GR86 at final drive 3.73, axis reading 159 mph, **no 7th gear visible and only
the tail of 6th** — consistent with 6th ending at the edge and 7th at
159 × 0.95/0.82 ≈ 184 mph.

So the reading is visual and needs no numbers: sweep the final drive until the
top gear's line just reaches the right edge. At that setting top gear redlines
at the car's maximum usable speed — call it `fdFit` — and since speed at redline
goes as 1/FD, gearing to `vFrac` of that maximum is just `FD = fdFit / vFrac`.

The `SPREAD` tables are the game's own race-box ratios: the 7-speed on that
screen was 2.92/2.05/1.60/1.30/1.10/0.95/0.82, matching `SPREAD[7]` exactly. So
only the final drive is ever solved; leave the ratios alone.

**How this got shipped wrong, because the failure mode will recur.** An earlier
revision inferred from a photo that the axis *rescaled* with the gearing, so the
top gear always touched the edge — and built an exact-looking ratio solve
(`FD_now × graphMax / target`) plus card copy stating there was "nothing to line
up". Boston caught it in one line: *"I don't see 7th gear even on the chart and
6 is barely on there."* Three lessons worth keeping:

1. **A blurry photo is not a reading.** The gear-endpoint spacing was measured
   off a phone picture taken at an angle and matched the wrong model about as
   well as the right one. Perspective distortion ate the difference.
2. **The wrong version was more confident than the right one**, because it
   produced a tidy closed-form answer. Tidiness is not evidence.
3. **The original text had the right action under the wrong noun.** "Until it
   reaches the edge of the graph" was correct about the edge and wrong about
   what reaches it. Rewriting inherited text, check whether the part being
   discarded was the part that was true.

**The other trap, which cost a whole cycle:** the field feeding this lived in a
collapsed `<details>`, so it stayed blank, the power-to-weight guess ran, and
the only hint was body text under the number. Boston got the same wrong 3.73
back and reasonably asked what had changed. The block now defaults to `open`,
and an unsolved final drive raises a top-level warning rather than a footnote.
If you ever add another input the tune quietly degrades without, do the same.

**And the third wrong claim, for completeness.** Once the fit worked, the app
printed the top gear's limiter speed as a predicted top speed: "should read
about 151 mph". Measured at final drive 4.82 the car did **140.0**. Top gear's
limiter is a *ceiling*, not a prediction — the car only reaches it if the engine
still makes power that high, and at 140 mph in that gear it was already at
~7,600 rpm, past peak. The axis maximum is not reachable either. Nothing in the
gearing geometry can predict top speed, because none of it knows the power
curve.

**So geometry picks the starting point and the Performance panel picks the
setting.** That panel — same screen, left-hand side — reports 0-60, 0-100, Top
Speed, braking distances and lateral G for whatever is currently set. Those are
the actual objective, they are simulation output rather than driving, and they
carry no run-to-run variance. Sweeping the final drive against them is how
`vFrac` finally got measured.

**The calibration sweep** (GR86, 2026-07-31, ratios held at the race-box
default, final drive the only variable, fit = 4.575):

| final drive | 0-60 | 0-100 | top speed | tops out in |
|---|---|---|---|---|
| 4.82 | **3.040** | 8.723 | 140.0 | 7th |
| 4.58 | 3.056 | 8.636 | 141.4 | 7th |
| 4.30 | 3.088 | 8.671 | 142.7 | 6th |
| 4.00 | 3.104 | **8.601** | 143.5 | 6th |
| 3.73 | 3.088 | 8.671 | 143.8 | 6th |
| 3.50 | 3.153 | 8.671 | **144.4** | 5th |

Three things came out of it:

1. **`vFrac` for road is 1.00 — gear at the fit.** Getting here took two wrong
   answers, and the reasoning matters more than the number. The original 0.95
   was a guess and pushed toward 4.82, which measured **worst of the six**. The
   replacement, 1.14, was fitted to whichever setting won 0-100 (4.00, by
   0.035s) — but nothing dominates: 4.58 wins 0-60 by 0.048s, 3.50 wins top
   speed, and the whole range spans 0.12s. **Fitting a constant to the winner
   of one metric across noise that small is overfitting, and it produced a
   recommendation that left the 7th ratio doing nothing.** What actually breaks
   the tie is that at the fit every gear engages, while at 4.00 the car tops out
   in 6th. Same lap time either way; one of them uses the gearbox you paid for.
   The other six disciplines are scaled from road, preserving the ordering that
   was already there; **only road is measured.**

   Note this is a **PI** argument, not a shift-quality one. The rpm drop per
   shift is fixed by the ratio steps (70/78/81/85/86/86% on the GR86 7-speed)
   and final drive scales all gears together, so it cannot change shift quality
   — only where in the speed range the gears sit.
2. **The surface is flat.** 0.12s across the whole 0-100 range and 4.4 mph of
   top speed, with four of six settings inside 1%. Quoting a final drive to two
   decimals implies precision the game does not reward, so `compute()` returns
   `fdBand` and the card asks for a sweep rather than pretending to an answer.
3. **The 7th ratio was dead at every setting worth running.** At 4.30 and below
   the car tops out in 6th; the settings that do reach 7th are the slow ones. A
   6-speed would have performed identically for less PI, which is a build
   finding no amount of tuning fixes.

**Whether a gear is dead has nothing to do with whether it fits the chart.**
You shift *into* gear N at the speed where gear N−1 runs out, so the test is
that shift-in speed against top speed. The two conditions are independent: a
gear can hang off the right-hand edge and be perfectly useful, or sit inside
the chart and never be touched. And whether the top gear is even *visible*
depends on where the gear below it ends — at final drive 4.02 the GR86's 7th
showed as a ~3 mph stub because 6th ran out at 154 on a 157 chart, which is the
shift point drawn rather than the gear fitting. Without a measured top speed
there is nothing honest to compare against, since the axis sits ~13 mph above
anything the car reaches; `compute()` says so and asks for the number rather
than guessing.

### Searching for outside confirmation: don't bother

Asked to check this against published sources 2026-07-31, the result was
nothing usable, and it is worth recording so nobody spends the tokens again:

- The one forza.net thread on exactly this subject ("Gear/speed graph not
  correct in tuning menu") **301s to a forums landing page** — the shutdown
  took the content with it.
- `forza.guide` and `traxion.gg` both return **403** to fetches.
- **ForzaTune's gearing guides do not discuss the graph at all.** Their only
  relevant lines are "pick a top gear and final drive combination that reach
  your top speed" and that changing forward gears is not recommended. No axis,
  no overrun, no unused gears.
- The AI-written search summaries assert that gearing **too short** makes the
  top gear overrun the chart. That is backwards — short gearing pulls every
  line left — and our own sweep contradicts it directly. One summary also
  repeated the "move the final drive until the curve reaches the edge of the
  graph" line, which is very likely where this repo's original wrong text came
  from in the first place.

Everything real about the gearing graph in this file was measured off Boston's
screen. Treat that as the only source.

The verified core, which survived all three corrections: per-gear limiter speeds
from `k/(FD·G)` with `k = axisMax · fdFit · G_top`. Checked against the graph at
final drive 4.82 — 42/59/76/94/111/129/148 measured, 42/60/77/95/113/130/151
computed, inside 1.5% across all seven gears.

`gearing.test.js` holds all of it, with the GR86 screen as the reference case,
including assertions that each discredited claim stays dead.

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
