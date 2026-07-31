const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };

eval(js + ';globalThis.__X={buildPlan,libLoad,libStore,PI_CEIL,' +
     'get VIEW(){return VIEW},get BASE(){return BASE}};');
const X = globalThis.__X;
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '   ' + x : ''));
const set = (id, v) => { document.getElementById(id).value = v; };
const fill = o => Object.keys(o).forEach(k => set(k, o[k]));

const EVO = { name: 'Lancer Evolution VIII MR', cls: 'A', disc: 'sprint', wt: '3241', fw: '57',
  hp: '612', tq: '480', dt: 'AWD', gr: '6', tire: 'semi', aero: 'both',
  twf: '265', twr: '285' };

console.log('--- build plan renders per discipline ---');
const DISCS = ['road','sprint','touge','drift','drag','rally','cc'];
for (const d of DISCS) {
  fill(Object.assign({}, EVO, { disc: d, dt: d === 'drift' ? 'RWD' : 'AWD' }));
  els['plan'].onclick();
  const o = els['out'].innerHTML;
  const steps = (o.match(/class="step"/g) || []).length;
  ok(d.padEnd(7) + ' plan renders', steps >= 8 && !/undefined|NaN/.test(o), steps + ' steps');
}

console.log('\n--- plan contains no predicted numbers ---');
fill(EVO); els['plan'].onclick();
const plan = els['out'].innerHTML;
ok('no fake PI prediction', !/will (be|land|reach) \d{3} PI/i.test(plan));
ok('states the caveat', plan.indexOf('simulated lap') > -1);
ok('points at Buy & Install', plan.indexOf('Buy &amp; Install') > -1);
ok('lists slider unlocks', plan.indexOf('Unlocks:') > -1);
ok('shows stop condition', plan.indexOf('Stop condition') > -1);
ok('shows hp/1000lb context', plan.indexOf('hp per 1000 lb') > -1);
ok('adjust bar hidden on plan', els['adjust'].style.display === 'none');
ok('VIEW = plan', X.VIEW === 'plan');

console.log('\n--- viability flags ---');
function flagsFor(o) { fill(Object.assign({}, EVO, o)); els['plan'].onclick();
  return (els['out'].innerHTML.match(/class="flag"/g) || []).length; }
ok('clean build: no flags', flagsFor({}) === 0);
ok('FWD at S2 flagged', flagsFor({ dt: 'FWD', cls: 'S2' }) > 0);
ok('heavy car in A road flagged', flagsFor({ wt: '4500', cls: 'A', disc: 'road' }) > 0);
ok('AWD drift flagged', flagsFor({ dt: 'AWD', disc: 'drift' }) > 0);
ok('RWD rally flagged', flagsFor({ dt: 'RWD', disc: 'rally' }) > 0);
ok('RWD drag flagged', flagsFor({ dt: 'RWD', disc: 'drag' }) > 0);
ok('featherweight S2 flagged', flagsFor({ wt: '1750', cls: 'S2' }) > 0);

console.log('\n--- plan works before full stats (torque/front% blank) ---');
fill(Object.assign({}, EVO, { tq: '', fw: '' }));
els['plan'].onclick();
ok('plan renders without torque/front%', (els['out'].innerHTML.match(/class="step"/g) || []).length >= 8);
els['calc'].onclick();
ok('tune still requires them', els['out'].innerHTML.indexOf('required') > -1);

console.log('\n--- library ---');
fill(EVO); els['calc'].onclick();
ok('calculating alone does NOT save', X.libLoad().length === 0, X.libLoad().length + ' entries');
els['save'].onclick();
ok('saving the sheet saves to library', X.libLoad().length === 1);
els['calc'].onclick(); els['save'].onclick();
ok('re-saving same build updates, not duplicates', X.libLoad().length === 1);
fill(Object.assign({}, EVO, { name: 'Miata', cls: 'B', disc: 'road', dt: 'RWD' }));
els['calc'].onclick(); els['save'].onclick();
ok('different build adds entry', X.libLoad().length === 2);
els['lib'].onclick();
const lib = els['out'].innerHTML;
ok('library lists both', (lib.match(/class="libitem"/g) || []).length === 2);
ok('shows hp/1000lb', lib.indexOf('hp/1000lb') > -1);
ok('has Load + Delete', lib.indexOf('>Load<') > -1 && lib.indexOf('>Delete<') > -1);
ok('library clean', !/undefined|NaN/.test(lib));
if(/undefined|NaN/.test(lib)) console.log('   CONTEXT: '+(lib.match(/.{0,70}(undefined|NaN).{0,70}/)||[])[0]);

console.log('\n--- library load / delete ---');
const evoKey = X.libLoad().find(b => b.name.indexOf('Lancer') > -1).k;
els['out'].fire('click', { target: { dataset: { load: encodeURIComponent(evoKey) } } });
ok('Load restores form', els['name'].value === 'Lancer Evolution VIII MR' && els['cls'].value === 'A');
ok('Load recalculates tune', X.VIEW === 'tune' && X.BASE !== null);
els['lib'].onclick();
// delete is deliberately two-tap now (arm, then confirm)
const delTarget = { dataset: { del: encodeURIComponent(X.libLoad()[0].k) }, textContent: 'Delete' };
els['out'].fire('click', { target: delTarget });
ok('first tap only arms', X.libLoad().length === 2 && delTarget.textContent === 'Sure?');
els['out'].fire('click', { target: delTarget });
ok('Delete removes one', X.libLoad().length === 1, X.libLoad().length + ' left');
ok('list re-rendered', (els['out'].innerHTML.match(/class="libitem"/g) || []).length === 1);

console.log('\n--- peers appear once builds exist ---');
fill(EVO); els['calc'].onclick(); els['save'].onclick();
fill(Object.assign({}, EVO, { name: 'Evo IX', hp: '640', wt: '3300' })); els['calc'].onclick(); els['save'].onclick();
els['plan'].onclick();
ok('reference builds shown', els['out'].innerHTML.indexOf('Your finished A Sprint') > -1);
ok('peers labelled as own data', els['out'].innerHTML.indexOf('not a rule') > -1);

console.log('\n--- tune flow unaffected ---');
fill(EVO); els['calc'].onclick();
ok('tune still renders', els['out'].innerHTML.indexOf('Antiroll') > -1);
ok('adjust bar shown', els['adjust'].style.display === '');
els['save'].onclick();
ok('sheet still exports', blob.parts[0].indexOf('class="card"') > -1);
ok('sheet clean', !/undefined|NaN|\{\{/.test(blob.parts[0]));
