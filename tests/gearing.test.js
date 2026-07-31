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
eval(js + ';globalThis.__X={compute,SPREAD,DISC,tireCirc};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const GR86 = { name: 'GR86', cls: 'A', disc: 'road', wt: 2900, fw: 53, hp: 350, tq: 260,
  dt: 'RWD', gr: 7, tire: 'sport', aero: 'both', twf: 0, twr: 0, susp: 'race', arb: 'both',
  trans: 'race', diff: 'race', tsize: '', rpm: NaN, vmax: NaN, fdfit: NaN };
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
/* vFrac was measured 2026-07-31, not guessed: sweeping the GR86's final drive
   and reading the Performance panel put the road optimum at 4.00 against a
   4.575 fit, so road vFrac = 4.575/4.00 = 1.14. Above 1.0 means gearing
   LONGER than the fit. The previous 0.95 pushed the other way, toward 4.82,
   which measured worst of the six settings tried. */
let r = at({ fdfit: 4.575 });
ok('uses the fit path', r.fdSrc === 'fit', r.fdSrc);
ok('road reproduces the measured optimum', near(r.v.fd, 4.00, 0.02), r.v.fd);
ok('road gears LONGER than the fit, not shorter', r.v.fd < 4.575, '4.575 -> ' + r.v.fd);
ok('needs no tire size or top speed',
   at({ fdfit: 4.575, tsize: '325/30R21', rpm: 9000, vmax: 200 }).v.fd === r.v.fd);

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
   near(r.fdBand[1] / r.fdBand[0], 1.14 / 0.93, 0.05), (r.fdBand[1] / r.fdBand[0]).toFixed(3));

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

console.log('--- fallbacks, in order ---');
ok('tire size solves when no fit is given',
   at({ tsize: '215/40R18', rpm: 8000, vmax: 145.4 }).fdSrc === 'tire');
ok('the fit beats the tire solve',
   at({ fdfit: 4.72, tsize: '215/40R18', rpm: 8000, vmax: 145.4 }).fdSrc === 'fit');
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
ok('top gear redlines vFrac past the axis maximum',
   near(r.gearTop[6], 159 * 1.14, 1), r.gearTop[6].toFixed(1));
/* Deliberately past the end of the chart now — the car cannot reach the axis
   maximum anyway, so gearing to it throws away the top of the box. */
ok('top gear sits beyond the chart, by design', r.gearTop[6] > 159,
   r.gearTop.map(v => Math.round(v)).join('/'));
ok('speeds fall in gear order', r.gearTop.every((v, n) => n === 0 || v > r.gearTop[n - 1]));
ok('drag reaches furthest past the axis',
   at({ disc: 'drag', tire: 'dragt', fdfit: 4.575, vgraph: 159 }).gearTop[6] > r.gearTop[6]);

console.log('--- gears that never engage are called out as wasted PI ---');
/* Observed at final drive 4.02: 6th redlines at 154 against a 157 chart, so
   7th's line starts inside the chart and shows as a ~3 mph stub rather than
   disappearing. Whether the top gear is visible depends on where the gear
   BELOW it runs out — an earlier wording implied it vanishes outright and sent
   Boston looking for the wrong thing. */
r = at({ fdfit: 4.575, vgraph: 157, vmax: 143.5 });
ok('predicts the stub instead of claiming it vanishes',
   /short stub of it in the top-right corner/.test(r.w.join(' ')));
ok('sizes the stub', /about 3 mph of line before the edge/.test(r.w.join(' ')),
   (r.w.join(' ').match(/about \d+ mph of line/) || [])[0]);
ok('says a stub is not a usable gear', /the shift point drawn, not a gear you use/.test(r.w.join(' ')));
ok('card explains stub vs vanished', /still climbing<\/em> as it reaches the edge/.test(
   (() => { const s = (id, v) => { document.getElementById(id).value = v; };
     Object.keys(GR86).forEach(k => s(k, typeof GR86[k] === 'number' && isNaN(GR86[k]) ? '' : GR86[k]));
     s('fdfit', '4.575'); s('vgraph', '157'); els['calc'].onclick();
     const h = els['out'].innerHTML; s('vgraph', ''); return h; })()));
/* A gear earns its place by being REACHED, not by fitting the chart. You shift
   into gear N where gear N-1 runs out, so the test is that speed against top
   speed — independent of whether the line fits on the axis. The two conditions
   are orthogonal: a gear can hang off the edge and still be used, or sit well
   inside the chart and never be touched. */
r = at({ fdfit: 4.575, vgraph: 157, vmax: 143.5 });
ok('flags the gear that is never entered', /Top gear never engages/.test(r.w.join(' ')));
ok('names the shift-in speed, not the redline', /shift into 7th at 154 mph/.test(r.w.join(' ')),
   (r.w.join(' ').match(/shift into \w+ at \d+ mph/) || [])[0]);
ok('says running off the chart is not itself the problem',
   /Running off the chart is not the problem/.test(r.w.join(' ')));
ok('names the shorter box that would do', /A 6-speed does the same job for less PI/.test(r.w.join(' ')));
ok('quotes the measured figure', /only reaches 144 mph/.test(r.w.join(' ')));
ok('a measured top speed above the shift point clears the gear',
   !/never engages/.test(at({ fdfit: 4.575, vgraph: 157, vmax: 156 }).w.join(' ')));

/* i.vmax has to be top speed at the RECOMMENDED final drive, not at the fit:
   gearTop is computed at that setting and top speed moves with the gearing, so
   a reading from any other setting is not comparable. Hence the second pass —
   calculate, apply, read, re-enter — and hence the "different final drive"
   wording when the two cannot both be true.

   Without a measured top speed the axis is the only comparison available, and
   it sits well above anything the car reaches — 13 mph above on the GR86. So a
   shift point just under the axis proves nothing, and the app says so rather
   than guessing in either direction. */
