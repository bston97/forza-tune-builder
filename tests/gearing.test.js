/* Final drive, off the game's gearing graph.

   What that graph is, corrected 2026-07-31 against Boston's screen after an
   earlier version of this file encoded the opposite: rpm up the side, mph along
   the bottom, one straight line per gear, and **the bottom axis does not
   rescale**. Its range is a property of the car, so gears geared taller than
   the chart run off the right-hand end and are not drawn.

   Observed on a 2022 GR86, A 700, 7-speed race box at final drive 3.73: axis
   reading 159 mph, no 7th gear visible at all, only the tail of 6th. Consistent
   with 6th ending at the edge and 7th at 159 x 0.95/0.82 = 184 mph, well past
   it — and with the gear-endpoint spacing measured off the photo.

   So the reading is visual and needs no arithmetic: sweep the final drive until
   the top gear's line just reaches the edge. At that setting top gear redlines
   at the car's maximum usable speed, and since speed at redline goes as 1/FD,
   gearing to vFrac of that maximum is FD = fdFit / vFrac. */
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
  trans: 'race', diff: 'race', tsize: '', rpm: NaN, vmax: NaN, fdfit: NaN };
const at = o => X.compute(Object.assign({}, GR86, o));

console.log('--- the gear table is the game\'s own 7-speed race box ---');
ok('SPREAD[7] matches the screen',
   JSON.stringify(X.SPREAD[7]) === JSON.stringify([2.92, 2.05, 1.60, 1.30, 1.10, 0.95, 0.82]),
   X.SPREAD[7].join(' / '));

console.log('--- the fit solve ---');
let r = at({ fdfit: 4.72 });
ok('uses the fit path', r.fdSrc === 'fit', r.fdSrc);
ok('road shortens the fit by vFrac', near(r.v.fd, 4.72 / 0.95, 0.01), r.v.fd);
ok('always at least as short as the fit', r.v.fd >= 4.72);
ok('needs no tire size or top speed',
   at({ fdfit: 4.72, tsize: '325/30R21', rpm: 9000, vmax: 200 }).v.fd === r.v.fd);

console.log('--- discipline targets ride on the same fit ---');
const fdFor = disc => at({ fdfit: 4.72, disc,
  dt: disc === 'rally' || disc === 'cc' ? 'AWD' : 'RWD' }).v.fd;
ok('drag gears exactly to the fit', near(fdFor('drag'), 4.72, 0.01), fdFor('drag'));
ok('sprint gears longer than road', fdFor('sprint') < fdFor('road'),
   fdFor('road') + ' -> ' + fdFor('sprint'));
ok('touge gears much shorter', fdFor('touge') > fdFor('road') + 1, fdFor('touge'));
ok('every discipline lands in the slider range',
   ['road', 'sprint', 'touge', 'drift', 'drag', 'rally', 'cc']
     .every(d => { const v = fdFor(d); return v >= 2 && v <= 7; }));

console.log('--- past the end of the slider ---');
r = at({ disc: 'cc', dt: 'AWD', tire: 'offroad', susp: 'offroad', fdfit: 6.4 });
ok('clamped into the slider range', r.v.fd === 7);
ok('says one final drive cannot fix it', /Further out than one final drive can fix/.test(r.w.join(' ')));
ok('points at the gearbox instead', /fewer, shorter gears is the real fix/.test(r.w.join(' ')));
ok('a normal fit does not warn', !/further out than one final drive/i.test(at({ fdfit: 4.72 }).w.join(' ')));

console.log('--- the guess is called a guess, loudly ---');
/* The failure that shipped: the field sat in a collapsed block, stayed blank,
   and the only hint that the number was extrapolated was body text under it. */
r = at({});
ok('no fit given falls back to rough', r.fdSrc === 'rough');
ok('warns at the top of the card, not in the notes',
   /final drive below is a guess, not a tune/.test(r.w.join(' ')));
