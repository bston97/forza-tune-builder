/* Three jobs, three sets of fields.

   Planning a build happens before a single part is bought, so "what's fitted"
   and the gearing readings are not merely optional there — they are
   unanswerable, and showing them invited guessing. The sheet step is the
   opposite: everything is known, and what is wanted is a last look before the
   artifact gets made. Calculating a tune is the default job. */
const { readScript, makeShim, ok } = require('./shim');
const { els, document, window, localStorage } = makeShim();
let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(readScript() + ';globalThis.__X={get MODE(){return MODE},setMode,preflight,get BASE(){return BASE}};');
const X = globalThis.__X;
const set = (id, v) => { document.getElementById(id).value = v; };
const shown = id => els[id].style.display !== 'none';

const CAR = { name: 'GR86', year: '2022', cls: 'A', disc: 'road', wt: '2900', fw: '53',
  hp: '350', tq: '260', dt: 'RWD', pi: '700', gr: '7', tire: 'sport', aero: 'both',
  twf: '0', twr: '0', susp: 'race', arb: 'both', trans: 'race', diff: 'race',
  fdfit: '4.58', vgraph: '157', fdset: '' };
const fill = o => Object.keys(Object.assign({}, CAR, o))
  .forEach(k => set(k, Object.assign({}, CAR, o)[k]));

console.log('--- calculating a tune is the default, and it opens on step 1 ---');
ok('starts in tune mode', X.MODE === 'tune', X.MODE);
ok('the form is up', shown('formfields'));
ok('step 1 is the car', shown('step1') && /STEP 1 \/ 3/.test(els['stephead'].innerHTML));
ok('parts and gearing wait their turn', !shown('fitted'));
ok('Next is the action, Calculate is not yet', shown('next') && !shown('calc') && !shown('plan') && !shown('save'));
ok('no Back on step 1', !shown('back'));
ok('no preflight yet', !shown('preflight'));

console.log('--- the walk: validate, advance, back ---');
/* Step 1 refuses to advance without the same four numbers Calculate itself
   requires — the refusal happens where the fields are, not two steps later. */
fill({ wt: '', hp: '' });
els['next'].onclick();
ok('missing stats block the step', X.MODE === 'tune' && shown('step1'));
ok('and are named', /Weight/.test(els['stephint'].innerHTML) && /HP/.test(els['stephint'].innerHTML));
fill({});
els['next'].onclick();
ok('complete stats advance to parts', shown('parts') && shown('fitted') && !shown('step1'),
   els['stephead'].innerHTML);
ok('hint cleared', !shown('stephint'));
els['next'].onclick();
ok('step 3 is the gearing readings', shown('extra') && !shown('parts') && /STEP 3/.test(els['stephead'].innerHTML));
ok('Calculate appears only here', shown('calc') && !shown('next'));
els['back'].onclick();
ok('Back returns to parts', shown('parts') && !shown('extra'));
els['back'].onclick();
ok('and to the car', shown('step1') && !shown('back'));
els['next'].onclick(); els['next'].onclick();   // back to step 3 for the rest of the file

console.log('--- plan mode hides what cannot be known yet ---');
X.setMode('plan');
ok('mode switched', X.MODE === 'plan');
ok('stat block still up', shown('formfields'));
ok('what-is-fitted hidden', !shown('fitted'),
   'nothing is bought yet, so tires/susp/diff/gearing are unanswerable');
ok('Build Plan is the action', shown('plan') && !shown('calc') && !shown('save'));
ok('hint explains the phase', /Pre-purchase/.test(els['modehint'].innerHTML));

console.log('--- sheet mode is a confirmation step ---');
fill({});
X.setMode('tune');
els['calc'].onclick();
ok('a tune exists', X.BASE !== null);
X.setMode('sheet');
ok('form swapped for the checklist', !shown('formfields') && shown('preflight'));
ok('Create Tune Sheet is the action', shown('save') && !shown('calc') && !shown('plan'));
ok('export enabled once a tune exists', els['save'].disabled === false);

const html = els['preflight'].innerHTML;
ok('covers identity', /Car name/.test(html) && /GR86/.test(html));
ok('covers the stat block', /Weight/.test(html) && /2900 lb/.test(html));
ok('covers parts fitted', /Anti-roll bars/.test(html) && /Differential/.test(html));
ok('covers gearing', /Chart readings/.test(html) && /4\.58 fit/.test(html));
ok('covers whether a tune was run', /Calculated/.test(html));
ok('says it is ready when it is', /Everything the sheet needs is here/.test(html));

console.log('--- and it names what is missing ---');
fill({ name: '', year: '', fdfit: '', vgraph: '' });
X.setMode('tune'); els['calc'].onclick();
X.setMode('sheet');
const gaps = els['preflight'].innerHTML;
ok('flags the missing name', /Untitled/.test(gaps));
ok('flags the missing chart readings', /not entered/.test(gaps));
ok('says why that one matters', /power-to-weight guess/.test(gaps));
ok('counts what is worth fixing', /worth fixing first/.test(gaps));
ok('but does not block the export', els['save'].disabled === false,
   'a sheet with a missing year is still a usable sheet');

