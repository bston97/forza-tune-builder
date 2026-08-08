# Backlog — plans not yet started

This is the repo's to-do list. It is tracked and pushed like everything else
(it was briefly gitignored on 2026-08-08 and that was reversed the same day —
a to-do list that only exists on one machine is not a to-do list). Five items,
each with a plan detailed enough to start from cold. Nothing here has been
implemented.

Baseline as of 2026-08-08: `node tests/run.js` → **532 passed, 0 failed**
across sixteen files.

**Suggested order.** E first — it is two small documentation fixes and one of
them is a genuine contradiction in the test data. Then A1 (gating matrix) and
A2 (Mechanical/Aero Balance sweep) — cheap, done standing still in the tuning
menu, and they turn two of the biggest house-heuristic guesses into measured
functions. D (discipline naming) next, because it is small and it changes the
vocabulary every other plan is written in. Then B (generative test set),
because it needs A's fixtures to be more than a structural check. C (GitHub
files) is independent and can be done any time.

---

# A. In-game measurement plan — reverse-engineer it once, stop guessing

## Why this exists

Four tiers of confidence are documented in CLAUDE.md. Tier 4 — "house
heuristics with no external source" — currently covers the ARB multipliers, the
damping ratios, the camber targets, brake-bias-per-width-step, the `vFrac`
scaling for six of seven disciplines, and every `carNotes()` threshold. Tier 3
is FH4/FH5 community work carried forward untested. Searching for outside
confirmation has already been tried and produced nothing usable (see CLAUDE.md
— forums.forza.net is dead, forza.guide and traxion.gg 403, and the AI
summaries are actively wrong about the gearing graph).

The game itself is the only instrument that works. Most of what is unknown can
be read **without driving a lap**, off readouts that are simulation output with
no run-to-run variance.

## Method rules — these are what keep the data worth having

1. **One variable per observation.** Change one slider, read the readouts,
   write the row. If two things moved, the row is discarded, not interpreted.
2. **Type the number, do not photograph it.** The 3.73 gearing disaster came
   out of measuring gear-line spacing off a phone photo taken at an angle.
   Perspective distortion ate the difference between the right model and the
   wrong one. A blurry photo is not a reading.
3. **Readouts over feel, and the Performance panel over lap times.** 0-60,
   0-100, top speed, 60-0 and 100-0 braking, lateral G — all deterministic,
   all returned in about a second per setting. Reserve driving for things no
   panel reports.
4. **Where a lap time is unavoidable** (dirt, cross-country, anything grip- or
   surface-dependent), fix the route, run best-of-5, record all five, and treat
   anything inside the spread of those five as no result. Do not record a
   single run.
5. **Record raw readings, never conclusions.** The row holds what the screen
   said. The interpretation lives in the analysis, where it can be revised
   without re-driving anything.
6. **Every session ends with a committed fixture**, even when nothing changes.
   A session that confirms the current constant is worth exactly as much as one
   that overturns it, and it is worth nothing at all if it is not written down.
7. **A measurement never silently becomes a constant.** Promotion rule below.

## Promotion rule — measurement → shipped constant

1. Fixture file committed first, with provenance (car, date, class, full part
   list, which screen the number came off).
2. A test that asserts the fixture, independent of `compute()` — the way
   `sweep.test.js` does. It must be able to fail if the formula changes.
3. Only then may `compute()` change, and the comment above the constant gets
   the date and the car.
4. **Two cars minimum** before a constant is treated as general. One car gives
   you that car's fit. This is the lesson from `vFrac`: 0.95 was a guess, 1.14
   was overfitted to whichever setting won one metric by 0.035s inside a range
   that spanned 0.12s, and both shipped untested against data already in the
   repo.

## The rig — reference cars

Chosen to span the axes the formulas actually key off (weight, front %,
drivetrain, gear count, class). Pick real cars owned, and record the exact
stat block once in the fixture header.

| slot | wants | why |
|---|---|---|
| R1 | the GR86 already used | continuity with every existing fixture |
| R2 | light FWD hatch, ~2,600 lb, 62%+ front | the FWD diff band and front-heavy ARB split |
| R3 | heavy AWD, 4,200 lb+ | the damping `wNudge` and the ARB weight scaling |
| R4 | mid-engine or rear-engine, front % under 45 | every axle-share formula, from the other side |
| R5 | high-power S1/S2 RWD, 8+ gears | `SPREAD` for a long box, aero at speed |
| R6 | dirt/cross-country capable AWD | the only way to touch the loose-surface constants |

