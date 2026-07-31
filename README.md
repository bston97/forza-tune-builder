# Tune Goon

A single-file tuning calculator for Forza Horizon 6. Enter a car's stat block, get a
complete tune in Forza tuning-menu order, fix what the car actually did on track, and
export a sheet.

Live at **https://bston97.github.io/tune-goon/** — installable to a phone home screen and
works offline once loaded.

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

Final drive is solved off the game's own gearing graph. That graph plots rpm against
speed, one straight line per gear, and its x-axis maximum is the speed at which the *top*
gear meets the limiter — so reading three numbers from that one screen (top speed, graph
max, current final drive) gives `FD_new = FD_now × graphMax / (topSpeed × vFrac)`, with
tire circumference and redline cancelling out entirely. Falls back to a tire-size solve,
then to a power-to-weight estimate, when those aren't supplied.

The one catch it guards: the Top Speed readout is only the car's drag-limited maximum
while the gearing can out-run it. Once the car is on the limiter that readout just echoes
the gearing back, so a limiter-bound reading is refused rather than solved from.

**Fine-tuning.** After driving, pick what the car did from a symptom list (understeer on
turn-in, wheelspin on exit, bottoming out, tires cooking, hits the limiter early — 23 in
all) and it adjusts only the parameters that symptom implicates, one in-game increment at
a time. Every output value is also directly editable. Changes snap to legal increments,
are highlighted, and are logged.

**Build plan.** An ordered upgrade path per discipline with what to buy, why it sits at
that point in the order, what to watch on the Buy & Install screen, and which tuning
sliders each part unlocks. Carries qualitative viability flags only.

**Build library.** Saving a sheet files the build locally, keyed by car + class +
discipline — calculating alone stays throwaway, so you can try things freely. Load one to
restore its stat block. Prior builds in the same class surface in the build plan as
reference points.

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