console.log('--- preflight reads the form, not stale state ---');
const rows = X.preflight();
ok('returns structured rows', Array.isArray(rows) && rows.length > 10, rows.length + ' rows');
ok('has section headers', rows.some(r => r.h === 'Gearing'));
ok('marks bad things "no"', rows.some(r => r.state === 'no'));
fill({});
X.setMode('tune'); els['calc'].onclick(); X.setMode('sheet');
ok('re-reads after a change', /4\.58 fit/.test(els['preflight'].innerHTML));

console.log('--- Enter fires the mode\'s action, not always Calculate ---');
/* In plan mode torque and front % are legitimately blank; Enter used to fire
   Calculate anyway, and "Torque is required" replaced the plan on screen. */
fill({ tq: '', fw: '' });
X.setMode('plan');
els['plan'].onclick();
ok('plan renders without torque', /Build Plan/.test(els['out'].innerHTML));
(function () {
  // the shim registers document.addEventListener as a no-op, so call the
  // behaviour through the buttons the handler would press instead:
  // plan mode -> plan. The assertion is that calc alone would have failed.
  els['calc'].onclick();
  ok('Calculate with a blank torque fails as expected', /required/.test(els['out'].innerHTML));
  els['plan'].onclick();
  ok('plan comes back', /Build Plan/.test(els['out'].innerHTML));
})();

console.log('--- loads switch to the mode they belong to ---');
fill({});
X.setMode('tune'); els['calc'].onclick(); els['save'].onclick();   // library entry
els['plan'].onclick();                                             // plan entry
X.setMode('plan');
const buildKey = encodeURIComponent(JSON.parse(localStorage.getItem('fh6lib'))[0].k);
els['out'].fire('click', { target: { dataset: { load: buildKey } } });
ok('loading a build switches to tune mode', X.MODE === 'tune', X.MODE);
ok('and renders the tune', /Antiroll/.test(els['out'].innerHTML));
X.setMode('tune');
const pKey = encodeURIComponent(JSON.parse(localStorage.getItem('fh6plan'))[0].k);
els['out'].fire('click', { target: { dataset: { load: 'p:' + pKey } } });
ok('loading a starting point switches to plan mode', X.MODE === 'plan', X.MODE);

console.log('--- the sheet follows a hand-edited final drive ---');
/* sheet() used r.gearTop — speeds at compute()'s fd — under a header showing
   eff('fd'). Edit the final drive, export, and the numbers described a setting
   that was not on the sheet. */
X.setMode('tune');
fill({});
els['calc'].onclick();
els['out'].fire('change', { target: { dataset: { k: 'fd' }, value: '3.60' } });
els['save'].onclick();
const sh = blob.parts[0];
ok('sheet shows the edited final drive', /final-drive-value">3\.60</.test(sh));
ok('default-ratio speeds recomputed at it', /gear-mph">56</.test(sh) && /gear-mph">200</.test(sh));
ok('not the stale speeds from the old fd', !/gear-mph">44</.test(sh));
ok('computed ratio set printed too', /Computed ratios/.test(sh));
ok('its top gear lands on the chart maximum', /gear-mph">157</.test(sh));
ok('note explains the A/B', /Two gear tables are printed/.test(sh));
ok('sheet clean', !/undefined|NaN|\{\{/.test(sh));

console.log('--- the results end with the in-game half of the process ---');
/* The formulas get the numbers close; the readouts catch what the numbers
   cannot carry (track width, cage, the power curve). That procedure used to
   be scattered through the section notes — now it is one ordered list. */
X.setMode('tune');
fill({ twr: '2' });
els['calc'].onclick();
const verify = els['out'].innerHTML;
ok('Verify In Game section present', /}Verify In Game</.test(verify) || />Verify In Game</.test(verify));
ok('five ordered checks', /5 checks, in order/.test(verify));
ok('mech balance with the band', /0\.55&ndash;0\.65/.test(verify));
ok('aero balance when aero is fitted', /0\.42&ndash;0\.48/.test(verify));
ok('ends by pointing at the fine-tune box', /tell the fine-tune box/.test(verify));
ok('widened car gets the track-width caveat on the ARB note', /Widened car/.test(verify));
fill({ twr: '0' });
els['calc'].onclick();
ok('stock-width car does not', !/Widened car/.test(els['out'].innerHTML));
fill({ aero: 'none' });
els['calc'].onclick();
ok('no aero, no aero check', /nothing to check on this build/.test(els['out'].innerHTML));

console.log('--- no tune, no export ---');
els['newcar'].onclick();
X.setMode('sheet');
ok('export disabled with nothing calculated', els['save'].disabled === true);
ok('and says so', /run Calculate tune before exporting/.test(els['preflight'].innerHTML));
