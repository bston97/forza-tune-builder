/* Boston's measured final-drive sweep, held as a fixture so any future change
   to vFrac has to answer to it before it ships.

   The failure this exists to prevent happened twice. vFrac was set to 0.95 by
   guesswork (pushing toward 4.82, the worst setting measured) and then to 1.14
   by fitting whichever setting won 0-100 — a 0.035s margin inside a range that
   spans 0.12s. Both times the number went out untested against data that was
   already sitting in the repo.

   What this does NOT do is simulate. The performance figures cannot be
   reverse-engineered from what we have: at 3.50 and 4.82 the engine sits at
   7551 and 7516 rpm at top speed — 0.5% apart — while the drag those speeds
   imply differs by 9.7%. A single engine speed cannot make 10% more power, so
   either the derived constants are off or the game's Top Speed readout is not
   a physical equilibrium. Six points on one car underdetermine the model, and
   even a good fit would be this car's fit, not a general one.

   So: no simulator. Just a fixture that says "whatever you set vFrac to, the
   number it produces for this car must be one the game actually liked." */
const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(readScript() + ';globalThis.__X={compute,SPREAD};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));

/* 2022 Toyota GR86, A 700, 7-speed race box, ratios at the game's defaults,
   final drive the only variable. Read off the Performance panel 2026-07-31.
   Fit (top gear finishing in the graph's top-right corner) = 4.575, axis = 157. */
const SWEEP = [
  { fd: 4.82, s60: 3.040, s100: 8.723, top: 140.0 },
  { fd: 4.58, s60: 3.056, s100: 8.636, top: 141.4 },
  { fd: 4.30, s60: 3.088, s100: 8.671, top: 142.7 },
  { fd: 4.00, s60: 3.104, s100: 8.601, top: 143.5 },
  { fd: 3.73, s60: 3.088, s100: 8.671, top: 143.8 },
  { fd: 3.50, s60: 3.153, s100: 8.671, top: 144.4 },
];
const FIT = 4.575, AXIS = 157;
const CAR = { name: 'GR86', cls: 'A', disc: 'road', wt: 2900, fw: 53, hp: 350, tq: 260,
  dt: 'RWD', gr: 7, tire: 'sport', aero: 'both', twf: 0, twr: 0, susp: 'race', arb: 'both',
  trans: 'race', diff: 'race', tsize: '', rpm: NaN, vmax: NaN, fdfit: FIT, vgraph: AXIS };

/* Rank each measured setting 1..6 on all three figures and sum. Equal weight is
   crude, but it is honest about the fact that no single metric decides a lap. */
const rank = (key, lower) => {
  const sorted = SWEEP.map(r => r[key]).slice().sort((a, b) => lower ? a - b : b - a);
  return Object.fromEntries(SWEEP.map(r => [r.fd, sorted.indexOf(r[key]) + 1]));
};
const r60 = rank('s60', true), r100 = rank('s100', true), rTop = rank('top', false);
const score = fd => r60[fd] + r100[fd] + rTop[fd];
const nearest = v => SWEEP.reduce((a, b) => Math.abs(b.fd - v) < Math.abs(a.fd - v) ? b : a).fd;

console.log('--- the measured sweep, scored ---');
SWEEP.forEach(r => console.log('   fd ' + r.fd.toFixed(2) + '  0-60 ' + r.s60.toFixed(3) +
  '  0-100 ' + r.s100.toFixed(3) + '  top ' + r.top.toFixed(1) +
  '   ranks ' + r60[r.fd] + '/' + r100[r.fd] + '/' + rTop[r.fd] + '  = ' + score(r.fd)));
ok('no setting wins all three', !SWEEP.some(r => score(r.fd) === 3),
   'best possible is 3, actual best is ' + Math.min(...SWEEP.map(r => score(r.fd))));
ok('the whole range is inside 0.13s on 0-60',
   Math.max(...SWEEP.map(r => r.s60)) - Math.min(...SWEEP.map(r => r.s60)) < 0.13);
ok('and inside 0.13s on 0-100',
   Math.max(...SWEEP.map(r => r.s100)) - Math.min(...SWEEP.map(r => r.s100)) < 0.13);

console.log('\n--- what the app recommends must be a setting the game liked ---');
const got = X.compute(Object.assign({}, CAR)).v.fd;
const match = nearest(got);
console.log('   app says ' + got.toFixed(2) + ', nearest measured setting ' + match.toFixed(2) +
  ' (score ' + score(match) + ' of a possible 3-18)');
ok('the recommendation is inside the measured range', got >= 3.50 && got <= 4.82, got);
ok('it lands on a top-half setting, not the worst', score(match) <= 10, 'score ' + score(match));
ok('specifically, not 4.82 — the worst measured', match !== 4.82,
   '4.82 scored ' + score(4.82) + ', the worst of the six');

/* The tie-breaker that settled road at 1.00: at the fit every gear engages. */
const usesAll = fd => {
  const K = AXIS * FIT * X.SPREAD[7][6];
  const tops = X.SPREAD[7].map(g => K / (fd * g));
  const top = SWEEP.reduce((a, b) => Math.abs(b.fd - fd) < Math.abs(a.fd - fd) ? b : a).top;
  return tops.findIndex(s => s >= top) + 1 === 7;
};
ok('the recommended setting engages every gear', usesAll(got), got);
ok('the 0-100 winner does not', !usesAll(4.00),
   '4.00 wins 0-100 by 0.035s but tops out in 6th');

console.log('\n--- the gear-speed model, which IS reverse-engineered and does hold ---');
/* k/(FD x G) was derived from the fit and checked against the graph and against
   an independent readout. Unlike the performance figures it is pure kinematics,
   so it generalises to any car. */
const K = AXIS * FIT * X.SPREAD[7][6];
ok('k from the fit and the axis', Math.abs(K - 589) < 1, K.toFixed(1));
ok('predicts the 145.4 mph readout at fd 3.73 in 5th',
   Math.abs(K / (3.73 * 1.10) - 145.4) < 2.0, (K / (3.73 * 1.10)).toFixed(1));
[[1, 2.92, 42.3], [2, 2.05, 59.3], [3, 1.60, 76.3], [4, 1.30, 93.8],
 [5, 1.10, 111.3], [6, 0.95, 128.8], [7, 0.82, 148.1]].forEach(([n, g, measured]) => {
  const pred = K / (4.82 * g);
  ok('gear ' + n + ' matches the graph within 2%', Math.abs(pred / measured - 1) < 0.02,
     'predicted ' + pred.toFixed(1) + ' vs ' + measured + ' measured off the chart');
});
