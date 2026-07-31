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

console.log('--- calculating a tune is the default ---');
ok('starts in tune mode', X.MODE === 'tune', X.MODE);
ok('the full form is up', shown('formfields'));
ok('what-is-fitted is up', shown('fitted'));
ok('Calculate is the action', shown('calc') && !shown('plan') && !shown('save'));
ok('no preflight yet', !shown('preflight'));

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

console.log('--- no tune, no export ---');
els['newcar'].onclick();
X.setMode('sheet');
ok('export disabled with nothing calculated', els['save'].disabled === true);
ok('and says so', /run Calculate tune before exporting/.test(els['preflight'].innerHTML));
