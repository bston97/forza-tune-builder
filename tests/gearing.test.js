/* Final drive, solved off the game's own gearing graph.
   Reference case is a real screen (2022 Toyota GR86, A 700, 7-speed race box,
   2026-07-31): final drive 3.73, graph max 159 mph, Top Speed readout 145.4.
   Gears on that screen were 2.92 / 2.05 / 1.60 / 1.30 / 1.10 / 0.95 / 0.82,
   which is exactly SPREAD[7] — so the table is the game's own race-box values
   and the only thing to solve is the final drive. */
const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();
let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(js + ';globalThis.__X={compute,SPREAD,DISC,tireCirc};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const GR86 = { name: 'GR86', cls: 'A', disc: 'road', wt: 2900, fw: 53, hp: 350, tq: 260,
  dt: 'RWD', gr: 7, tire: 'sport', aero: 'both', twf: 0, twr: 0, susp: 'race', arb: 'both',
  trans: 'race', diff: 'race', tsize: '', rpm: NaN, vmax: NaN, vgraph: NaN, fdnow: NaN };
const at = o => X.compute(Object.assign({}, GR86, o));
const GRAPH = { vmax: 145.4, vgraph: 159, fdnow: 3.73 };

console.log('--- the gear table is the game\'s own 7-speed race box ---');
ok('SPREAD[7] matches the screen',
   JSON.stringify(X.SPREAD[7]) === JSON.stringify([2.92, 2.05, 1.60, 1.30, 1.10, 0.95, 0.82]),
   X.SPREAD[7].join(' / '));

console.log('--- graph solve ---');
let r = at(GRAPH);
ok('uses the graph path', r.fdSrc === 'graph', r.fdSrc);
// 3.73 x 159 / (145.4 x 0.95 road vFrac) = 4.29
ok('GR86 road solves to ~4.29', near(r.v.fd, 4.29, 0.02), r.v.fd);
ok('shortens the too-tall 3.73 that was on the car', r.v.fd > 3.73, '3.73 -> ' + r.v.fd);
ok('flags the dead top gear',
   /top 14 mph of gearing is dead weight/.test(r.w.join(' ')), r.gearGap.toFixed(3));

/* The whole point of the ratio form: tire size and redline cancel, so a car
   with the same graph reading solves the same however big its wheels are. */
ok('tire size does not change the answer',
   at(Object.assign({ tsize: '325/30R21', rpm: 9000 }, GRAPH)).v.fd === r.v.fd);

console.log('--- discipline targets ride on the same reading ---');
const fdFor = disc => at(Object.assign({ disc, dt: disc === 'rally' || disc === 'cc' ? 'AWD' : 'RWD' }, GRAPH)).v.fd;
const road = fdFor('road'), sprint = fdFor('sprint'), touge = fdFor('touge'), drag = fdFor('drag');
ok('sprint gears longer than road', sprint < road, road + ' -> ' + sprint);
ok('touge gears much shorter', touge > road + 1, touge);
ok('drag targets the full top speed', near(drag, 3.73 * 159 / 145.4, 0.02), drag);
ok('every discipline lands in the slider range',
   ['road', 'sprint', 'touge', 'drift', 'drag', 'rally', 'cc']
     .every(d => { const v = fdFor(d); return v >= 2 && v <= 7; }));

console.log('--- the limiter-bound guard ---');
// graph max at or below top speed means the readout is just echoing the gearing
r = at({ vmax: 159, vgraph: 159, fdnow: 3.73 });
ok('does not solve from a circular reading', r.fdSrc !== 'graph', r.fdSrc);
ok('says the car is on the limiter', r.revBound === true);
ok('warns with a way to tell which it is',
   /too close to solve from/.test(r.w.join(' ')) && /stops climbing/.test(r.w.join(' ')));
/* The loop this closes: applying the answer MAKES the car limiter-bound at
   vFrac of top speed, so a re-read trips this same guard. The warning has to
   say lengthening is a measurement, not the setting to leave it at. */
ok('says lengthening is a measurement, not the answer',
   /Lengthening is the measurement, not the answer/.test(r.w.join(' ')));
ok('tells you to put it back before reading', /put the final drive back where it was/.test(r.w.join(' ')));
// a drag-limited car sits well under its geared max; 1 mph under is not a real gap
r = at({ vmax: 158, vgraph: 159, fdnow: 3.73 });
ok('a 1 mph margin is still treated as bound', r.fdSrc !== 'graph', r.fdSrc);
r = at({ vmax: 155, vgraph: 159, fdnow: 3.73 });
ok('2.5% is a real gap', r.fdSrc === 'graph', r.fdSrc);
r = at({ vmax: 145.4, vgraph: 159, fdnow: 3.73 });
ok('a real gap solves normally', r.fdSrc === 'graph');