const noTop = at({ fdfit: 4.575, vgraph: 157 }).w.join(' ');
ok('admits it cannot tell without top speed', /Cannot tell whether your top gear does anything/.test(noTop));
ok('explains why the axis will not do', /the end of the graph is not a speed the car reaches/.test(noTop));
ok('asks for the one number that settles it', /put it in <b>Top speed at that setting<\/b>/.test(noTop));
ok('does not condemn the gear on a guess', !/never engages/.test(noTop));
ok('counts more than one when more than one is dead',
   /Top 3 gears never engage/.test(
     at({ disc: 'drag', tire: 'dragt', fdfit: 6.2, vgraph: 159, vmax: 120 }).w.join(' ')),
   (at({ disc: 'drag', tire: 'dragt', fdfit: 6.2, vgraph: 159, vmax: 120 }).w.join(' ')
      .match(/Top \d+ gears never engage/) || [])[0]);
ok('no axis maximum means no claim about dead gears',
   !/never engage/.test(at({ fdfit: 4.575 }).w.join(' ')));
ok('no axis maximum means no speeds, not wrong speeds', at({ fdfit: 4.575 }).gearTop === null);
ok('no fit means no speeds', at({ vgraph: 159 }).gearTop === null);

console.log('--- top gear\'s limiter is a ceiling, not a predicted top speed ---');
/* Measured 2026-07-31 at final drive 4.82: top gear redlined at 148 mph and
   the car did 140.0, because by then the engine is past peak power. A previous
   revision printed the ceiling as the predicted top speed and was out by 11. */
r = at({ fdfit: 4.575, vgraph: 159 });
ok('exposes a ceiling', near(r.topCeil, 159 * 1.14, 1), r.topCeil.toFixed(1));
ok('a top speed under the ceiling is normal, not an error',
   !/does not add up/.test(at({ fdfit: 4.575, vgraph: 159, vmax: 140 }).w.join(' ')));
ok('a top speed above the ceiling is impossible and flagged',
   /Something does not add up in the gearing inputs/.test(
     at({ fdfit: 4.575, vgraph: 159, vmax: 200 }).w.join(' ')));
ok('the flag names the likely cause',
   /read at a <em>different<\/em> final drive than this one/.test(at({ fdfit: 4.575, vgraph: 159, vmax: 200 }).w.join(' ')));
ok('no axis maximum means no ceiling to check',
   !/does not add up/.test(at({ fdfit: 4.575, vmax: 300 }).w.join(' ')));

console.log('--- the graph is described as it actually behaves ---');
const set = (id, v) => { document.getElementById(id).value = v; };
Object.keys(GR86).forEach(k => set(k, typeof GR86[k] === 'number' && isNaN(GR86[k]) ? '' : GR86[k]));
set('fdfit', '4.72'); set('vgraph', '');
els['calc'].onclick();
const page = els['out'].innerHTML;
ok('gear list shows speeds when the axis maximum is known', !/to \d+ mph/.test(page));
set('vgraph', '159'); set('fdfit', '4.575'); els['calc'].onclick();
const withMph = els['out'].innerHTML;
ok('speeds appear beside the ratios', /to 181 mph/.test(withMph),
   (withMph.match(/to \d+ mph/g) || []).join(' '));
ok('all seven gears annotated', (withMph.match(/to \d+ mph/g) || []).length === 7);
ok('card calls the ceiling a ceiling', /do not read that as top speed/.test(withMph));
ok('card cites the measured counter-example', /redlined at 148 and the car did 140/.test(withMph));
ok('card hands the decision to the Performance panel',
   /Performance panel decides this, not the graph/.test(withMph));
ok('card explains the extra-shift cost', /forces an extra shift before 100 mph/.test(withMph));
ok('card calls the final drive a starting point',
   /a place to start rather than an answer to two decimals/.test(withMph));
ok('card flags the gear that never engages', /Check which gear it tops out in/.test(withMph));
els['save'].onclick();
ok('sheet carries the speeds too', /class="gear-mph">181</.test(blob.parts[0]));
set('vgraph', ''); set('fdfit', '4.72'); els['calc'].onclick();
/* The engine's power curve is a real thing and gets mentioned; what must never
   come back is the claim that one is drawn on this graph and can be lined up. */
ok('does not put a power curve on the graph',
   !/power curve (just )?reach|line up the power curve|power curve[^.]{0,40}edge of the/i.test(page));
ok('says the axis does NOT rescale', /bottom axis does not rescale/.test(page));
ok('explains that tall gears run off the end', /runs off the right-hand end/.test(page));
ok('says the edge is the reference, not the answer',
   /is the <em>reference point<\/em>, not the answer/.test(page));
ok('drops the touch-the-limiter advice a long-geared car cannot follow',
   !/should just touch the limiter in top gear/.test(page));
ok('does not claim the last gear always touches the edge',
   !/last gear always touches/.test(page) && !/axis rescales as you move/.test(page));
ok('shows the working', /4\.72 &divide; 1\.14/.test(page));
ok('says it gears longer than the fit, not shorter', /14% <b>longer<\/b> than that/.test(page));
ok('explains why past the edge is fine', /the car cannot reach the edge anyway/.test(page));
ok('offers a band rather than one number', /Sweep 3\.\d\d&ndash;4\.\d\d/.test(page),
   (page.match(/Sweep [\d.]+&ndash;[\d.]+/) || [])[0]);
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
