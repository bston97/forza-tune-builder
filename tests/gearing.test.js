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

   So the reference point is visual and needs no arithmetic: sweep the final
   drive until the top gear's line just reaches the edge. Call that fdFit; since
   speed at redline goes as 1/FD, the setting is FD = fdFit / vFrac.

   The edge is NOT a speed the car can reach — measured, it tops out ~13 mph
   short of it — so vFrac above 1.0 (gearing past the edge) is normal and the
   road value is 1.14, measured off the Performance panel rather than guessed.
   See CLAUDE.md for the sweep table that produced it. */
const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();
let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(js + ';globalThis.__X={compute,SPREAD,DISC};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const GR86 = { name: 'GR86', cls: 'A', disc: 'road', wt: 2900, fw: 53, hp: 350, tq: 260,
  dt: 'RWD', gr: 7, tire: 'sport', aero: 'both', twf: 0, twr: 0, susp: 'race', arb: 'both',
  trans: 'race', diff: 'race', vmax: NaN, fdfit: NaN };
const at = o => X.compute(Object.assign({}, GR86, o));

console.log('--- the gear table is the game\'s own 7-speed race box ---');
/* Boston asked whether the fit is measured with the app's ratios or the game's
   defaults. They are the same table — the app never asks for ratios, only for
   the final drive — and only the TOP ratio affects the fit, since that is the
   line whose endpoint lands in the corner. */
ok('the app never asks for individual ratios',
   !/id="g[1-9]"|id="gear[1-9]"/.test(require('fs').readFileSync(
     require('path').join(__dirname, '..', 'index.html'), 'utf8')));
ok('SPREAD[7] matches the screen',
   JSON.stringify(X.SPREAD[7]) === JSON.stringify([2.92, 2.05, 1.60, 1.30, 1.10, 0.95, 0.82]),
   X.SPREAD[7].join(' / '));

console.log('--- the fit solve ---');
/* Road is 1.00 — gear at the fit. The GR86 sweep spread 0-60 by 0.113s, 0-100
   by 0.122s and top speed by 4.4 mph across 3.50-4.82 with no setting
   dominating, so picking the 0-100 winner (4.00, by 0.035s) was overfitting to
   noise. What breaks the tie is that the fit engages every gear while 4.00
   leaves the 7th ratio doing nothing. Same lap time, one uses what you bought. */
let r = at({ fdfit: 4.575 });
ok('uses the fit path', r.fdSrc === 'fit', r.fdSrc);
ok('road gears at the fit', near(r.v.fd, 4.575, 0.01), r.v.fd);
ok('and the fit is inside the measured flat zone', r.v.fd >= 3.50 && r.v.fd <= 4.82, r.v.fd);
ok('needs no tire size or top speed',
   at({ fdfit: 4.575, vmax: 200 }).v.fd === r.v.fd);

console.log('--- discipline targets ride on the same fit ---');
const fdFor = disc => at({ fdfit: 4.575, disc,
  dt: disc === 'rally' || disc === 'cc' ? 'AWD' : 'RWD' }).v.fd;
ok('drag gears longest of all', fdFor('drag') <= Math.min(...['road','sprint','touge','drift','rally','cc'].map(fdFor)),
   fdFor('drag'));
ok('sprint gears longer than road', fdFor('sprint') < fdFor('road'),
   fdFor('road') + ' -> ' + fdFor('sprint'));
ok('touge gears much shorter', fdFor('touge') > fdFor('road') + 1, fdFor('touge'));
ok('every discipline lands in the slider range',
   ['road', 'sprint', 'touge', 'drift', 'drag', 'rally', 'cc']
     .every(d => { const v = fdFor(d); return v >= 2 && v <= 7; }));
ok('the band brackets the recommendation',
   r.fdBand[0] < r.v.fd && r.fdBand[1] > r.v.fd, r.fdBand.join(' - '));
ok('the band spans roughly the measured flat zone',
   near(r.fdBand[1] / r.fdBand[0], 1.06 / 0.81, 0.05), (r.fdBand[1] / r.fdBand[0]).toFixed(3));

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
   /top gear's line finishes in the top-right corner/.test(r.w.join(' ')));
ok('a solved build does not carry the warning',
   !/is a guess, not a tune/.test(at({ fdfit: 4.72 }).w.join(' ')));
ok('a stock gearbox does not nag about it',
   !/is a guess, not a tune/.test(at({ trans: 'stock' }).w.join(' ')));

console.log('--- two paths only: the fit, or an admitted guess ---');
/* The tire-size + redline solve was removed 2026-07-31. It wanted three numbers
   off in-game screens to produce a worse answer than the fit's one, and you
   have to be in the tuning menu to apply a final drive either way. */
