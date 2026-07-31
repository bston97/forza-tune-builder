const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob=null;
const URL={createObjectURL:b=>{blob=b;return'x'},revokeObjectURL(){}}, Blob=class{constructor(a){this.parts=a}};
eval(js+';globalThis.__X={planLoad,libLoad,carTitle};');
const X=globalThis.__X;
const ok=(l,c,e)=>console.log((c?'PASS  ':'FAIL  ')+l+(e!==undefined?'   '+e:''));
const set=(id,v)=>{document.getElementById(id).value=v};
const fill=o=>Object.keys(o).forEach(k=>set(k,o[k]));
const BLANK={name:'',year:'',wt:'',fw:'',hp:'',tq:'',pi:'',twf:'',twr:'',tsize:'',rpm:'',vmax:''};

console.log('--- Build Plan captures the starting stats ---');
fill(Object.assign({},BLANK,{name:'Lancer Evolution VIII MR',year:'2004',cls:'A',disc:'sprint',
  wt:'3241',fw:'57',hp:'276',tq:'253',dt:'AWD',pi:'512',gr:'5',tire:'stock',aero:'none'}));
els['plan'].onclick();
ok('starting point stored', X.planLoad().length===1, X.planLoad().length);
ok('stored stock hp not built hp', String(X.planLoad()[0].hp)==='276', X.planLoad()[0].hp);
ok('stored stock PI', String(X.planLoad()[0].pi)==='512');
ok('keyed by car only (no class)', X.planLoad()[0].k==='lancer evolution viii mr|2004', X.planLoad()[0].k);

console.log('--- re-planning the same car updates, does not duplicate ---');
set('cls','S1'); els['plan'].onclick();
ok('still one starting point', X.planLoad().length===1, X.planLoad().length);

console.log('--- unnamed cars are not stored ---');
els['newcar'].onclick();
fill(Object.assign({},BLANK,{wt:'3000',hp:'400'}));
els['plan'].onclick();
ok('no anonymous entry', X.planLoad().length===1, X.planLoad().length);

console.log('--- Find returns the starting point and restores the plan ---');
els['newcar'].onclick();
set('name','ferrari'); els['find'].onclick();
ok('genuine miss reports no match', /No saved car matches/.test(els['out'].innerHTML));
els['newcar'].onclick();
set('name','evo'); els['find'].onclick();
ok('partial mid-word matches (evo -> Evolution)', String(els['hp'].value)==='276', els['hp'].value);
els['newcar'].onclick();
set('name','lancer'); els['find'].onclick();
ok('stock stats prefilled', String(els['hp'].value)==='276'&&String(els['wt'].value)==='3241',
   els['hp'].value+' hp / '+els['wt'].value+' lb');
ok('PI prefilled', String(els['pi'].value)==='512');
ok('landed on the Build Plan, not a tune', /Build Plan/.test(els['out'].innerHTML));

console.log('--- both record types coexist and are labelled ---');
fill(Object.assign({},BLANK,{name:'Lancer Evolution VIII MR',year:'2004',cls:'A',disc:'sprint',
  wt:'3100',fw:'57',hp:'612',tq:'480',dt:'AWD',pi:'698',gr:'6',tire:'semi',aero:'both'}));
els['calc'].onclick(); els['save'].onclick();
ok('finished build stored separately', X.libLoad().length===1&&X.planLoad().length===1);
els['newcar'].onclick();
set('name','lancer'); els['find'].onclick();
const html=els['out'].innerHTML;
ok('both offered', /2 matches/.test(html));
ok('starting point labelled', /Starting point/.test(html)&&/tagp/.test(html));
ok('finished build labelled', /Finished build/.test(html));
ok('stock row shows stock hp', /276 hp \/ 3241 lb/.test(html));
ok('build row shows built hp', /612 hp \/ 3100 lb/.test(html));
ok('picker clean', !/NaN|undefined/.test(html));

console.log('--- picking each kind does the right thing ---');
els['out'].fire('click',{target:{dataset:{load:'p:'+encodeURIComponent(X.planLoad()[0].k)}}});
ok('stock pick -> plan view + stock stats', /Build Plan/.test(els['out'].innerHTML)&&String(els['hp'].value)==='276');
els['newcar'].onclick(); set('name','lancer'); els['find'].onclick();
els['out'].fire('click',{target:{dataset:{load:encodeURIComponent(X.libLoad()[0].k)}}});
ok('build pick -> tune view + built stats', /Antiroll/.test(els['out'].innerHTML)&&String(els['hp'].value)==='612');

console.log('--- autocomplete covers both stores ---');
ok('datalist lists the car once', (els['carlist'].innerHTML.match(/<option/g)||[]).length===1,
   (els['carlist'].innerHTML.match(/<option/g)||[]).length);

console.log('--- empty state mentions both paths ---');
localStorage.d={}; els['newcar'].onclick(); set('name','anything'); els['find'].onclick();
ok('empty message explains Build Plan + Save Sheet',
   /Run a Build Plan/.test(els['out'].innerHTML)&&/save a sheet/i.test(els['out'].innerHTML));
