const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob=null;
const URL={createObjectURL:b=>{blob=b;return'x'},revokeObjectURL(){}}, Blob=class{constructor(a){this.parts=a}};
eval(js+';globalThis.__X={carNotes,classForPI,PI_CEIL,libLoad};');
const X=globalThis.__X;
const ok=(l,c,e)=>console.log((c?'PASS  ':'FAIL  ')+l+(e!==undefined?'   '+e:''));
const strip=s=>s.replace(/<[^>]+>/g,'').replace(/&[a-z]+;/g,'');
const set=(id,v)=>{document.getElementById(id).value=v};

console.log('--- classForPI bands ---');
[[350,'D'],[400,'D'],[401,'C'],[500,'C'],[501,'B'],[600,'B'],[601,'A'],[700,'A'],
 [701,'S1'],[800,'S1'],[801,'S2'],[900,'S2'],[901,'R'],[998,'R'],[999,'X'],[1000,'X']]
 .forEach(([pi,exp])=>ok('  PI '+pi+' -> '+exp, X.classForPI(pi)===exp, X.classForPI(pi)));

console.log('\n--- headroom wording ---');
const base={name:'x',cls:'A',disc:'road',wt:3000,fw:52,hp:500,tq:400,dt:'RWD'};
const fitOf=o=>strip(X.carNotes(Object.assign({},base,o)).find(([k])=>k==='Class fit')[1]);
const cases=[[612,'under'],[700,'ceiling'],[688,'small'],[760,'over']];
cases.forEach(([pi])=>console.log('  PI '+pi+': '+fitOf({pi}).slice(0,120)));
ok('under-ceiling reports points to spend', /88 points to spend/.test(fitOf({pi:612})));
ok('exactly at ceiling', /exactly on the ceiling/.test(fitOf({pi:700})));
ok('over ceiling reports overage', /60 points over/.test(fitOf({pi:760})));
ok('small headroom advises light touch', /barely anything/.test(fitOf({pi:690})));
ok('large headroom advises chassis first', /whole chassis list/.test(fitOf({pi:520})));
ok('no PI falls back to power-to-weight', /power-to-weight alone/.test(fitOf({})));
ok('fallback invites the PI field', /Enter Current PI/.test(fitOf({})));
ok('no NaN with PI blank', !/NaN/.test(fitOf({})));
ok('no NaN with PI set', !/NaN/.test(fitOf({pi:612})));

console.log('\n--- plan surfaces budget + over-ceiling flag + reading list ---');
const fill=o=>{Object.keys(o).forEach(k=>set(k,o[k]))};
fill({name:'Evo',year:'2004',cls:'A',disc:'sprint',wt:'3241',fw:'57',hp:'612',tq:'480',
      dt:'AWD',pi:'648',gr:'6',tire:'semi',aero:'both'});
els['plan'].onclick();
let html=els['out'].innerHTML;
ok('PI budget line shown', /PI budget:/.test(html));
ok('headroom computed', /52 to spend/.test(html), (html.match(/(\d+) to spend/)||[])[0]);
ok('reading list present', /Worth reading/.test(html));
ok('HokiHoshi video linked', html.indexOf('I9bUB3mcqso')>-1);
ok('ForzaTune guide linked', html.indexOf('forzatune.com/guide')>-1);
ok('plan clean', !/NaN|undefined/.test(html));

set('pi','780'); els['plan'].onclick(); html=els['out'].innerHTML;
ok('over-ceiling raises a flag', /Already past the A ceiling/.test(html));
ok('flag names the right class', /build this as S1/.test(html));

set('pi',''); els['plan'].onclick(); html=els['out'].innerHTML;
ok('no PI: no budget line', !/PI budget:/.test(html));
ok('no PI: plan still clean', !/NaN|undefined/.test(html));

console.log('\n--- persistence + clear ---');
set('pi','648'); els['calc'].onclick(); els['save'].onclick();
ok('PI saved to library', Number(X.libLoad()[0].pi)===648, X.libLoad()[0].pi);
els['newcar'].onclick();
ok('New car clears PI', els['pi'].value==='');