ok('only two sources exist', ['fit', 'rough'].includes(at({}).fdSrc) &&
   ['fit', 'rough'].includes(at({ fdfit: 4.575 }).fdSrc));
ok('the removed inputs no longer affect anything',
   at({ tsize: '215/40R18', rpm: 8000, vmax: 145.4 }).fdSrc === 'rough');
ok('and the form no longer asks for it',
   !/id="tsize"|id="rpm"/.test(require('fs').readFileSync(
     require('path').join(__dirname, '..', 'index.html'), 'utf8')));
ok('the rough path still lands in range',
   ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'].every(cls =>
     [4, 6, 8, 10].every(gr => { const v = at({ cls, gr }).v.fd; return v >= 2 && v <= 7; })));


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
ok('top gear finishes on the axis maximum',
   near(r.gearTop[6], 159, 1), r.gearTop[6].toFixed(1));
/* Deliberately past the end of the chart now — the car cannot reach the axis
   maximum anyway, so gearing to it throws away the top of the box. */
ok('top gear lands on the chart edge, not past it', Math.abs(r.gearTop[6] - 159) < 1,
   r.gearTop.map(v => Math.round(v)).join('/'));
ok('speeds fall in gear order', r.gearTop.every((v, n) => n === 0 || v > r.gearTop[n - 1]));
ok('drag reaches furthest past the axis',
   at({ disc: 'drag', tire: 'dragt', fdfit: 4.575, vgraph: 159 }).gearTop[6] > r.gearTop[6]);

console.log('--- a gear earns its place by being reached, not by fitting the chart ---');
/* You shift into gear N where gear N-1 runs out, so the test is that speed
   against top speed — independent of whether the line fits on the axis. The
   verdict belongs beside the ratio it is about, not in five sentences of red
   above it: the warning strip is for things that are wrong, and a gear you
   cannot reach is just a fact about the build. */
r = at({ fdfit: 4.575, vgraph: 157, vmax: 141.5 });
ok('at the fit every gear engages', r.topsIn === 7, r.topsIn);
ok('no red warning for it', !r.w.join(' ').includes('never engage'));
ok('drag, geared long, runs out lower down',
   at({ disc: 'drag', tire: 'dragt', fdfit: 4.575, vgraph: 157, vmax: 141.5 }).topsIn <= 6);
ok('a car that reaches everything tops out in top gear',
   at({ fdfit: 4.575, vgraph: 157, vmax: 200 }).topsIn === 7);
ok('no top speed means no verdict', at({ fdfit: 4.575, vgraph: 157 }).topsIn === null);
ok('no axis maximum means no verdict either', at({ fdfit: 4.575, vmax: 141.5 }).topsIn === null);

console.log('--- top gear\'s limiter is a ceiling, not a predicted top speed ---');
/* Measured 2026-07-31 at final drive 4.82: top gear redlined at 148 mph and
   the car did 140.0, because by then the engine is past peak power. A previous
   revision printed the ceiling as the predicted top speed and was out by 11. */
r = at({ fdfit: 4.575, vgraph: 159 });
ok('exposes a ceiling', near(r.topCeil, 159, 1), r.topCeil.toFixed(1));
ok('a top speed under the ceiling is normal, not an error',
   !/does not add up/.test(at({ fdfit: 4.575, vgraph: 159, vmax: 140 }).w.join(' ')));
ok('a top speed above the ceiling is impossible and flagged',
   /Something does not add up in the gearing inputs/.test(
     at({ fdfit: 4.575, vgraph: 159, vmax: 200 }).w.join(' ')));
ok('the flag names the likely cause',
   /read at a <em>different<\/em> final drive than this one/.test(
     at({ fdfit: 4.575, vgraph: 159, vmax: 200 }).w.join(' ')));
ok('no axis maximum means no ceiling to check',
   !/does not add up/.test(at({ fdfit: 4.575, vmax: 300 }).w.join(' ')));

console.log('--- the card leads with the setting, not an essay ---');
/* What shipped before this: a 179 mph figure beside 7th on a car doing 141,
   under 450 words of prose arguing with itself. The number is what gets read. */
const set = (id, v) => { document.getElementById(id).value = v; };
const draw = o => {
  Object.keys(GR86).forEach(k => set(k, typeof GR86[k] === 'number' && isNaN(GR86[k]) ? '' : GR86[k]));
  Object.keys(o).forEach(k => set(k, o[k]));
  els['calc'].onclick();
  return els['out'].innerHTML;
};
const gearBlock = h => (h.match(/<div class="gears">[\s\S]*?<\/div><\/div>/) || [''])[0];
const words = h => { const g = h.indexOf('>Gearing</h3>'), n = h.indexOf('<div class="sec"', g);
  return h.slice(g, n).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length; };

