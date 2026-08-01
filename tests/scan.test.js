/* Constants updated 2026-08-01 from the one source that has survived this
   project's scrutiny — ForzaTune's FH6 guide, which draws explicit FH6-vs-FH5
   lines. Everything else ranking for "FH6 tuning" is farm content that
   contradicts itself (one page says AWD centre 60-70, the next 70-80).

   Changed on their FH6 numbers:
   - warm tire target: FH5's 32-34 psi -> FH6's wider 30-40 window
   - road/sprint/touge caster: 6.7 -> 6.5 (their band 5.5-6.5)
   - AWD centre neutral base: 55 -> 60 (their band 60-70)

   Deliberately NOT changed:
   - RWD decel stays low (10-15) against their 20-40: Boston's confirmed
     preference, and his feedback outranks any published source.
   - Aero balance 0.42-0.48: confirmed against his own screen (0.45 readouts).
   - bump = 0.63 x rebound: corroborated by their "around two-thirds".
   - camber -2.2F road vs their "-2.0 threshold" mention: too vague to act on. */
const { readScript, makeShim, ok } = require('./shim');
const { els, document, window, localStorage } = makeShim();
let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(readScript() + ';globalThis.__X={compute,DISC};');
const X = globalThis.__X;

const base = { name: 'x', cls: 'A', disc: 'road', wt: 3000, fw: 52, hp: 500, tq: 400, dt: 'AWD',
  gr: 6, tire: 'sport', aero: 'both', twf: 0, twr: 0, susp: 'race', arb: 'both',
  trans: 'sport', diff: 'race' };
const at = o => X.compute(Object.assign({}, base, o));

console.log('--- FH6 numbers from ForzaTune, applied ---');
ok('road caster is 6.5', X.DISC.road.cast === 6.5, X.DISC.road.cast);
ok('sprint caster is 6.5', X.DISC.sprint.cast === 6.5);
ok('touge caster is 6.5', X.DISC.touge.cast === 6.5);
ok('drift keeps its 7.0 — max caster is standard drift practice', X.DISC.drift.cast === 7.0);

const dc = fw => at({ fw }).v.dc;
ok('AWD centre lands in the 60-70 band for a typical car', dc(52) >= 60 && dc(52) <= 70, dc(52));
ok('nose-heavier pushes it further rear', dc(58) > dc(50), dc(50) + ' -> ' + dc(58));
ok('still capped at 70', dc(70) <= 70, dc(70));
ok('rally/cc centre specials untouched',
   at({ disc: 'rally', tire: 'rally', susp: 'rally' }).v.dc === 52 &&
   at({ disc: 'cc', tire: 'offroad', susp: 'offroad' }).v.dc === 50);

console.log('--- warm-psi coaching says FH6, not FH5 ---');
const HTML = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
ok('no 32-34 warm target anywhere', !/32&ndash;34 psi/.test(HTML));
ok('names the FH6 window', /30&ndash;40/.test(HTML));

console.log('--- the deliberate deviations survive ---');
ok('RWD decel stays low, against the published 20-40',
   at({ dt: 'RWD' }).v.drd <= 15, at({ dt: 'RWD' }).v.drd);
ok('bump still 0.63 x rebound', (() => { const v = at({}).v; return Math.abs(v.buF - Math.round(v.reF * 0.63 * 10) / 10) <= 0.1; })());