console.log('--- the solve does not send you round in circles ---');
/* Any real gap means over-geared, so the graph solve only ever shortens. That
   is consistent, but it means the car ends up ON the limiter at vFrac of top
   speed — the card has to say that is the intent, or the obvious next move is
   to re-read and "fix" it straight back. */
r = at(GRAPH);
ok('the solve only ever shortens', r.v.fd >= GRAPH.fdnow);
const roadCard = (() => {
  const s = (id, v) => { document.getElementById(id).value = v; };
  Object.keys(GR86).forEach(k => s(k, typeof GR86[k] === 'number' && isNaN(GR86[k]) ? '' : GR86[k]));
  s('vmax', '145.4'); s('vgraph', '159'); s('fdnow', '3.73');
  els['calc'].onclick();
  return els['out'].innerHTML;
})();
ok('card names the top speed you give up', /Top speed will then read about 138 rather than 145/.test(roadCard));
ok('card calls it the trade, not a mistake', /that is the trade, not a mistake/.test(roadCard));
ok('card says not to re-feed the new numbers', /Do not feed the new readings back in/.test(roadCard));

console.log('--- past the end of the slider ---');
// a wildly over-geared touge build wants more final drive than exists
r = at({ disc: 'touge', vmax: 100, vgraph: 260, fdnow: 4.0 });
ok('clamped into the slider range', r.v.fd === 7);
ok('says one final drive cannot fix it', /further out than one final drive can fix/.test(r.w.join(' ')));
ok('points at the gearbox instead', /fewer, shorter gears is the real fix/.test(r.w.join(' ')));
ok('a normal solve does not warn', !/further out than one final drive/.test(at(GRAPH).w.join(' ')));

console.log('--- fallbacks, in order ---');
ok('no graph numbers falls back to tire size',
   at({ tsize: '215/40R18', rpm: 8000, vmax: 145.4 }).fdSrc === 'tire');
ok('nothing at all falls back to rough', at({}).fdSrc === 'rough');
ok('partial graph numbers do not half-solve',
   at({ vgraph: 159, fdnow: 3.73 }).fdSrc === 'rough' &&
   at({ vmax: 145.4, fdnow: 3.73 }).fdSrc === 'rough' &&
   at({ vmax: 145.4, vgraph: 159 }).fdSrc === 'rough');
ok('the rough path still lands in range',
   ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'].every(cls =>
     [4, 6, 8, 10].every(gr => { const v = at({ cls, gr }).v.fd; return v >= 2 && v <= 7; })));

console.log('--- the graph is described as it actually is ---');
const set = (id, v) => { document.getElementById(id).value = v; };
Object.keys(GR86).forEach(k => set(k, isNaN(GR86[k]) && typeof GR86[k] === 'number' ? '' : GR86[k]));
set('vmax', '145.4'); set('vgraph', '159'); set('fdnow', '3.73');
els['calc'].onclick();
const page = els['out'].innerHTML;
ok('no invented power curve on the page', !/power curve/.test(page));
ok('explains the right-hand edge', /right-hand edge is the speed your <em>top gear<\/em> hits the limiter/.test(page));
ok('says the axis rescales', /axis rescales as you move the final drive/.test(page));
ok('shows the working', /3\.73 &times; 159 &divide; 138/.test(page), (page.match(/3\.73 [^<]{0,24}/) || [])[0]);
ok('names the current gap', /graph max 159 mph vs 145 mph of real top speed/.test(page));
els['save'].onclick();
const sh = blob.parts[0];
ok('no invented power curve in the sheet', !/power curve/.test(sh));
ok('sheet says it was solved off the graph', /solved off the gearing graph/.test(sh));
ok('sheet records what the graph read', /159 mph against a real top speed of 145 mph/.test(sh));
ok('sheet clean', !/undefined|NaN|\{\{/.test(sh));

console.log('--- the numbers survive a round trip ---');
els['save'].onclick();
els['lib'].onclick();
const key = encodeURIComponent(JSON.parse(localStorage.getItem('fh6lib'))[0].k);
set('vmax', ''); set('vgraph', ''); set('fdnow', '');
els['out'].fire('click', { target: { dataset: { load: key } } });
ok('graph inputs come back on Load',
   String(els['vmax'].value) === '145.4' && String(els['vgraph'].value) === '159' &&
   String(els['fdnow'].value) === '3.73',
   [els['vmax'].value, els['vgraph'].value, els['fdnow'].value].join(' / '));
els['newcar'].onclick();
ok('New car clears them', els['vmax'].value === '' && els['vgraph'].value === '' && els['fdnow'].value === '');
