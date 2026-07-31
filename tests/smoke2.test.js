const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let capturedBlob = null, capturedName = '';
const URL = { createObjectURL: b => { capturedBlob = b; return 'blob:x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };

// getters so reassigned bindings (X.LOG/ADJ/BASE) stay live
eval(js + ';globalThis.__X={FIX,VMETA,snap,fmt,eff,' +
     'get LOG(){return LOG},get ADJ(){return ADJ},get BASE(){return BASE}};');
const X = globalThis.__X;
const FIX = X.FIX;

const ok = (label, cond, extra) => console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '   ' + extra : ''));
const set = (id, v) => { document.getElementById(id).value = v; };
function build(o) {
  Object.keys(o).forEach(k => set(k, o[k]));
  els['calc'].onclick();
}
const val = k => X.eff(k);

console.log('--- setup ---');
ok('script evaluates', true);
ok('symptom dropdown built', (els['sym'].innerHTML.match(/<option/g) || []).length === Object.keys(FIX).length,
  (els['sym'].innerHTML.match(/<option/g) || []).length + ' options');
ok('dropdown grouped', (els['sym'].innerHTML.match(/<optgroup/g) || []).length === 5);

console.log('\n--- AWD sprint baseline ---');
build({ name: 'Evo', cls: 'A', disc: 'sprint', wt: '3241', fw: '57', hp: '612', tq: '480',
        dt: 'AWD', gr: '6', tire: 'semi', aero: 'both', twf: '265', twr: '285' });