## Sessions, in value-per-minute order

### A1 — Gating matrix (highest value, ~20 minutes, no driving)

The gating matrix is FH5 carryover and **has never been confirmed on an FH6
screen** — and it is load-bearing: it decides which values print and which
prose prints beside them. Two claims are most likely wrong:

- Street/Sport suspension = spring rate + ride height but **no** damping or
  alignment.
- Street/Sport diff = acceleration only, **no** decel.

Procedure, per part tier: fit the part, open the tuning menu, write down
exactly which sliders exist. Cover: suspension stock/street/sport/race (plus
rally and off-road if separate), ARBs stock/street/sport/race and
front-only/rear-only if that is even purchasable separately, diff
stock/street/sport/race/drift/rally/off-road, transmission
stock/street/sport/race, and both aero ends fitted/not.

Deliverable: `tests/data/gating-fh6.json`, then `gates.test.js` and
`compute()`'s gate block updated **together**. If a claim survives, say so in
the fixture — "confirmed 2026-xx-xx" is the whole point.

### A2 — Mechanical Balance and Aero Balance, solved exactly (~40 min, no driving)

The single biggest win available. Mechanical Balance is a **real readout that
responds to the tune**, which means it is a function we can solve for
outright — and once solved, the app stops aiming at 0.55–0.65 with multipliers
inherited from HokiHoshi's FH4-era method and starts *computing* the ARB pair
that lands on the target.

Sweep, on R1, everything else held:

| step | vary | hold | points |
|---|---|---|---|
| 1 | `arF` = 1, 15, 30, 45, 65 | `arR` = 30, springs at default | 5 |
| 2 | `arR` = 1, 15, 30, 45, 65 | `arF` = 30 | 5 |
| 3 | `spF` ±30% | bars at 30/30 | 3 |
| 4 | `spR` ±30% | bars at 30/30 | 3 |
| 5 | ride height F and R, one step each way | everything else | 4 |
| 6 | repeat steps 1–2, 3 points only, on R3 and R4 | — | 6 |

Record Mechanical Balance to every digit the game shows. Questions the data
answers directly: is MB a pure front share of roll stiffness (`kF/(kF+kR)`)?
Do springs enter it, or bars only? Does ride height? Does the car's weight
distribution enter, or is it purely the sliders? Is it linear in the slider
value or in some derived rate?

Same shape for Aero Balance: sweep `aeF` at fixed `aeR` and vice versa, 5
points each, on R1 and R5. Confirms whether AB is simply front downforce share
and whether the 0.42–0.48 house band is even expressible as a slider pair.

Deliverable: `tests/data/balance-sweep.json` + a solved form in a new
`MODEL.md`. Then `compute()` can invert it: given the target band, emit the
bars that hit it, and print the predicted MB next to the ARB values so the
in-game readout becomes a *check*, not a discovery.

### A3 — `SPREAD` tables for every gear count (~20 min, no driving)

`SPREAD[7]` is confirmed against the game's own race box. **4, 5, 6, 8, 9 and
10 are not** — they are invented, and they feed both the per-gear speeds and
`ratioSet()`. Fit a race transmission on cars with each gear count and copy the
default ratios straight off the screen. Six numbers per row, no interpretation.

Deliverable: `tests/data/spread-fh6.json`, `SPREAD` replaced with measured
rows, `gearing.test.js` extended to assert them.

### A4 — The speed constant on a second car (~15 min)

`k = axisMax · fdFit · G_top` holds on the GR86 within 1.5% across all seven
gears. It is pure kinematics so it *should* generalise, but "should" is how
tier-4 constants are born. Repeat on R3 and R5: read the axis maximum, sweep to
the fit, then check three gear endpoints against `k/(FD·G)`.

Also worth settling in the same sitting: does the axis maximum move when the
gearing moves (it should not), and does it move when power parts are fitted (it
probably does — it is described as a property of the car).

### A5 — Tire pressure against tire temperature (~30 min, driving, telemetry)

`PSI` is a per-compound table of house numbers with a weight nudge and a
drivetrain split. Telemetry reports tire temperature per corner, so the target
is directly observable: fix a route, run 3 laps at each of 5 pressures per
axle, record steady-state temperature at the end of the lap. This gives a real
pressure-to-temperature slope per compound, and lets the app say "this will run
hot, start 2 psi lower" instead of handing over a table value.