const full = draw({ fdfit: '4.58', vgraph: '157', vmax: '141.5' });
ok('opens with the number to set', /<b>Set 4\.58<\/b>/.test(full));
/* Road is 1.00, so there is no division to show — dressing "x ÷ 1.00" up as a
   calculation invites Boston's fair question of why he is typing a number in
   just to have it handed back. Say plainly that the fit is the setting, and
   what the input actually buys (the gear list). */
ok('does not fake a calculation at vFrac 1.00', !/&divide; 1\.00/.test(full));
ok('says the fit is the setting', /your fit unchanged/.test(full));
ok('says what the fit is really for', /What the fit buys you is the gear list/.test(full));
ok('a discipline that does scale still shows the working',
   /4\.58 &divide; 0\.76/.test(draw({ disc: 'touge', fdfit: '4.58', vgraph: '157', vmax: '' })));
ok('offers the sweep band', /sweep <b>3\.\d\d&ndash;4\.\d\d<\/b>/.test(full),
   (full.match(/sweep <b>[\d.]+&ndash;[\d.]+<\/b>/) || [])[0]);
ok('hands the decision to the Performance panel', /let the Performance panel decide/.test(full));
ok('marks where the car runs out', /tops out here, 142 mph/.test(gearBlock(full)));
/* At the fit every gear engages — which is the whole reason road is 1.00.
   Boston: "if 7th is never used why would you not adjust the gears so it is". */
ok('at the fit nothing is marked unused', !/never used/.test(gearBlock(full)),
   gearBlock(full).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
ok('and it says so', /Every gear comes in, and the car runs out in 7th/.test(full));
ok('the whole section stays short', words(full) < 170, words(full) + ' words');

// a car that runs out far below its gearing still gets the honest verdict
const dead = draw({ fdfit: '4.58', vgraph: '157', vmax: '120' });
ok('marks the gear that never comes in', /never used/.test(gearBlock(dead)));
ok('does NOT print a speed the car cannot reach', !/157 mph/.test(gearBlock(dead)),
   gearBlock(dead).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
ok('names the last usable gear', /<b>6th is your last usable gear\.<\/b>/.test(dead));
ok('says gearing shorter is the first move', /Gearing shorter brings it in/.test(dead));
ok('and the shorter box only as the fallback', /a 6-speed drives the same for less PI/.test(dead));
ok('notes it costs PI, not lap time',
   /final drive cannot change the rpm drop per shift/.test(dead));

const noTop = draw({ fdfit: '4.58', vgraph: '157', vmax: '' });
ok('without top speed it still lists limiter speeds', /to 157 mph/.test(gearBlock(noTop)));
ok('and asks for the one number that would sharpen it',
   /Add <b>Top speed at that setting<\/b>/.test(noTop));
ok('but claims nothing about which gears are used',
   !/never used|last usable gear/.test(noTop));

const guess = draw({ fdfit: '', vgraph: '', vmax: '' });
ok('an unsolved final drive still shouts', /is a guess, not a tune/.test(guess));
ok('and the gear list carries no invented speeds', !/mph/.test(gearBlock(guess)));

console.log('--- discredited claims stay dead ---');
ok('no power curve on the graph',
   !/power curve (just )?reach|line up the power curve|power curve[^.]{0,40}edge of the/i.test(full));
ok('no claim the axis rescales', !/axis rescales as you move/.test(full));
ok('no claim the last gear always touches the edge', !/last gear always touches/.test(full));
ok('no touch-the-limiter advice a long-geared car cannot follow',
   !/should just touch the limiter in top gear/.test(full));
// re-render the solved build first — the sheet exports whatever was last calculated
draw({ fdfit: '4.58', vgraph: '157', vmax: '141.5' });
els['save'].onclick();
const sh = blob.parts[0];
ok('sheet says it was solved off the graph', /solved off the graph/.test(sh));
ok('sheet does not invent a power curve', !/power curve/.test(sh));
ok('sheet clean', !/undefined|NaN|\{\{/.test(sh));

console.log('--- the fit survives a round trip ---');
els['lib'].onclick();
const key = encodeURIComponent(JSON.parse(localStorage.getItem('fh6lib'))[0].k);
set('fdfit', '');
els['out'].fire('click', { target: { dataset: { load: key } } });
ok('fit comes back on Load', String(els['fdfit'].value) === '4.58', els['fdfit'].value);
els['newcar'].onclick();
ok('New car clears it', els['fdfit'].value === '');

console.log('--- the gearing block is not hidden any more ---');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok('details block opens by default', /<details id="extra" open>/.test(html));
ok('the fit field is inside it', /id="fdfit"/.test(html));