ok('names the real failure it caused', /3\.73 where the real answer was nearer 4\.7/.test(r.w.join(' ')));
ok('tells you the one sweep that fixes it',
   /top gear's line just reaches the right-hand edge/.test(r.w.join(' ')));
ok('a solved build does not carry the warning',
   !/is a guess, not a tune/.test(at({ fdfit: 4.72 }).w.join(' ')));
ok('a stock gearbox does not nag about it',
   !/is a guess, not a tune/.test(at({ trans: 'stock' }).w.join(' ')));

console.log('--- fallbacks, in order ---');
ok('tire size solves when no fit is given',
   at({ tsize: '215/40R18', rpm: 8000, vmax: 145.4 }).fdSrc === 'tire');
ok('the fit beats the tire solve',
   at({ fdfit: 4.72, tsize: '215/40R18', rpm: 8000, vmax: 145.4 }).fdSrc === 'fit');
ok('the rough path still lands in range',
   ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'].every(cls =>
     [4, 6, 8, 10].every(gr => { const v = at({ cls, gr }).v.fd; return v >= 2 && v <= 7; })));

console.log('--- dead top gears get called out ---');
ok('7-speed shortened from its fit is flagged',
   /Worth counting your gears/.test(at({ fdfit: 4.72 }).w.join(' ')));
ok('a 6-speed is not', !/Worth counting your gears/.test(at({ gr: 6, fdfit: 4.72 }).w.join(' ')));
ok('drag, geared exactly to the fit, is not',
   !/Worth counting your gears/.test(at({ disc: 'drag', tire: 'dragt', fdfit: 4.72 }).w.join(' ')));

console.log('--- per-gear limiter speeds, from the fit plus the axis maximum ---');
/* Confirmed end to end on the reference car: k = 159 x 4.575 x 0.82 = 596.5,
   which puts 5th at final drive 3.73 at 145.4 mph — exactly the Top Speed the
   game reported for that setup. The car was rev-limited in 5th with 6th (168)
   and 7th (195) both past the 159 mph axis and therefore unreachable. */
const K = 159 * 4.575 * 0.82;
ok('k from the reference screen', near(K, 596.5, 0.1), K.toFixed(1));
ok('5th at fd 3.73 reproduces the 145.4 mph readout',
   near(K / (3.73 * 1.10), 145.4, 0.1), (K / (3.73 * 1.10)).toFixed(2));
ok('6th at fd 3.73 sits past the 159 axis', K / (3.73 * 0.95) > 159, (K / (3.73 * 0.95)).toFixed(1));
ok('7th at fd 3.73 sits far past it', K / (3.73 * 0.82) > 190, (K / (3.73 * 0.82)).toFixed(1));

r = at({ fdfit: 4.575, vgraph: 159 });
ok('gear speeds computed', Array.isArray(r.gearTop) && r.gearTop.length === 7);
ok('top gear lands at vFrac of the axis maximum',
   near(r.gearTop[6], 159 * 0.95, 0.5), r.gearTop[6].toFixed(1));
ok('every gear is reachable at the solved final drive',
   r.gearTop.every(v => v <= 159), r.gearTop.map(v => Math.round(v)).join('/'));
ok('speeds fall in gear order', r.gearTop.every((v, n) => n === 0 || v > r.gearTop[n - 1]));
ok('drag gears the top gear right to the axis maximum',
   near(at({ disc: 'drag', tire: 'dragt', fdfit: 4.575, vgraph: 159 }).gearTop[6], 159, 0.5));
ok('no axis maximum means no speeds, not wrong speeds', at({ fdfit: 4.575 }).gearTop === null);
ok('no fit means no speeds', at({ vgraph: 159 }).gearTop === null);

console.log('--- the model states a falsifiable prediction and checks itself ---');
r = at({ fdfit: 4.575, vgraph: 159 });
ok('predicts a top speed', near(r.topPredict, 159 * 0.95, 0.5), r.topPredict.toFixed(1));
ok('drag predicts the full axis maximum',
   near(at({ disc: 'drag', tire: 'dragt', fdfit: 4.575, vgraph: 159 }).topPredict, 159, 0.5));
