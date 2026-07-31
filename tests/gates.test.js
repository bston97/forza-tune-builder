const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob=null;
const URL={createObjectURL:b=>{blob=b;return'x'},revokeObjectURL(){}}, Blob=class{constructor(a){this.parts=a}};
eval(js+';globalThis.__C=compute;');
const C=globalThis.__C;
const ok=(l,c,e)=>console.log((c?'PASS  ':'FAIL  ')+l+(e!==undefined?'   '+e:''));
const base={name:'x',cls:'A',disc:'road',wt:3000,fw:52,hp:500,tq:400,dt:'RWD',gr:6,
  tire:'sport',aero:'both',twf:0,twr:0,susp:'race',arb:'both',trans:'sport',diff:'race'};
const at=o=>C(Object.assign({},base,o));
const nulls=(v,...ks)=>ks.every(k=>v[k]===null);
const has=(v,...ks)=>ks.every(k=>v[k]!==null);

console.log('--- suspension gates ---');
let v=at({susp:'race'}).v;
ok('race: everything present', has(v,'spF','rhF','reF','buF','camF','toeF','cast'));
v=at({susp:'stock'}).v;
ok('stock: springs+height blank', nulls(v,'spF','spR','rhF','rhR'));
ok('stock: damping+alignment blank', nulls(v,'reF','buF','camF','camR','toeF','toeR','cast'));
v=at({susp:'sport'}).v;
ok('sport: springs+height present', has(v,'spF','spR','rhF','rhR'));
ok('sport: damping+alignment blank', nulls(v,'reF','reR','buF','buR','camF','toeF','cast'));
v=at({susp:'rally',disc:'rally',dt:'AWD',tire:'rally'}).v;
ok('rally susp: full access', has(v,'spF','rhF','reF','camF','cast'));

console.log('--- ARB gates ---');
ok('both: two bars', has(at({arb:'both'}).v,'arF','arR'));
v=at({arb:'stock'}).v; ok('stock: no bars', nulls(v,'arF','arR'));
v=at({arb:'front'}).v; ok('front only', v.arF!==null&&v.arR===null);
v=at({arb:'rear'}).v;  ok('rear only',  v.arF===null&&v.arR!==null);

console.log('--- differential gates ---');
v=at({diff:'race'}).v;  ok('race RWD: accel+decel', has(v,'dra','drd'));
v=at({diff:'stock'}).v; ok('stock: nothing', nulls(v,'dfa','dfd','dra','drd','dc'));
v=at({diff:'sport'}).v; ok('sport: accel only', v.dra!==null&&v.drd===null);
v=at({diff:'street'}).v;ok('street: accel only', v.dra!==null&&v.drd===null);
v=at({diff:'race',dt:'AWD'}).v;  ok('race AWD: centre present', v.dc!==null);
v=at({diff:'sport',dt:'AWD'}).v; ok('sport AWD: no centre, no decel', v.dc===null&&v.drd===null&&v.dfa!==null);

console.log('--- aero gates ---');
ok('both',  has(at({aero:'both'}).v,'aeF','aeR'));
v=at({aero:'front'}).v; ok('front only', v.aeF!==null&&v.aeR===null);
v=at({aero:'rear'}).v;  ok('rear only',  v.aeF===null&&v.aeR!==null);
v=at({aero:'none'}).v;  ok('none',       nulls(v,'aeF','aeR'));

console.log('--- tire width steps drive brake bias ---');
const bal=(f,r)=>at({twf:f,twr:r}).v.bal;
ok('equal steps = weight split', bal(0,0)===52, bal(0,0));
ok('wider rear moves bias back', bal(0,2)<bal(0,0), bal(0,0)+' -> '+bal(0,2));
ok('wider front moves bias forward', bal(2,0)>bal(0,0), bal(0,0)+' -> '+bal(2,0));
ok('stock/stock is not treated as missing', bal(0,0)===bal(1,1), bal(1,1));

console.log('--- warnings name the missing part ---');
const wtext=o=>at(o).w.join(' ').replace(/<[^>]+>/g,'');
ok('stock diff warned', /No differential fitted/.test(wtext({diff:'stock'})));
ok('sport diff warned', /acceleration only/i.test(wtext({diff:'sport'})));
ok('stock susp warned', /Stock suspension/.test(wtext({susp:'stock'})));
ok('sport susp warned', /damping and alignment/.test(wtext({susp:'sport'})));
ok('stock ARB warned', /Stock anti-roll bars/.test(wtext({arb:'stock'})));
ok('single ARB warned', /front only/i.test(wtext({arb:'front'})));
ok('stock trans warned', /Stock transmission/.test(wtext({trans:'stock'})));
ok('fully-built car warns about none of it', !/differential fitted|Stock suspension|Stock anti-roll/.test(wtext({})));

console.log('--- render shows locked sections instead of blanks ---');
const set=(id,x)=>{document.getElementById(id).value=x};
Object.keys(base).forEach(k=>set(k,base[k]));
set('name','Stripped'); set('susp','stock'); set('arb','stock'); set('diff','stock'); set('trans','stock');
els['calc'].onclick();
const html=els['out'].innerHTML;
ok('no empty value cells', !/<div class="v"><\/div>/.test(html));
ok('alignment marked locked', /Needs race springs and dampers/.test(html));
ok('springs marked locked', /Stock suspension &mdash; no sliders|Stock suspension — no sliders/.test(html));
ok('ARB marked locked', /Stock bars/.test(html));
ok('diff marked locked', /Stock differential/.test(html));
ok('gearing flags stock box', /No final drive slider/.test(html));
ok('render clean', !/NaN|undefined/.test(html));
els['save'].onclick();
ok('sheet clean with everything locked', !/NaN|undefined|\{\{/.test(blob.parts[0]));
