const fs = require('fs');
const path = require('path');
const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(js + ';globalThis.__X={carNotes,autoParts,libLoad};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));
const set = (id, v) => { document.getElementById(id).value = v; };

console.log('--- carNotes degrades without tq / fw ---');
const minimal = X.carNotes({ name: 'X', cls: 'A', disc: 'road', wt: 3000, hp: 500, dt: 'RWD', tq: NaN, fw: NaN });
const joined = minimal.map(([k, v]) => k + ':' + v).join(' ');
ok('no NaN in notes', !/NaN/.test(joined));
ok('Engine note skipped', !minimal.some(([k]) => k === 'Engine'));
ok('Balance note skipped', !minimal.some(([k]) => k === 'Balance'));
ok('Character + Class fit still present',
  minimal.some(([k]) => k === 'Character') && minimal.some(([k]) => k === 'Class fit'));
const full = X.carNotes({ name: 'X', cls: 'A', disc: 'road', wt: 3000, hp: 500, tq: 400, fw: 52, dt: 'RWD' });
ok('full stats give all six notes', full.length === 6, full.length);

console.log('--- plan with minimal stats renders clean ---');
set('name', 'Mystery'); set('year', ''); set('cls', 'A'); set('disc', 'road');
set('wt', '3000'); set('hp', '500'); set('fw', ''); set('tq', ''); set('dt', 'RWD'); set('gr', '6');
set('tire', 'semi'); set('aero', 'both');
els['plan'].onclick();
ok('plan renders', els['out'].innerHTML.indexOf('Build Plan') > -1);
ok('plan has no NaN', !/NaN|undefined/.test(els['out'].innerHTML));

console.log('--- New car clears everything typed, keeps context ---');
set('name', 'Evo'); set('year', '2004'); set('wt', '3241'); set('fw', '57'); set('hp', '612');
set('tq', '480'); set('twf', '2'); set('twr', '3');
set('vmax', '191'); set('fdfit', '4.20'); set('vgraph', '160'); set('cls', 'S1'); set('disc', 'touge');
els['calc'].onclick();
ok('calc worked first', els['save'].disabled === false);
els['newcar'].onclick();
const cleared = ['name', 'year', 'wt', 'fw', 'hp', 'tq', 'pi', 'vmax', 'fdfit', 'vgraph']
  .every(id => els[id].value === '');
ok('all typed fields cleared (incl hidden optional)', cleared);
ok('width/trans/diff reset to defaults',
  els['twf'].value === '0' && els['twr'].value === '0' &&
  els['trans'].value === 'sport' && els['diff'].value === 'race');
ok('class/event kept', els['cls'].value === 'S1' && els['disc'].value === 'touge');
ok('parts re-defaulted for S1', els['tire'].value === 'slick' && els['aero'].value === 'both');
ok('save disabled again', els['save'].disabled === true);

console.log('--- library: load clears unset fields, delete needs two taps ---');
set('name', 'Evo'); set('year', '2004'); set('cls', 'A'); set('disc', 'sprint');
set('wt', '3241'); set('fw', '57'); set('hp', '612'); set('tq', '480'); set('dt', 'AWD');
set('gr', '6'); set('tire', 'semi'); set('aero', 'both');
set('vmax', ''); set('fdfit', ''); set('vgraph', ''); set('twf', ''); set('twr', '');
els['calc'].onclick(); els['save'].onclick();
ok('saved to library', X.libLoad().length === 1);
// dirty the optional fields, then Load — they must come back empty
set('vmax', '999'); set('fdfit', '9.99'); set('vgraph', '999');
const key = encodeURIComponent(X.libLoad()[0].k);
els['out'].fire('click', { target: { dataset: { load: key } } });
ok('load clears fields the build did not set',
  els['vmax'].value === '' && els['fdfit'].value === '' && els['vgraph'].value === '');
ok('load auto-calculated', /Antiroll/.test(els['out'].innerHTML));

els['lib'].onclick();
const delBtn = { dataset: { del: key }, textContent: 'Delete' };
els['out'].fire('click', { target: delBtn });
ok('first tap arms, does not delete', X.libLoad().length === 1 && delBtn.textContent === 'Sure?');
els['out'].fire('click', { target: delBtn });
ok('second tap deletes', X.libLoad().length === 0);

console.log('--- inputmode present in markup ---');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// every numeric input must carry an inputmode, whatever the count happens to be
const numInputs = html.match(/<input[^>]*type="number"[^>]*>/g) || [];
const missing = numInputs.filter(t => !/inputmode=/.test(t))
                         .map(t => (t.match(/id="([^"]*)"/) || [])[1]);
ok('every numeric field declares inputmode', missing.length === 0,
   numInputs.length + ' numeric fields' + (missing.length ? ', missing: ' + missing.join(',') : ''));