Do this for at least sport and race slick. Dirt and off-road compounds are
lower value — the surface dominates.

### A6 — Camber against contact-patch temperature (~30 min, driving, telemetry)

Telemetry splits tire temperature inner/middle/outer. That makes the camber
target *measurable* rather than a discipline constant: sweep camber over 5
points per axle and find where inner and outer converge. The existing `out_f` /
`in_f` fix deltas already assume this relationship — this measures its slope so
a single fix step lands correctly instead of always being 0.3°.

### A7 — Braking, objectively (~15 min, no driving)

The Performance panel reports 60-0 and 100-0 distances. Brake balance and
pressure therefore have an objective optimum per car that can be swept without
driving: 5 balance points × 3 pressure points = 15 readings, ~15 minutes. This
kills the `brake-bias-per-width-step` heuristic (currently 1.5% per step, with
no source at all) or confirms it.

Note the panel's braking figures are straight-line only — they cannot see
trail-braking stability, which is what balance actually trades against. So the
sweep sets the floor, and the `entry_us` / `entry_os` fix path still owns the
rest.

### A8 — Differential lock via wheel-speed telemetry (~40 min, driving)

Diff accel lock is Boston's own rule clamped into ForzaTune's band. Telemetry
shows per-wheel speed, so the lock's effect is observable: on a fixed corner
exit, record inner/outer driven-wheel speed difference at 5 lock settings. The
setting where the difference collapses is full lock; the useful range is the
part of the sweep where it is still varying. Also gives the AWD centre split a
real reading.

### A9 — `vFrac` for the other six disciplines (expensive — do last)

Only road is measured. The other six were scaled from it to preserve an
ordering that was itself a guess. Each one needs its own sweep, and for dirt
and cross-country the Performance panel does not measure what matters, so it is
best-of-5 on a fixed route — hours, not minutes. Worth doing eventually;
worth doing only after A1–A4 have paid for themselves.

Cheap partial win available first: even without lap times, the "does every gear
engage" tie-breaker that settled road at 1.00 can be evaluated for every
discipline from the speed constant alone. Any `vFrac` that leaves the top gear
dead on a representative car is wrong regardless of lap time.

## Data format

`tests/data/<topic>-<car>-<yyyy-mm-dd>.json`:

```json
{
  "car": "2022 Toyota GR86", "class": "A", "pi": 700,
  "date": "2026-08-08", "screen": "tuning menu / Performance panel",
  "build": { "tires": "sport", "susp": "race", "arb": "both",
             "diff": "race", "trans": "race", "aero": "both",
             "twf": 0, "twr": 0, "gears": 7 },
  "held": { "arR": 30, "spF": 480, "spR": 460 },
  "varied": "arF",
  "rows": [ { "arF": 1, "mb": 0.41 }, { "arF": 15, "mb": 0.48 } ],
  "notes": "readout to 2dp; no driving"
}
```

One `varied` key per file. If two things moved, it is two files or it is
nothing.

---

# B. "Works for any car" — the generative test plan

## What today's suite does and does not cover

532 assertions, and the structural sweeps (684 builds, 2,304 gated-part
combinations, plus monotonicity) already prove a lot: in-range for the real
sliders, finite, bump ≤ rebound, nothing crashes, every render path treats
`null` as not-adjustable. What none of it proves is **calibration** — CLAUDE.md
says it outright: shift every ARB by 10× and the whole suite still passes.

So this plan has two halves that must not be confused. Layers 0–2 are
*self-consistency*: they catch a formula contradicting itself or its own
documented intent. Only layers 4–5 can catch a formula that is internally
consistent and wrong about the game, and those need Plan A's fixtures. Writing
layer 1 and calling the calibration problem solved is the trap.

## Layer 0 — input space, defined once

The generator needs a written domain per field, with the joint constraints
spelled out, because the interesting bugs live in combinations no realistic car
has.

