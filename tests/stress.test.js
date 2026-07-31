const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

const URL = { createObjectURL: () => 'x', revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(js + ';globalThis.__X={compute,VMETA,DISC,fmt,sheet,eff,get BASE(){return BASE}};');
const X = globalThis.__X;

/* Real Forza slider limits, independent of my VMETA table — these are what the
   game will actually accept. Anything outside is a bug in the calculator. */
const GAME = {
  pF:[10,55], pR:[10,55], fd:[2.0,7.0],
  camF:[-10,10], camR:[-10,10], toeF:[-12,12], toeR:[-12,12], cast:[1,10],
  arF:[1,65], arR:[1,65],
  rhF:[0,100], rhR:[0,100],
  reF:[1,20], reR:[1,20], buF:[1,20], buR:[1,20],
  aeF:[0,100], aeR:[0,100],
  bal:[0,100], pres:[0,200],
  dfa:[0,100], dfd:[0,100], dra:[0,100], drd:[0,100], dc:[0,100]
};

const CLS = ['D','C','B','A','S1','S2','R','X'];
const DIS = ['road','sprint','touge','drift','drag','rally','cc'];
const DT  = ['RWD','AWD','FWD'];
const TIRE= ['stock','street','sport','semi','slick','rally','offroad','dragt'];
const AERO= ['none','rear','both'];

let n = 0, problems = [];
function checkBuild(i, tag) {
  n++;
  let r;
  try { r = X.compute(i); }
  catch (err) { problems.push(tag + ' :: THREW ' + err.message); return; }
  for (const k in r.v) {
    const v = r.v[k];
    if (v === null) continue;
    if (!isFinite(v)) { problems.push(tag + ' :: ' + k + ' = ' + v); continue; }
    const g = GAME[k];
    if (g && (v < g[0] - 1e-9 || v > g[1] + 1e-9))
      problems.push(tag + ' :: ' + k + ' = ' + v + ' outside game range [' + g[0] + ',' + g[1] + ']');
  }
  // bump must never exceed rebound (would be nonsense damping)
  if (r.v.buF > r.v.reF + 1e-9) problems.push(tag + ' :: bumpF ' + r.v.buF + ' > reboundF ' + r.v.reF);
  if (r.v.buR > r.v.reR + 1e-9) problems.push(tag + ' :: bumpR ' + r.v.buR + ' > reboundR ' + r.v.reR);
  return r;
}

console.log('=== full combinatorial sweep (realistic stats) ===');
for (const cls of CLS) for (const disc of DIS) for (const dt of DT) for (const aero of AERO) {
  checkBuild({ name: 'X', cls, disc, dt, aero, wt: 3000, fw: 52, hp: 500, tq: 400,
    gr: 6, tire: 'sport', twf: NaN, twr: NaN },
    [cls, disc, dt, aero].join('/'));
}
console.log(n + ' builds checked');

console.log('\n=== extremes ===');
const EX = [
  ['featherweight',   { wt: 1200, fw: 45, hp: 120, tq: 90 }],
  ['ultra-light+huge power', { wt: 1400, fw: 42, hp: 1500, tq: 1100 }],
  ['heavy truck',     { wt: 7000, fw: 58, hp: 400, tq: 600 }],
  ['heavy + no power',{ wt: 6500, fw: 60, hp: 150, tq: 200 }],
  ['extreme nose-heavy', { wt: 3400, fw: 78, hp: 500, tq: 400 }],
  ['extreme tail-heavy', { wt: 2400, fw: 22, hp: 500, tq: 400 }],
  ['massive torque',  { wt: 3800, fw: 50, hp: 900, tq: 1800 }],
  ['tiny torque',     { wt: 2000, fw: 50, hp: 90,  tq: 60  }],
  ['R-class proto',   { wt: 2100, fw: 46, hp: 1000, tq: 700 }],
  ['X-class absurd',  { wt: 2000, fw: 45, hp: 3000, tq: 2200 }],
];
for (const [tag, o] of EX) {
  for (const disc of DIS) {
    const cls = tag.includes('X-class') ? 'X' : tag.includes('R-class') ? 'R' : 'A';
    checkBuild(Object.assign({ name: 'X', cls, disc, dt: 'AWD', aero: 'both', gr: 6,
      tire: 'sport', twf: NaN, twr: NaN }, o), tag + '/' + disc);
  }
}
console.log((n) + ' cumulative builds checked');

console.log('\n=== gear counts x disciplines ===');
for (let g = 4; g <= 10; g++) for (const disc of DIS) {
  const r = checkBuild({ name: 'X', cls: 'S1', disc, dt: 'RWD', aero: 'rear', wt: 3000, fw: 50,
    hp: 700, tq: 550, gr: g, tire: 'slick', twf: NaN, twr: NaN }, g + 'spd/' + disc);
  if (r && r.gears.length !== g) problems.push(g + 'spd/' + disc + ' :: gear list length ' + r.gears.length);
}

console.log('\n=== tire compounds ===');
for (const tire of TIRE) for (const disc of DIS) {
  checkBuild({ name: 'X', cls: 'A', disc, dt: 'AWD', aero: 'none', wt: 3000, fw: 52, hp: 500,
    tq: 400, gr: 6, tire, twf: NaN, twr: NaN }, tire + '/' + disc);
}

console.log('\n=== tire width deltas (brake balance) ===');
for (const [f, rr] of [[0,0],[0,2],[2,0],[0,4],[4,0]]) {
  const r = checkBuild({ name: 'X', cls: 'A', disc: 'road', dt: 'RWD', aero: 'rear', wt: 3000,
    fw: 52, hp: 500, tq: 400, gr: 6, tire: 'sport', twf: f, twr: rr },
    'width step ' + f + '/' + rr);
  if (r) console.log('  F+' + f + ' R+' + rr + ' -> brake ' + r.v.bal + '% front');
}

console.log('\n=== TOTAL: ' + n + ' builds ===');
if (problems.length) {
  console.log('\n!!! ' + problems.length + ' PROBLEM(S):');
  problems.slice(0, 40).forEach(p => console.log('FAIL  ' + p));
} else {
  console.log('PASS  ' + n + ' builds swept, no out-of-range, non-finite, or nonsensical values found');
}