ok('never predicts past the axis maximum',
   at({ disc: 'drag', tire: 'dragt', fdfit: 4.0, vgraph: 159 }).topPredict <= 159);
// a measured top speed that contradicts the model is called out, not absorbed
r = at({ fdfit: 4.575, vgraph: 159, vmax: 120 });
ok('flags a top speed the model cannot explain',
   /do not agree with your top speed/.test(r.w.join(' ')));
ok('offers the innocent explanation first',
   /measured at a different final drive/.test(r.w.join(' ')));
ok('says to distrust the section, not work around it',
   /distrusted until it is checked/.test(r.w.join(' ')));
ok('an agreeing top speed passes quietly',
   !/do not agree with your top speed/.test(at({ fdfit: 4.575, vgraph: 159, vmax: 159 }).w.join(' ')));
ok('no axis maximum means no check to fail',
   !/do not agree with your top speed/.test(at({ fdfit: 4.575, vmax: 100 }).w.join(' ')));

console.log('--- the graph is described as it actually behaves ---');
const set = (id, v) => { document.getElementById(id).value = v; };
Object.keys(GR86).forEach(k => set(k, typeof GR86[k] === 'number' && isNaN(GR86[k]) ? '' : GR86[k]));
set('fdfit', '4.72');
els['calc'].onclick();
const page = els['out'].innerHTML;
ok('gear list shows speeds when the axis maximum is known', !/to \d+ mph/.test(page));
set('vgraph', '159'); set('fdfit', '4.575'); els['calc'].onclick();
const withMph = els['out'].innerHTML;
ok('speeds appear beside the ratios', /to 151 mph/.test(withMph),
   (withMph.match(/to \d+ mph/g) || []).join(' '));
ok('all seven gears annotated', (withMph.match(/to \d+ mph/g) || []).length === 7);
ok('card invites the check', /Check me on this/.test(withMph));
ok('card names the top speed to expect', /Top Speed of about <b>151 mph<\/b>/.test(withMph));
ok('card says what a mismatch means', /the model behind every number in this section is wrong/.test(withMph));
els['save'].onclick();
ok('sheet carries the speeds too', /class="gear-mph">151</.test(blob.parts[0]));
set('vgraph', ''); set('fdfit', '4.72'); els['calc'].onclick();
ok('no invented power curve', !/power curve/.test(page));
ok('says the axis does NOT rescale', /bottom axis does not rescale/.test(page));
ok('explains that tall gears run off the end', /runs off the right-hand end and is simply not drawn/.test(page));
ok('does not claim the last gear always touches the edge',
   !/last gear always touches/.test(page) && !/axis rescales as you move/.test(page));
ok('shows the working', /4\.72 &divide; 0\.95/.test(page));
ok('explains the deliberate shortfall', /stop just short of the edge/.test(page));
els['save'].onclick();
const sh = blob.parts[0];
ok('sheet does not invent a power curve', !/power curve/.test(sh));
ok('sheet says the axis is fixed', /bottom axis does not rescale/.test(sh));
ok('sheet says it was solved off the graph', /solved off the graph/.test(sh));
ok('sheet clean', !/undefined|NaN|\{\{/.test(sh));

console.log('--- the fit survives a round trip ---');
els['save'].onclick();
els['lib'].onclick();
const key = encodeURIComponent(JSON.parse(localStorage.getItem('fh6lib'))[0].k);
set('fdfit', '');
els['out'].fire('click', { target: { dataset: { load: key } } });
ok('fit comes back on Load', String(els['fdfit'].value) === '4.72', els['fdfit'].value);
els['newcar'].onclick();
ok('New car clears it', els['fdfit'].value === '');

console.log('--- the gearing block is not hidden any more ---');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok('details block opens by default', /<details id="extra" open>/.test(html));
ok('the fit field is inside it', /id="fdfit"/.test(html));