| field | realistic | adversarial edges |
|---|---|---|
| `wt` | 1,400–5,500 lb | 900, 8,000 |
| `fw` | 38–65 % | 20, 80 (the form's own clamp) |
| `hp` | 60–1,500 | 25, 3,000 |
| `tq` | 60–1,200 | 25, 2,000 |
| `cls` | D…X | every one, stratified |
| `disc` | all seven | every one, stratified |
| `dt` | RWD/FWD/AWD | all three × all seven disciplines |
| `gr` | 4–10 | all seven counts |
| `tire` | all eight | including mismatched (slicks on cc) |
| widths | 0–3 per axle | 0/3 and 3/0, the two extremes of `wStep` |
| part tiers | full matrix | already swept by `gates.test.js`; reuse it |
| `fdfit` | 2.0–7.0 | absent, 0, 12 |
| `vgraph` | 60–300 mph | absent, 5, 500 |
| `fdset` | 2.0–7.0 | absent, out of slider range |

**Stratify, do not just randomise.** Pure random sampling will run thousands of
A-class RWD road builds and never touch a 10-speed FWD drift car. Cover the
cross product of (discipline × drivetrain × gear count) at least once each,
then fill the remaining budget randomly.

Seeded PRNG (xorshift32, seed printed on every run, `SEED=` env to reproduce).
On failure, shrink: bisect each numeric field toward the class median and
re-test, print the minimal failing input as a pasteable object literal.

## Layer 1 — invariants that must hold for every generated car

Grouped by subsystem. Each is a property, not a value, so none of them
tautologically re-implements `compute()`.

**Springs.** Rate strictly increases with weight, all else equal. Front rate
increases with `fw`, rear decreases. F/R rate ratio tracks the axle-load ratio
within a stated tolerance. Frequency rises monotonically with class. Fitting
aero raises both rates. Nothing ever leaves 20–3,000 lb/in.

**Damping.** Rebound is monotone in axle share. Bump is 0.63 × rebound after
snapping, on both axles, on every build where both exist. Nothing pins to 20 —
assert a *margin*, e.g. no realistic car exceeds 18.5, which is the regression
guard for the 4,800 lb car that came out at 19.2. Loose-surface disciplines are
strictly higher than tarmac at equal weight.

**ARBs.** The pair is proportional to axle load before the discipline trim.
Drift's front bar is far softer than its rear; road's are near-neutral. Sum
rises with weight. Every value lands on a 0.1 grid (already covered by
`arb.test.js` — extend it to generated cars rather than duplicating).

**Pressure.** Front/rear split has the sign the drivetrain implies (FWD front
higher, RWD rear higher-loaded therefore lower front delta, AWD nearly even).
Drag is the documented exception and must stay 50/15. Everything inside 10–55.

**Alignment.** Camber is negative on every tarmac discipline and less negative
on loose. Front camber tracks `fw`. Caster is constant per family — assert it
does not drift when unrelated fields move.

**Brakes.** Balance responds **only** to `wStep`, and 0/0 must equal 3/3
exactly. This is the property that documents the surprising behaviour the form
now explains in words.

**Diff.** Accel lock falls as torque rises and rises with weight, monotone in
both. FWD is strictly below RWD on the same stat block. Every tier gates to the
right set of non-null fields — cross-check against `gates.test.js` rather than
restating it.

**Gearing.** The kinematic identity `speed(G) = k/(FD·G)` holds for every gear
of every generated car. Gear speeds are strictly decreasing in ratio. `fdBand`
brackets `fd` whenever it exists. A user-set final drive is always the one every
downstream figure is computed at — regenerate the whole card at `fdset` and
assert nothing anywhere references the recommendation. No check anywhere
compares a user measurement to a setting the user is not running (the
regression guard for the "it keeps saying something is wrong" cycle).

**Global.** Every non-null output is finite, inside `VMETA` lo/hi, and lands on
the `s` grid. No output is `NaN`, `-0`, `undefined`, or the string `"null"`
anywhere in any render path. (The sweeps cover much of this today; the point is
to run it over *generated* inputs rather than an enumerated list.)

## Layer 2 — per-discipline signature matrix

This is the "test each discipline" half, and it is what stops a refactor
quietly turning a drift tune into a road tune. For each of the seven, assert a
signature: a small set of relationships that are true of that discipline and
false of at least one other, evaluated on the same reference car.

| discipline | signature assertions |
|---|---|
| Road / Circuit | ARB pair near-neutral; `vFrac` 1.00 → recommendation equals the fit; camber most negative of the tarmac set after touge; every gear engages at the recommendation |
| Sprint | softer than road on both springs; longer gearing than road; lower decel lock |
| Touge | softest tarmac springs; largest front/rear ARB gap of the tarmac set; ride height raised; shortest tarmac gearing |
| Drift | front ARB far below rear; accel lock 92; RWD-only warning fires on anything else; 6+ gears warns; rear camber least negative |
| Drag | pressures exactly 50/15; aero suppressed entirely at both ends; accel lock 95; decel 0; camber near zero |
| Dirt | springs under two-thirds of road; ride height high; damping offset applied; non-dirt tires warn; non-AWD warns |
| Cross-Country | softest springs of all; highest ride height; off-road tires required; max width advised; centre split 50 |

Each row is also a *contrast* test: assert the pairwise ordering (cc softer
than dirt softer than touge softer than road) rather than absolute numbers, so
a global recalibration does not have to rewrite the file.

## Layer 3 — golden snapshots, honestly labelled

A committed snapshot of full `compute()` output for ~24 corpus cars. This
catches unintended change and nothing else — it is a **drift detector, not a
correctness check**, and the file should say so at the top so nobody
regenerates it and believes something has been verified. Regeneration is a
deliberate command (`node tests/golden.js --update`) that prints a diff summary
and requires the diff to be read.

## Layer 4 — the real-car corpus

~24 hand-entered real cars spanning D→X, 1,400–5,500 lb, all three drivetrains,
4–10 gears, all seven disciplines represented. Each entry carries the stat
block, the intended discipline, and **expected output bands with a citation**
for where the expectation came from.

Honest status: until Plan A runs, almost every "expected band" would be this
repo's own formula reflected back, which is worthless. So build the corpus
structure now, populate the stat blocks now, and leave the expectation column
empty and clearly marked `unverified` until a measurement fills it. An empty
column that says "we do not know this" is a working document; a column filled
with the formula's own output is a lie that passes.

## Layer 5 — calibration guards from measured data

The `sweep.test.js` pattern, one file per Plan A session. Each holds measured
rows as a fixture and asserts that whatever the constants are now, they still
produce an answer the game actually liked. This is the only layer that can
catch a 10× ARB error, and it can only ever cover what has been measured.

## "Our own physics system" — what that should and should not mean

The instinct is right, with one hard limit already established (CLAUDE.md, "Why
there is no simulator"): the kinematics generalise and were successfully
reverse-engineered; the performance figures cannot be, because six points on
one car underdetermine the model and the derived constants contradict each
other by 10%. Do not build a lap simulator. The game returns exact figures in a
second; rebuilding that badly is worse than telling the user which three
numbers to read.

What to build instead:

- **`MODEL.md`** — the physics spec in prose and equations, separate from the
  code: what each formula claims about the game, which tier of evidence it sits
  on, and what measurement would move it up a tier. Effectively the tier list
  from CLAUDE.md, expanded to one entry per constant with an owner and a
  status.
- **Solved sub-models where a readout exists.** MB and AB (A2) are genuinely
  solvable to an equation, because the game shows the answer. Gear speeds
  already are. These are the parts of "their physics" we can actually own.
- **Explicit unknowns.** Everything not solvable gets a named gap in `MODEL.md`
  with the experiment that would close it. A gap that is written down is a
  backlog item; a gap that is not is a constant nobody remembers is a guess.

Keep it a spec plus fixtures, not a second implementation. Two implementations
of the same wrong idea agree with each other perfectly.

## Implementation notes

New files: `tests/gen.js` (seeded generator + shrinker, shared), `props.test.js`
(layer 1), `disc.test.js` (layer 2), `golden.test.js` + `tests/golden.json`
(layer 3), `corpus.test.js` + `tests/data/corpus.json` (layer 4). Layer 5 files
arrive one per measurement session.

Keep the default suite under ~10 seconds — `FUZZ=250` by default, `FUZZ=20000`
for a deep run before a release. `run.js` needs no change beyond passing the
env through; it already aggregates whatever each file prints.

---

# C. GitHub suggested files

The repo is public (it serves GitHub Pages), so GitHub's community-standards
checklist applies and several of these are visible gaps. Nothing here changes
app behaviour.

**Decide first: does this repo want contributors?** If not, half the list is
theatre — `CONTRIBUTING.md` and a code of conduct on a repo that will never
take a PR are noise. The recommendation is: ship the ones that protect the
work (license, CI, `.gitattributes`) and the ones that make *Boston's own*
bug reports structured (issue forms), and skip the social ones until someone
other than Boston opens a PR.

### Worth doing

- **`LICENSE`** — `package.json` says `UNLICENSED`, so the current state is
  "all rights reserved by default, on a public repo." That is a legitimate
  choice but it should be explicit. If it stays closed, add a short
  `LICENSE` saying so and leave the field as is. If it opens up, MIT and update
  `package.json` to match. Right now the repo and the manifest disagree by
  omission.
- **`.github/workflows/test.yml`** — the suite is a single dependency-free
  `node tests/run.js` that exits non-zero on failure. CI is ~10 lines:
  `actions/checkout`, `actions/setup-node` at 20, run the tests. Trigger on
  push to `main` and on PRs. This is the highest-value file in the section:
  the whole "run the tests before and after every change" discipline currently
  depends on remembering.
- **`.gitattributes`** — Windows working copy, single HTML file that
  everything diffs against. `* text=auto eol=lf` prevents a stray CRLF commit
  turning into a 2,796-line diff.
- **`.github/ISSUE_TEMPLATE/calibration.yml`** — the project-specific one, and
  genuinely useful. A form that requires the stat block (car, year, class,
  discipline, weight, front %, hp, torque, drivetrain, gears, part tiers), the
  value the app produced, what the game or the track actually said, and which
  screen it was read off. Every calibration report in this repo's history has
  been a chat message; a form makes them fixtures.
- **`.github/ISSUE_TEMPLATE/bug.yml`** — plain bug form: browser, device,
  steps, what happened. Set `blank_issues_enabled: false` in `config.yml` so
  the calibration form is the default path.
- **`.github/pull_request_template.md`** — three checkboxes that match the
  rules already in CLAUDE.md: tests run before and after, calibration
  sanity-checked by hand if a `compute()` formula moved, mobile media query
  still last in `<style>`.

### Probably worth doing

- **`SECURITY.md`** — trivially short for a static single-file page with no
  backend and no dependencies ("no server, no data leaves the device, report
  anything to <email>"), but it is one of the checklist items GitHub surfaces
  and it takes two minutes.
- **`.editorconfig`** — two-space indent, LF, final newline. Matches what is
  already in the file and stops an editor reformatting 2,796 lines.
- **`.github/dependabot.yml`** — there are no npm dependencies, so this is
  only worth it for `github-actions` updates once the workflow above exists.

### Skip for now

- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `FUNDING.yml`, discussion
  templates, `CODEOWNERS` on a single-author repo. Revisit if anyone else ever
  opens a PR.

### One thing to check while in there

The Pages build currently publishes from `main` automatically. Confirm whether
that is the legacy branch-based deploy or a workflow; if a test workflow is
added, it is worth knowing whether a red build can still publish. It can, on
branch-based deploys — which may be fine (a broken page beats a stale one is
arguable either way) but should be a decision rather than a surprise.

---

# D. Discipline naming and the circuit/sprint distinction

## What is wrong now

The internal keys and the labels both drifted from what the game calls things:

| key | current label | should be (verify on screen) |
|---|---|---|
| `rally` | Dirt Rally | **Dirt** |
| `cc` | Cross-Country | Cross Country — label already right, key is fine |
| `road` | Road / Circuit | Road Racing, probably |
| `sprint` | Sprint / Speed Race | check what the game actually calls this |
| `touge` | Touge | not an FH event family — a real distinction, but ours |
| `drift` | Drift | fine |
| `drag` | Drag | fine |

Tire compounds are a separate vocabulary from event families and may
legitimately differ — the compound may still be called "Rally" and "Off Road"
even if the event is called Dirt and Cross Country. Confirm both lists
separately; do not assume one implies the other.

**Step one is a screen check, not an edit.** Open the event list and the
upgrade shop and write down the exact strings. This whole item is a
transcription task and it is only worth doing correctly.

## The migration hazard — read before touching a key

`disc` is **persisted**. `libKey()` builds its key as
`name|year|class|disc` and `fh6lib` entries are stored under it; `planKey()`
does not include `disc`, so the plan store is safe. Renaming the `rally` key to
`dirt` therefore orphans every saved build in the library on every device it
was saved on, silently — the entry stays in localStorage and simply never
matches again.

So:

- **Rename display strings freely.** `DISC[x].n` is presentation and nothing
  keys off it. This alone fixes the actual complaint.
- **If the internal keys are renamed too**, ship a one-time migration that
  rewrites stored keys on load (`rally→dirt`, mapping table, versioned under a
  `fh6libv` marker so it runs once), plus a test that a v1 library survives it.
  `find.test.js` and `planyear.test.js` are the files that will notice.
- Recommendation: rename labels now, leave keys alone. The keys are internal,
  nobody sees them, and the cost of touching them is real.

## Circuit vs sprint — is it a discipline or a modifier?

`road` and `sprint` already exist as separate disciplines with different
constants (`vFrac` 1.00 vs 1.03, softer springs, lower decel). So part of this
is already built and the question is really about layout *within* a family:
circuit versus point-to-point on the same event type.

Two options:

1. **Split further into more disciplines** — more entries in `DISC`. Simple, no
   architecture change, but the list gets long and every new entry is another
   column of unmeasured constants.
2. **An orthogonal layout modifier** — a second field (`circuit` /
   `point-to-point`) that applies a small multiplier set on top of the chosen
   discipline. Cleaner conceptually, and it composes: a dirt sprint and a dirt
   circuit differ the same way a road sprint and a road circuit do.

Option 2 is the better shape, with one hard condition attached.

**Do not ship a field that changes nothing, and do not ship one whose effect is
invented.** The honest failure mode here is adding a selector that multiplies
`vFrac` by 0.97 because that felt right — that is a placebo control, and it is
worse than not having the field, because the user will trust it. Either it is
measured (A9's method: fix a circuit route and a sprint route, sweep the same
car on both, see whether the optimum actually moves) or it ships as a
documented no-op that only changes wording.

What plausibly *does* differ, and is testable: gearing (a sprint with one long
straight wants a taller top gear than a circuit that never reaches it — and
the "does every gear engage" test can evaluate that without lap times),
ride-height and spring compliance over kerbs, and aero (a point-to-point route
with fewer sustained corners pays less for drag). What plausibly does not:
alignment, tire pressure, diff. Scope the experiment to the first list.

Suggested sequence: (1) transcribe the real names off the screen; (2) rename
labels only, keys untouched; (3) add the layout modifier as a UI field wired to
a single constant table where circuit and point-to-point are **identical
values** on day one, with the table commented as unmeasured; (4) measure, then
fill the table. Step 3 with step 4 skipped is the thing to avoid.

`modes.test.js` covers field visibility and will need the new field added to
its matrix; the plan-mode hide list needs a decision too — layout is knowable
before parts are bought, so it belongs in plan mode as well as tune mode.

---

# E. Loose ends — small, found 2026-08-08, not fixed

Two documentation defects found while auditing the repo. Neither breaks
anything today; the second is a real contradiction in the reference data and
should be settled before anyone leans on the gearing constant again.

### E1 — CLAUDE.md undercounts the test suite

CLAUDE.md line 27 says "381+ assertions across thirteen files." Actual, as of
2026-08-08: **532 assertions across sixteen files** (`arb`, `find`, `gates`,
`gearing`, `locked`, `modes`, `mono`, `pi`, `planyear`, `review2`, `scan`,
`smoke2`, `smoke3`, `stock`, `stress`, `sweep`). Just stale — update the number
and the file count. Low stakes, one-line fix, but the paragraph is the one that
tells a new session how much cover it has, so an undercount encourages
scepticism where it is not warranted.

### E2 — The reference car's axis maximum is recorded as both 157 and 159

Same car, same screen, two different readings, and the whole gearing model
hangs off it via `k = axisMax · fdFit · G_top`:

- `sweep.test.js` — `const FIT = 4.575, AXIS = 157`, asserting k ≈ **589**.
- `gearing.test.js:177` — `const K = 159 * 4.575 * 0.82`, i.e. **596.5**.
- CLAUDE.md uses both: the "no 7th gear visible" observation is on a 159 axis,
  while the 7th-gear-stub example says "6th ran out at 154 on a 157 chart."

Both test files pass because each is internally consistent, which is exactly
why this survived. The gap is 1.3% — small enough that every existing assertion
tolerates it, large enough that it is definitely one misreading and not two
valid numbers.

Fix: re-read the axis maximum off the GR86's gearing screen once, write the
number into a fixture with a date, and make **both** files import it rather
than each carrying its own literal. Worth doing as part of session A4, which is
already going to that screen for the second-car check.

Note for whoever settles it: the axis is described as a fixed property of the
car, but it is not established whether power upgrades move it. If the two
readings were taken at different build states, both could be right and the real
defect is that neither records the build. A4 should check that too.
