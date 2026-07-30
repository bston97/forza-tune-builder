# FH6 Tune Builder

A single-file tuning calculator for Forza Horizon 6. Enter a car's stat block, get a
complete tune in Forza tuning-menu order, fix what the car actually did on track, and
export a sheet.

No server, no build step, no dependencies — open `index.html` in a browser.

## Why

Getting a tune used to mean a conversation: describe the car, answer clarifying questions,
wait for the numbers. But almost every tuning value is either a lookup table or a formula
driven off the stat block, so it doesn't need a conversation at all — it needs a form.

## What it does

**Tune calculation.** Twelve fields in, full tune out, ordered exactly like the in-game
tuning menu so you can read straight down while entering values: Tires → Gearing →
Alignment → Antiroll Bars → Springs → Damping → Aero → Brake → Differential.

No slider ranges are ever required. Spring rates come from `K = M(2πf)²` as absolute
lb/in — type the number in and the game clamps it if the car's range is narrower. Ride
height and aero work off discipline targets plus the in-game verification readings.

Final drive is solved exactly when you supply tire size, redline and top speed —
`FD = rpm × circumference × 3.6 / (target km/h × 60 × top gear)` — and falls back to a
power-to-weight estimate when you don't. All three are readable off in-game screens;
none can be inferred from class or weight, since tire diameter varies ±12% and redline
spans 5,500–9,000+.

**Fine-tuning.** After driving, pick what the car did from a symptom list (understeer on
turn-in, wheelspin on exit, bottoming out, tires cooking, hits the limiter early — 23 in
all) and it adjusts only the parameters that symptom implicates, one in-game increment at
a time. Every output value is also directly editable. Changes snap to legal increments,
are highlighted, and are logged.

**Build plan.** An ordered upgrade path per discipline with what to buy, why it sits at
that point in the order, what to watch on the Buy & Install screen, and which tuning
sliders each part unlocks. Carries qualitative viability flags only.

**Build library.** Every calculated build is saved locally, keyed by car + class +
discipline. Load one to restore its stat block. Prior builds in the same class surface in
the build plan as reference points.

**Sheet export.** Saves a standalone HTML tune card as `name_class_discipline.html`,
including any adjustments made after the baseline.

## Notes on the maths

Where community-established formulas exist, they're used: axle-load-proportional ARBs,
bump held at 0.63 × rebound, damping scaled from critical damping so heavier and
stiffer-sprung corners get more.

The build plan contains **no predicted PI, weight or horsepower figures**, deliberately.
Forza derives PI from a simulated lap rather than a formula, so no tool can honestly
predict where a set of parts lands — and the Buy & Install screen already shows live
before/after for everything as you hover. The plan supplies sequence and priority, which
the game never does; the game supplies the numbers.

Discipline constants are derived from tuning theory, not seat time. They're plain data
tables at the top of the script and are meant to be adjusted against real results.
