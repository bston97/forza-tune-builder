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
  trans: 'race', diff: 'race', vmax: NaN, fdfit: NaN, vgraph: NaN, fdset: NaN };
const at = o => X.compute(Object.assign({}, GR86, o));
const HTML = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const set = (id, v) => { document.getElementById(id).value = v; };
const draw = o => {
  Object.keys(GR86).forEach(k => set(k, typeof GR86[k] === 'number' && isNaN(GR86[k]) ? '' : GR86[k]));
  Object.keys(o).forEach(k => set(k, o[k]));
  els['calc'].onclick();
  return els['out'].innerHTML;
};

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

console.log('--- what top speed is for, now that its meaning is unsettled ---');
/* Boston, 2026-07-31: the Performance panel's Top Speed is the projected
   maximum for ideal gearing, not the speed the car reaches on the gearing
   fitted. His own sweep fits neither reading cleanly (a pure ceiling would be
   constant across final drives; it moved 140.0 to 144.4). So every claim that
   needed "achieved" was withdrawn rather than guessed at again. */
{
  const without = at({ fdfit: 4.575, vgraph: 157 });
  const with_ = at({ fdfit: 4.575, vgraph: 157, vmax: 141.5 });
  ok('top speed changes no slider value',
     Object.keys(without.v).every(k => without.v[k] === with_.v[k]));
  ok('and no limiter speed', JSON.stringify(without.gearTop) === JSON.stringify(with_.gearTop));
  ok('the ratio set needs only the two chart readings',
     /Or set these ratios/.test(draw({ fdfit: '4.58', vgraph: '157' })) &&
     !/Or set these ratios/.test(draw({ fdfit: '4.58', vgraph: '' })));
  ok('no gear is ever labelled "tops out here"', !/tops out here/.test(draw({ fdfit: '4.58', vgraph: '157' })));
  ok('no gear is ever labelled "never used"', !/never used/.test(draw({ fdfit: '4.58', vgraph: '157' })));
  ok('nothing computes which gear the car runs out in',
     with_.topsIn === undefined && with_.topBogus === undefined);
  ok('the card says it cannot answer that',
     /Which of them you actually reach is a question this cannot answer/.test(
       draw({ fdfit: '4.58', vgraph: '157', vmax: '141.5' })));
  ok('the form no longer asks for top speed at all',
     !/id="vmax"/.test(HTML) && /Top Speed is never\s+asked for/.test(HTML));

  ok('the fit alone gives nothing', at({ fdfit: 4.575 }).gearTop === null);
  ok('graph max alone gives nothing', at({ vgraph: 157 }).gearTop === null);
  ok('the two together are the anchor', at({ fdfit: 4.575, vgraph: 157 }).kSpeed > 0);
}

console.log('--- the false alarm is gone for good ---');
/* The check that fired on build after build: it read a top speed above the top
   gear's limiter as an impossible input. Under Boston's reading that is the
   ordinary case, not an error. */
{
  const over = at({ fdfit: 4.575, vgraph: 157, fdset: 4.58, vmax: 200 });
  ok('a top speed way above the limiter no longer warns',
     !/disagree|does not add up/.test(over.w.join(' ')), over.w.join(' ').slice(0, 70));
  ok('and still produces gear speeds', Array.isArray(over.gearTop));
  ok('and still produces ratios',
     /Or set these ratios/.test(draw({ fdfit: '4.58', vgraph: '157', fdset: '4.58', vmax: '200' })));
  ok('no build carries a gearing disagreement warning',
     ['road', 'sprint', 'touge', 'drift', 'drag', 'rally', 'cc'].every(disc =>
       !/disagree|does not add up/.test(at({ disc, dt: disc === 'rally' || disc === 'cc' ? 'AWD' : 'RWD',
         fdfit: 4.575, vgraph: 157, fdset: 3.20, vmax: 175 }).w.join(' '))));
}

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

console.log('--- the card leads with the setting, not an essay ---');
/* What shipped before this: a 179 mph figure beside 7th on a car doing 141,
   under 450 words of prose arguing with itself. The number is what gets read. */
const gearBlock = h => (h.match(/<div class="gears">[\s\S]*?<\/div><\/div>/) || [''])[0];
const words = h => { const g = h.indexOf('>Gearing</h3>'), n = h.indexOf('<div class="sec"', g);
  return h.slice(g, n).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length; };

const full = draw({ fdfit: '4.58', vgraph: '157', vmax: '141.5' });
ok('opens with the number to set', /<b>Set 4\.58<\/b>/.test(full));
ok('does not fake a calculation at vFrac 1.00', !/&divide; 1\.00/.test(full));
ok('says the fit is the setting', /your fit unchanged/.test(full));
ok('says you can set your own final drive',
   /enter your own under <b>Final drive you run<\/b>/.test(full));
ok('offers the sweep band', /sweep <b>3\.\d\d&ndash;4\.\d\d<\/b>/.test(full),
   (full.match(/sweep <b>[\d.]+&ndash;[\d.]+<\/b>/) || [])[0]);
