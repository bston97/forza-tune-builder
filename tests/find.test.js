const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob=null;
const URL={createObjectURL:b=>{blob=b;return'x'},revokeObjectURL(){}}, Blob=class{constructor(a){this.parts=a}};
eval(js+';globalThis.__X={libLoad,carTitle};');
const X=globalThis.__X;
const ok=(l,c,e)=>console.log((c?'PASS  ':'FAIL  ')+l+(e!==undefined?'   '+e:''));
const set=(id,v)=>{document.getElementById(id).value=v};
const fill=o=>Object.keys(o).forEach(k=>set(k,o[k]));
const EVO={name:'Lancer Evolution VIII MR',year:'2004',cls:'A',disc:'sprint',wt:'3241',fw:'57',
  hp:'612',tq:'480',dt:'AWD',pi:'648',gr:'6',tire:'semi',aero:'both',twf:'0',twr:'0',vmax:''};

console.log('--- empty library ---');
set('name','evo'); els['find'].onclick();
ok('says nothing saved yet', /Nothing saved yet/.test(els['out'].innerHTML));

console.log('--- save two builds of one car + a different car ---');
fill(EVO); els['calc'].onclick(); els['save'].onclick();
fill(Object.assign({},EVO,{cls:'S1',disc:'road',hp:'700'})); els['calc'].onclick(); els['save'].onclick();
fill(Object.assign({},EVO,{name:'MX-5',year:'1994',cls:'C',disc:'touge',wt:'2150',fw:'52',
  hp:'180',tq:'140',dt:'RWD',pi:'',tire:'sport',aero:'none'}));
els['calc'].onclick(); els['save'].onclick();
ok('three builds stored', X.libLoad().length===3, X.libLoad().length);

console.log('--- datalist autocomplete ---');
const dl=els['carlist'].innerHTML;
ok('datalist populated', (dl.match(/<option/g)||[]).length===2, (dl.match(/<option/g)||[]).length+' unique cars');
ok('lists the Evo once (not per build)', (dl.match(/Lancer Evolution VIII MR/g)||[]).length===1);
ok('lists the MX-5', dl.indexOf('1994 MX-5')>-1);

console.log('--- single match prefills straight away ---');
els['newcar'].onclick();
set('name','mx-5'); els['find'].onclick();
ok('name prefilled', els['name'].value==='MX-5', els['name'].value);
ok('year prefilled', els['year'].value==='1994', els['year'].value);
ok('weight prefilled', String(els['wt'].value)==='2150', els['wt'].value);
ok('hp prefilled', String(els['hp'].value)==='180');
ok('drivetrain prefilled', els['dt'].value==='RWD');
ok('class/discipline restored', els['cls'].value==='C'&&els['disc'].value==='touge');
ok('auto-calculated', /Antiroll/.test(els['out'].innerHTML));

console.log('--- partial name, case-insensitive ---');
els['newcar'].onclick();
set('name','LANCER'); els['find'].onclick();
ok('multiple matches show a picker', /2 matches/.test(els['out'].innerHTML));
ok('picker shows both classes',
   /A 700/.test(els['out'].innerHTML) && /S1 800/.test(els['out'].innerHTML));
ok('picker has Use buttons', (els['out'].innerHTML.match(/>Use</g)||[]).length===2);

console.log('--- picking from the list loads it ---');
const key=encodeURIComponent(X.libLoad().find(b=>b.cls==='S1').k);
els['out'].fire('click',{target:{dataset:{load:key}}});
ok('picked build loaded', els['cls'].value==='S1'&&String(els['hp'].value)==='700');
ok('loaded build calculated', /Antiroll/.test(els['out'].innerHTML));

console.log('--- year narrows the search ---');
els['newcar'].onclick();
set('name','lancer'); set('year','2004'); els['find'].onclick();
ok('year+name still finds both (same year)', /2 matches/.test(els['out'].innerHTML));
els['newcar'].onclick();
set('name',''); set('year','1994'); els['find'].onclick();
ok('year alone finds the MX-5', els['name'].value==='MX-5');

console.log('--- misses and empties ---');
els['newcar'].onclick();
set('name','ferrari'); els['find'].onclick();
ok('no match explains why', /No saved car matches/.test(els['out'].innerHTML));
ok('mentions there is no car database', /no FH6 car database/.test(els['out'].innerHTML));
els['newcar'].onclick();
els['find'].onclick();
ok('blank search prompts for input', /Type part of a car name/.test(els['out'].innerHTML));

console.log('--- delete keeps the datalist in step ---');
els['lib'].onclick();
const delKey=encodeURIComponent(X.libLoad().find(b=>b.name==='MX-5').k);
const t={dataset:{del:delKey},textContent:'Delete'};
els['out'].fire('click',{target:t}); els['out'].fire('click',{target:t});
ok('MX-5 deleted', !X.libLoad().some(b=>b.name==='MX-5'));
ok('datalist dropped it', els['carlist'].innerHTML.indexOf('MX-5')===-1);