ok('adjust panel shown', els['adjust'].style.display === '');
ok('outputs are editable inputs', (els['out'].innerHTML.match(/class="vi/g) || []).length >= 20,
  (els['out'].innerHTML.match(/class="vi/g) || []).length + ' inputs');
const b_arF = val('arF'), b_reF = val('reF'), b_buF = val('buF'), b_bal = val('bal');
console.log('   baseline: arF=' + b_arF + ' reF=' + b_reF + ' buF=' + b_buF + ' bal=' + b_bal);

console.log('\n--- apply: understeer on turn-in ---');
set('sym', 'entry_us'); els['apply'].onclick();
ok('ARB front softened', val('arF') < b_arF, b_arF + ' -> ' + val('arF'));
ok('rebound front reduced', val('reF') < b_reF, b_reF + ' -> ' + val('reF'));
ok('brake bias moved rearward', val('bal') < b_bal, b_bal + ' -> ' + val('bal'));
ok('bump auto-followed rebound', Math.abs(val('buF') - val('reF') * 0.63) < 0.06,
  'buF=' + val('buF') + ' (0.63*reF=' + (val('reF') * 0.63).toFixed(2) + ')');
ok('log recorded', X.LOG.length === 1 && X.LOG[0].c.length >= 4, X.LOG[0].c.length + ' changes');
ok('auto change flagged', X.LOG[0].c.some(c => c.auto));
ok('modified values highlighted', els['out'].innerHTML.indexOf('vi mod') > -1);

console.log('\n--- apply same fix twice (cumulative) ---');
const once = val('arF');
els['apply'].onclick();
ok('second application stacks', val('arF') < once, once + ' -> ' + val('arF'));
ok('two log entries', X.LOG.length === 2);

console.log('\n--- manual edit ---');
els['out'].fire('change', { target: { dataset: { k: 'dc' }, value: '64' } });
ok('manual value applied', val('dc') === 64, 'dc=' + val('dc'));
ok('manual edit logged', X.LOG[X.LOG.length - 1].l === 'Manual edit');
els['out'].fire('change', { target: { dataset: { k: 'buR' }, value: '9.9' } });
const beforeReR = val('reR');
els['out'].fire('change', { target: { dataset: { k: 'reR' }, value: String(beforeReR + 2) } });
ok('bump stops following once set by hand', val('buR') === 9.9, 'buR=' + val('buR'));

console.log('\n--- snapping to legal increments ---');
els['out'].fire('change', { target: { dataset: { k: 'pF' }, value: '31.37' } });
ok('psi snapped to 0.5', val('pF') === 31.5, '31.37 -> ' + val('pF'));
els['out'].fire('change', { target: { dataset: { k: 'arF' }, value: '200' } });
ok('ARB clamped to 65 max', val('arF') === 65, '200 -> ' + val('arF'));
els['out'].fire('change', { target: { dataset: { k: 'reF' }, value: 'abc' } });
ok('non-numeric edit ignored', isFinite(val('reF')));

console.log('\n--- export: template sheet (AWD, both aero, adjusted) ---');
els['save'].onclick();
const sh = capturedBlob.parts[0];
ok('uses tune-card template', sh.indexOf('class="card"') > -1 && sh.indexOf('Barlow') > -1);
ok('no editable inputs', sh.indexOf('<input') === -1);
ok('no build warnings', sh.indexOf('class="warn"') === -1);
ok('no unreplaced placeholders', sh.indexOf('{{') === -1);
ok('9 tune sections + adjustments + notes', (sh.match(/class="section"/g) || []).length === 11,
  (sh.match(/class="section"/g) || []).length + ' sections');
ok('gear grid matches gear count', sh.indexOf('gear-grid-6') > -1);
ok('AWD shows center diff', sh.indexOf('diff-center') > -1);
ok('front decel flagged green at 0', sh.indexOf('val-zero') > -1);
ok('adjustments section present', sh.indexOf('Adjustments from baseline') > -1);
// assert the shape, not a specific baseline — those move when constants are recalibrated
ok('adjustments listed with before/after', /ARB F \d+\.\d+ &rarr; \d+\.\d+/.test(sh));
ok('springs show absolute lb/in', /605 lb\/in/.test(sh));
ok('ride height as % of range', /% of range/.test(sh));
ok('no obsolete slider-range block', sh.indexOf('Slider Ranges') === -1);
ok('no undefined/NaN leaked', !/undefined|NaN/.test(sh));

console.log('\n--- reset ---');
els['reset'].onclick();
ok('values back to baseline', val('arF') === b_arF && val('bal') === b_bal && val('dc') !== 64);
ok('log cleared', X.LOG.length === 0);
ok('no mod highlighting', els['out'].innerHTML.indexOf('vi mod') === -1);

console.log('\n--- drivetrain-aware fixes ---');
build({ name: 'Miata', cls: 'B', disc: 'road', wt: '2200', fw: '48', hp: '340', tq: '260',
        dt: 'RWD', gr: '6', tire: 'sport', aero: 'none', twf: '', twr: '' });
ok('RWD has no center diff', val('dc') === null);
ok('RWD has no front accel', val('dfa') === null);
const rwdAccel = val('dra');
set('sym', 'spin'); els['apply'].onclick();
ok('RWD wheelspin cuts rear accel', val('dra') < rwdAccel, rwdAccel + ' -> ' + val('dra'));
ok('no null params touched', X.LOG[0].c.every(c => c.from !== null));

console.log('\n--- fix targeting absent params degrades safely ---');
els['reset'].onclick();
set('sym', 'mid_us'); els['apply'].onclick();   // wants aeF + dc, neither exists on this build
ok('applied only what exists', X.LOG.length === 1 && X.LOG[0].c.every(c => ['arF', 'spF'].includes(c.k)),
  X.LOG[0].c.map(c => c.k).join(','));

console.log('\n--- FWD ---');
build({ name: 'Civic', cls: 'C', disc: 'touge', wt: '2400', fw: '62', hp: '220', tq: '190',
        dt: 'FWD', gr: '6', tire: 'sport', aero: 'none', twf: '', twr: '' });
const fwdAccel = val('dfa');
set('sym', 'exit_us'); els['apply'].onclick();
ok('FWD push cuts front accel', val('dfa') < fwdAccel, fwdAccel + ' -> ' + val('dfa'));

console.log('\n--- new Calculate resets adjustments ---');
build({ name: 'Civic', cls: 'C', disc: 'touge', wt: '2350', fw: '62', hp: '220', tq: '190',
        dt: 'FWD', gr: '6', tire: 'sport', aero: 'none', twf: '', twr: '' });
ok('ADJ cleared on recalculate', Object.keys(X.ADJ).length === 0 && X.LOG.length === 0);

console.log('\n--- sheet variants by drivetrain / aero ---');
function sheetFor(o) {
  Object.keys(o).forEach(k => set(k, o[k]));
  els['calc'].onclick();
  els['save'].onclick();
  return capturedBlob.parts[0];
}
const body = s => s.split('</style>')[1];   // CSS ships in every sheet; assert on markup only
const rwd = sheetFor({ name: 'Miata', cls: 'B', disc: 'road', wt: '2200', fw: '48', hp: '340', tq: '260',
  dt: 'RWD', gr: '6', tire: 'sport', aero: 'rear', twf: '', twr: '' });
ok('RWD: single axle box, no center',
  body(rwd).indexOf('diff-center') === -1 && body(rwd).indexOf('diff-axle-row single') > -1);
ok('RWD: labels Rear Axle', body(rwd).indexOf('Rear Axle') > -1 && body(rwd).indexOf('Front Axle') === -1);
ok('rear-only aero: front not adjustable', rwd.indexOf('Not adjustable') > -1);
ok('rear-only aero: balance caveat', rwd.indexOf('not a reliable target') > -1);
ok('RWD: no AWD decel note', rwd.indexOf('Front decel is 0% by design') === -1);
ok('RWD: no adjustments section when clean', rwd.indexOf('Adjustments from baseline') === -1);
ok('RWD sheet clean', !/undefined|NaN|\{\{/.test(rwd));

const fwd = sheetFor({ name: 'Civic Type R', cls: 'C', disc: 'touge', wt: '2400', fw: '62', hp: '220', tq: '190',
  dt: 'FWD', gr: '5', tire: 'sport', aero: 'none', twf: '', twr: '' });
ok('FWD: labels Front Axle', body(fwd).indexOf('Front Axle') > -1 && body(fwd).indexOf('Rear Axle') === -1);
ok('FWD: gear grid 5', fwd.indexOf('gear-grid-5') > -1);
ok('no aero: shows none message', fwd.indexOf('No adjustable aero') > -1);
ok('FWD sheet clean', !/undefined|NaN|\{\{/.test(fwd));

const drag = sheetFor({ name: 'Supra', cls: 'S2', disc: 'drag', wt: '3000', fw: '52', hp: '1400', tq: '1100',
  dt: 'AWD', gr: '10', tire: 'dragt', aero: 'none', twf: '', twr: '' });
ok('drag: gear grid 10', drag.indexOf('gear-grid-10') > -1);
ok('drag: front psi near cap', /50\.0 psi/.test(drag));
ok('drag: drag-specific tire note', drag.indexOf('55 psi cap') > -1);
ok('drag: aero none message', drag.indexOf('costs trap speed') > -1);
ok('drag sheet clean', !/undefined|NaN|\{\{/.test(drag));

const cc = sheetFor({ name: 'Bronco', cls: 'B', disc: 'cc', wt: '4200', fw: '55', hp: '380', tq: '400',
  dt: 'AWD', gr: '4', tire: 'offroad', aero: 'none', twf: '', twr: '' });
ok('CC: gear grid 4 (added rule)', cc.indexOf('gear-grid-4') > -1);
ok('CC: max ride height not shown as minimum', cc.indexOf('100% of range') > -1);
ok('CC sheet clean', !/undefined|NaN|\{\{/.test(cc));