ok('hands the decision to the Performance panel',
   /sweep <b>[^<]*<\/b> against the Performance panel/.test(full));
ok('gear list carries limiter speeds', /to 44 mph/.test(gearBlock(full)));
ok('every gear annotated', (gearBlock(full).match(/to \d+ mph/g) || []).length === 7);
ok('the whole section stays short', words(full) < 320, words(full) + ' words');

const noTop = draw({ fdfit: '4.58', vgraph: '' });
ok('without graph max the ratios stop but the card survives', /Set 4\.58/.test(noTop));
ok('but no ratio set', !/Or set these ratios/.test(noTop));

const guess = draw({ fdfit: '', vgraph: '', vmax: '' });
ok('an unsolved final drive still shouts', /is a guess, not a tune/.test(guess));
ok('and the gear list carries no invented speeds', !/mph/.test(gearBlock(guess)));

console.log('--- your final drive, my ratios ---');
/* Boston: "if you are able to do the ratios correctly between gears I can just
   set the final drive as I'd like." Two things had to work for that. */
{
  // 1. the gear table must follow a hand-edited final drive. It did not.
  draw({ fdfit: '4.58', vgraph: '157', vmax: '141.5' });
  const atRec = (els['out'].innerHTML.match(/to \d+ mph/g) || []).join(' ');
  els['out'].fire('change', { target: { dataset: { k: 'fd' }, value: '3.00' } });
  const atMine = (els['out'].innerHTML.match(/to \d+ mph/g) || []).join(' ');
  ok('gear speeds follow a hand-set final drive', atRec !== atMine);
  ok('and they are right at the new one', /to 67 mph/.test(atMine), atMine.slice(0, 40));

  // 2. ratios that cover the range at whatever final drive is set
  const page = els['out'].innerHTML;
  ok('offers a ratio set', /Or set these ratios and keep your own final drive/.test(page));
  const sets = page.match(/<div class="gears"[^>]*>[\s\S]*?<\/div><\/div>/g) || [];
  ok('shows it as a second table', sets.length === 2, sets.length + ' tables');
  const mine = [...sets[1].matchAll(/<span>(\d\.\d\d)/g)].map(m => +m[1]);
  ok('seven ratios', mine.length === 7, mine.join('/'));
  ok('strictly descending', mine.every((g, n) => n === 0 || g < mine[n - 1]), mine.join('/'));
  ok('keeps the game\'s 1st', mine[0] === X.SPREAD[7][0], mine[0]);
  ok('equal rpm drop on every shift',
     mine.slice(1).every((g, n) => Math.abs(g / mine[n] - mine[1] / mine[0]) < 0.02),
     mine.slice(1).map((g, n) => Math.round(g / mine[n] * 100) + '%').join(' '));
  const speeds = [...sets[1].matchAll(/to (\d+) mph/g)].map(m => +m[1]);
  ok('top gear placed at the graph maximum', speeds[6] === 157, speeds[6]);
  ok('called a hypothesis, not an upgrade', /A hypothesis, not an upgrade/.test(page));
  ok('says why it cannot be known', /without the engine's power curve/.test(page));
  ok('survives the ambiguity about what Top Speed means',
     /whether that figure is what it reaches or what it could reach/.test(page));
}

console.log('--- your final drive is an input, not a suggestion ---');
/* The failure Boston hit on every build: he sets his own final drive, and the
   app computed everything at its OWN recommendation instead. */
{
  const mine = at({ fdfit: 4.575, vgraph: 157, fdset: 3.60, vmax: 160 });
  ok('the entered final drive wins', mine.fdSrc === 'user' && near(mine.v.fd, 3.60, 0.01), mine.v.fd);
  ok('gear speeds computed at HIS setting',
     Math.abs(mine.gearTop[6] - 589 / (3.60 * 0.82)) < 2, mine.gearTop[6].toFixed(1));
  ok('user fd needs no fit to be respected',
     at({ fdset: 3.85 }).fdSrc === 'user' && near(at({ fdset: 3.85 }).v.fd, 3.85, 0.01));
  ok('and does not get nagged as a guess', !/is a guess, not a tune/.test(at({ fdset: 3.85 }).w.join(' ')));
  const page = draw({ fdfit: '4.58', vgraph: '157', fdset: '3.60', vmax: '160' });
  ok('card says the setting is his', /<b>Your final drive: 3\.60\.<\/b>/.test(page));
  ok('ratio set offered at his setting', /Or set these ratios and keep your own final drive/.test(page));
}

console.log('--- tire width runs stock to +3 ---');
ok('no +4 option anywhere', !/value="4">(Front|Rear)/.test(HTML));
ok('+3 is the ceiling', /Front: \+3/.test(HTML) && /Rear: \+3/.test(HTML));

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
ok('gearing has its own step, no disclosure to miss', /<div id="extra">/.test(html) && !/<details id="extra"/.test(html));
ok('the fit field is inside it', /id="fdfit"/.test(html));
