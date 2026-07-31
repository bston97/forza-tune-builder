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

267+ assertions across ten files, plus a 684-build structural sweep and a
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
   (0.55–0.65 / 0.42–0.48) are still house numbers, not published.
2. **Traceable FH6-specific source** — ForzaTune's guide, Game8, official
   patch notes. Diff accel bands, aero balance range, the drag-tire nerf.
3. **Community-standard but FH4/FH5-era** (carried forward, not FH6-confirmed)
   — HokiHoshi's axle-share ARB/damper method, the bump=0.63×rebound
   convention, the spring frequency-vs-PI curve.
4. **House heuristics with no external source** — final-drive fallback
   (power-to-weight based; the exact-solve path using tire size/redline/top
   speed is the real formula and should be preferred), brake-bias-per-width-
   step, most of the `carNotes()` discipline-fit thresholds.

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
