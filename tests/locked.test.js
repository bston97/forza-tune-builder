/* Every place a missing part has to be *said out loud* rather than left blank.
   gates.test.js proves compute() blanks the right values; this file proves the
   three render paths — on-page card, exported sheet, fine-tune bar — describe
   that blank honestly instead of coaching a slider the car does not have. */
const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(js + ';globalThis.__X={libLoad,get BASE(){return BASE},get LOG(){return LOG},get ADJ(){return ADJ}};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));
const set = (id, v) => { document.getElementById(id).value = v; };

const CAR = { name: 'Evo', year: '2004', cls: 'A', disc: 'road', wt: '3241', fw: '57',
  hp: '612', tq: '480', dt: 'RWD', pi: '', gr: '6', tire: 'sport', aero: 'both',
  twf: '0', twr: '0', susp: 'race', arb: 'both', trans: 'sport', diff: 'race',
  vmax: '' };
function build(o) {
  Object.keys(Object.assign({}, CAR, o)).forEach(k => set(k, Object.assign({}, CAR, o)[k]));
  els['calc'].onclick();
  return els['out'].innerHTML;
}
const sheetFor = o => { build(o); els['save'].onclick(); return blob.parts[0]; };

console.log('--- aero notes name the end that is actually fitted ---');
let page = build({ aero: 'front' });
ok('front-only: page says front only', /<b>Front aero only\.<\/b>/.test(page));
ok('front-only: page says the REAR is the fixed end', /With a fixed rear/.test(page));
ok('front-only: page does not claim rear-only', !/Rear aero only/.test(page));
page = build({ aero: 'rear' });
ok('rear-only: page says rear only', /<b>Rear aero only\.<\/b>/.test(page));
ok('rear-only: page says the FRONT is the fixed end', /With a fixed front/.test(page));

let sh = sheetFor({ aero: 'front' });
ok('front-only sheet: rear marked not adjustable',
   /Rear Downforce[\s\S]{0,80}Not adjustable/.test(sh));
ok('front-only sheet: rear is not left as a bare dash',
   !/Rear Downforce<\/div><div class="row-value val-teal">&mdash;/.test(sh));
ok('front-only sheet: names the rear as fixed', /Rear is fixed, so the in-game balance/.test(sh));
sh = sheetFor({ aero: 'rear' });
ok('rear-only sheet: front marked not adjustable',
   /Front Downforce[\s\S]{0,80}Not adjustable/.test(sh));
ok('rear-only sheet: names the front as fixed', /Front is fixed, so the in-game balance/.test(sh));

console.log('--- partial locks are labelled, not blank ---');
page = build({ diff: 'sport' });
ok('sport diff: decel row says not adjustable', /Decel<\/div><div class="v"><span class="na">/.test(page));
ok('sport diff: no empty value cell', !/<div class="v"><\/div>/.test(page));
ok('sport diff: drops the "decel kept low" advice', !/Decel deliberately kept low/.test(page));
page = build({ diff: 'sport', dt: 'AWD' });
ok('AWD sport diff: does not claim front decel is 0% by design',
   !/Front decel is 0% by design/.test(page));
ok('AWD sport diff: explains decel needs a race unit', /Decel lock needs a Race diff/.test(page));
page = build({ dt: 'AWD' });
ok('AWD race diff: still says 0% by design', /Front decel is 0% by design/.test(page));
page = build({ arb: 'front' });
ok('single ARB: missing end labelled', /Rear<\/div><div class="v"><span class="na">/.test(page));

console.log('--- sheet notes follow the gates ---');
const stripped = { susp: 'stock', arb: 'stock', diff: 'stock', trans: 'stock', aero: 'none' };
sh = sheetFor(stripped);
ok('no Mechanical Balance coaching with stock bars', !/Mechanical Balance/.test(sh));
ok('no spring-rate coaching with stock suspension', !/Spring rates<\/strong> are absolute/.test(sh));
ok('no ride-height coaching with stock suspension', !/Ride height<\/strong> is a position/.test(sh));
ok('no damping coaching with stock dampers', !/Damping<\/strong> scales/.test(sh));
ok('flags the stock gearbox on final drive', /no final drive slider exists on a stock gearbox/.test(sh));
ok('sheet explains its own dashes', /Not adjustable on this build:/.test(sh));
ok('gap list names the parts', /camber, toe and caster/.test(sh) && /both anti-roll bars/.test(sh) &&
   /the entire differential/.test(sh));
// alignment, ARB, springs, damping, aero, diff — tires, gearing and brakes survive
ok('locked sections marked in the header', (sh.match(/section-check na/g) || []).length === 6,
   (sh.match(/section-check na/g) || []).length + ' marked');
ok('marking sections adds none', (sh.match(/class="section"/g) || []).length === 10,
   (sh.match(/class="section"/g) || []).length + ' sections (9 tune + notes, no adjustments)');
ok('stripped sheet clean', !/undefined|NaN|\{\{/.test(sh));

sh = sheetFor({});
ok('fully-built sheet keeps all the coaching',
   /Mechanical Balance/.test(sh) && /Spring rates<\/strong> are absolute/.test(sh) &&
   /Damping<\/strong> scales/.test(sh));
ok('fully-built sheet has no gap list', !/Not adjustable on this build:/.test(sh));
ok('fully-built sheet has no locked headers', !/section-check na/.test(sh));

sh = sheetFor({ diff: 'sport', dt: 'AWD' });
ok('AWD sport diff sheet drops the 0%-by-design note', !/Front decel is 0% by design/.test(sh));
ok('AWD sport diff sheet lists decel + centre as missing',
   /differential decel and the centre split/.test(sh));

console.log('--- Apply Fix never fails silently ---');
build(stripped);
set('sym', 'roll');            // wants arF, arR, reF, reR — none exist here
els['apply'].onclick();
ok('no log entry when nothing can move', X.LOG.length === 0);
ok('says why: parts not fitted', /none of those sliders exist/.test(els['adjmsg'].innerHTML));
ok('message is visible', els['adjmsg'].style.display === '');
ok('names the sliders it wanted', /ARB F/.test(els['adjmsg'].innerHTML));

build({});
set('sym', 'roll'); els['apply'].onclick();
ok('a fix that works clears the message', els['adjmsg'].style.display === 'none' && X.LOG.length === 1);

// drive one slider to its ceiling, then ask for more of it
els['out'].fire('change', { target: { dataset: { k: 'pres' }, value: '150' } });
set('sym', 'lockup');          // pressure -5 ... but only pres, and it's at max? no: lockup lowers
els['apply'].onclick();
ok('lowering from the top still works', X.LOG.length === 3);
els['out'].fire('change', { target: { dataset: { k: 'pres' }, value: '50' } });
els['apply'].onclick();        // lockup again: pres already at floor
ok('at-the-limit case reports itself', /Nothing left to give/.test(els['adjmsg'].innerHTML));

console.log('--- Save Sheet only lives on the tune view ---');
build({});
ok('enabled after calculate', els['save'].disabled === false);
els['plan'].onclick();
ok('disabled on the build plan', els['save'].disabled === true);
els['calc'].onclick();
ok('re-enabled by calculate', els['save'].disabled === false);
els['lib'].onclick();
ok('disabled on the library', els['save'].disabled === true);
set('name', 'nothing-matches-this'); els['find'].onclick();
ok('disabled on a failed find', els['save'].disabled === true);

console.log('--- returning to the tune keeps fine-tuning ---');
build({}); els['reset'].onclick();   // Calculate on an unchanged block no longer rebases
set('sym', 'mid_us'); els['apply'].onclick();
const tuned = Object.keys(X.ADJ).length, entries = X.LOG.length;
ok('adjustments applied', tuned > 0 && entries === 1);
els['lib'].onclick();
els['calc'].onclick();                       // same stat block -> same baseline
ok('adjustments survive the round trip',
   Object.keys(X.ADJ).length === tuned && X.LOG.length === entries);
ok('modified values still highlighted', els['out'].innerHTML.indexOf('vi mod') > -1);
set('wt', '3300'); els['calc'].onclick();    // a real change still rebases
ok('a changed stat block clears them', Object.keys(X.ADJ).length === 0 && X.LOG.length === 0);

console.log('--- library says what actually saves a build ---');
els['lib'].onclick();
const lib = els['out'].innerHTML;
ok('does not claim calculating saves', !/Every build you calculate is saved/.test(lib));
ok('points at Save Sheet', /Save Sheet/.test(lib) || /Saving a sheet/.test(lib));

console.log('--- loading a record that predates a field ---');
// simulate an entry written by an older version: no tire / susp / diff keys
const old = X.libLoad()[0];
['tire', 'susp', 'arb', 'trans', 'diff', 'twf', 'twr'].forEach(k => delete old[k]);
localStorage.setItem('fh6lib', JSON.stringify([old]));
els['lib'].onclick();
els['out'].fire('click', { target: { dataset: { load: encodeURIComponent(old.k) } } });
ok('tire compound defaulted, not blanked', els['tire'].value !== '', els['tire'].value);
ok('suspension defaulted', els['susp'].value !== '', els['susp'].value);
ok('diff defaulted', els['diff'].value === 'race');
ok('width steps defaulted to stock', els['twf'].value === '0' && els['twr'].value === '0');
ok('no NaN reached the tune', !/NaN|undefined/.test(els['out'].innerHTML));

/* Structural sweep over every combination of gated parts, checking the two
   render paths rather than the numbers (stress.test.js has the numbers). What
   it catches: a blank cell, a leaked NaN, or a note that coaches a slider the
   fitted parts do not expose. */
console.log('--- every parts combination renders and exports honestly ---');
const problems = [];
let combos = 0;
for (const susp of ['stock', 'street', 'sport', 'race'])
for (const arb of ['stock', 'front', 'rear', 'both'])
for (const diff of ['stock', 'street', 'sport', 'race'])
for (const aero of ['none', 'front', 'rear', 'both'])
for (const dt of ['RWD', 'AWD', 'FWD'])
for (const trans of ['stock', 'sport', 'race']) {
  const page = build({ susp, arb, diff, aero, dt, trans });
  els['save'].onclick();
  const paper = blob.parts[0], tag = [susp, arb, diff, aero, dt, trans].join('/');
  const flag = (bad, why) => { if (bad) problems.push(tag + ': ' + why); };
  flag(/NaN|undefined/.test(page), 'NaN/undefined on the page');
  flag(/NaN|undefined/.test(paper), 'NaN/undefined in the sheet');
  flag(/<div class="v"><\/div>/.test(page), 'empty value cell');
  flag(/class="row-value[^"]*"><\/div>/.test(paper), 'empty sheet row');
  flag(aero === 'front' && /Rear aero only/.test(page), 'aero note names the wrong end');
  flag(arb === 'stock' && /Mechanical Balance/.test(paper), 'ARB coaching with stock bars');
  flag(susp === 'stock' && /Spring rates<\/strong> are absolute/.test(paper), 'spring coaching with stock suspension');
  flag(susp !== 'race' && /Damping<\/strong> scales/.test(paper), 'damping coaching without race dampers');
  flag(!(diff === 'race' && dt === 'AWD') && /Front decel is 0% by design/.test(paper), 'front-decel note without a front decel slider');
  combos++;
}
ok(combos + ' combinations render + export honestly', problems.length === 0,
   problems.length ? problems.slice(0, 5).join(' | ') : combos + ' checked');
