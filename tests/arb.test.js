/* Anti-roll bars move in 0.1 increments in-game — 29.60, 29.70, 29.80, never
   29.65. Boston confirmed this 2026-07-31. `snap()` already enforces it via
   VMETA (s:0.1, d:1); this file exists so a later change to the ARB formula,
   the fix deltas, or the rounding grain cannot quietly put a value on screen
   that the game will not accept. */
const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();
let blob = null;
const URL = { createObjectURL: b => { blob = b; return 'x'; }, revokeObjectURL() {} };
const Blob = class { constructor(a) { this.parts = a; } };
eval(js + ';globalThis.__X={compute,VMETA,snap,FIX,eff};');
const X = globalThis.__X;
const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '   ' + e : ''));
const set = (id, v) => { document.getElementById(id).value = v; };
/* On the 0.1 grid — compared as tenths so float noise in the test itself
   cannot mask float noise in the app. */
const onGrid = v => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;

console.log('--- the metadata says one decimal ---');
['arF', 'arR'].forEach(k => {
  ok(k + ' step is 0.1', X.VMETA[k].s === 0.1, X.VMETA[k].s);
  ok(k + ' prints one decimal', X.VMETA[k].d === 1, X.VMETA[k].d);
});

console.log('--- every baseline value the engine can produce ---');
const base = { name: 'x', cls: 'A', disc: 'road', wt: 3000, fw: 52, hp: 500, tq: 400, dt: 'RWD',
  gr: 6, tire: 'sport', aero: 'both', twf: 0, twr: 0, susp: 'race', arb: 'both',
  trans: 'sport', diff: 'race' };
let checked = 0, off = [];
for (let wt = 1400; wt <= 6000; wt += 53)
for (const fw of [38, 41.3, 44, 47.7, 50, 52.4, 55, 57.9, 60, 63.1])
for (const disc of ['road', 'sprint', 'touge', 'drift', 'drag', 'rally', 'cc']) {
  const v = X.compute(Object.assign({}, base, { wt, fw, disc,
    dt: disc === 'rally' || disc === 'cc' ? 'AWD' : 'RWD',
    tire: disc === 'rally' ? 'rally' : disc === 'cc' ? 'offroad' : disc === 'drag' ? 'dragt' : 'sport' })).v;
  for (const k of ['arF', 'arR']) {
    if (v[k] == null) continue;
    checked++;
    if (!onGrid(v[k])) off.push(disc + ' ' + wt + 'lb ' + fw + '% ' + k + '=' + v[k]);
  }
}
ok(checked + ' baseline ARB values all on the 0.1 grid', off.length === 0,
   off.length ? off.slice(0, 4).join(' | ') : checked + ' checked');

console.log('--- and after the fixes, which scale ARB by a percentage ---');
Object.keys(base).forEach(k => set(k, base[k]));
set('name', 'ARB'); els['calc'].onclick();
let after = 0, offFix = [];
for (const key of Object.keys(X.FIX)) {
  els['reset'].onclick();
  for (let pass = 0; pass < 25; pass++) {          // stack until it hits the rails
    set('sym', key); els['apply'].onclick();
    for (const k of ['arF', 'arR']) {
      const v = X.eff(k); if (v == null) continue;
      after++;
      if (!onGrid(v)) offFix.push(key + ' pass' + pass + ' ' + k + '=' + v);
    }
  }
}
ok(after + ' post-fix ARB values all on the 0.1 grid', offFix.length === 0,
   offFix.length ? offFix.slice(0, 4).join(' | ') : after + ' checked');

console.log('--- a half-step typed in by hand is snapped, not kept ---');
els['reset'].onclick();
const typed = v => { els['out'].fire('change', { target: { dataset: { k: 'arF' }, value: v } }); return X.eff('arF'); };
ok('29.65 does not survive', onGrid(typed('29.65')), '29.65 -> ' + X.eff('arF'));
ok('29.64 -> 29.6', typed('29.64') === 29.6, X.eff('arF'));
ok('29.66 -> 29.7', typed('29.66') === 29.7, X.eff('arF'));
ok('12.05 lands on the grid', onGrid(typed('12.05')), '12.05 -> ' + X.eff('arF'));
ok('below the floor clamps to 1', typed('0.4') === 1);
ok('above the ceiling clamps to 65', typed('999') === 65);

console.log('--- and one decimal is what reaches the screen ---');
els['reset'].onclick();
const shown = (els['out'].innerHTML.match(/data-k="ar[FR]" value="([^"]*)"/g) || [])
  .map(m => m.match(/value="([^"]*)"/)[1]);
ok('two ARB inputs rendered', shown.length === 2, shown.join(' '));
ok('each shows exactly one decimal', shown.every(s => /^\d+\.\d$/.test(s)), shown.join(' '));
els['save'].onclick();
const arb = blob.parts[0].split('>Antiroll Bars<')[1].split('sec-springs')[0];
const paper = (arb.match(/class="row-value[^"]*">([^<]*)</g) || []).map(m => m.replace(/.*">/, '').replace('<', ''));
ok('sheet shows one decimal too', paper.length === 2 && paper.every(s => /^\d+\.\d$/.test(s)), paper.join(' '));
