const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

let blob=null;
const URL={createObjectURL:b=>{blob=b;return'x'},revokeObjectURL(){}}, Blob=class{constructor(a){this.parts=a}};
eval(js+';globalThis.__X={get BASE(){return BASE}};');
const ok=(l,c,e)=>console.log((c?'PASS  ':'FAIL  ')+l+(e!==undefined?'   '+e:''));
const set=(id,v)=>{document.getElementById(id).value=v};
const CAR={name:'Lancer Evolution VIII MR',year:'2004',cls:'A',disc:'sprint',wt:'3241',fw:'57',
  hp:'612',tq:'480',dt:'AWD',gr:'6',tire:'semi',aero:'both',twf:'265',twr:'285'};
Object.keys(CAR).forEach(k=>set(k,CAR[k]));

els['calc'].onclick();
const tune=els['out'].innerHTML;
ok('tune header shows year', tune.indexOf('2004 Lancer Evolution VIII MR')>-1);

els['plan'].onclick();
const plan=els['out'].innerHTML;
ok('plan header shows year', plan.indexOf('2004 Lancer Evolution VIII MR')>-1);
ok('car notes section present', plan.indexOf('The car, read off the numbers')>-1);
['Character','Engine','Balance','Drivetrain','Naturally suits','Class fit'].forEach(k=>
  ok('  note: '+k, plan.indexOf('<b>'+k+'</b>')>-1));
ok('notes carry the PI caveat', plan.indexOf('simulated lap')>-1);
ok('plan clean', !/undefined|NaN/.test(plan));

els['calc'].onclick(); els['save'].onclick();
const sheetHtml=blob.parts[0];
ok('sheet sub-line shows year', sheetHtml.indexOf('2004 · 6-Speed')>-1);
ok('sheet title has year', /<title>2004 Lancer/.test(sheetHtml));
ok('sheet clean', !/undefined|NaN|\{\{/.test(sheetHtml));

els['lib'].onclick();
ok('library row shows year', els['out'].innerHTML.indexOf('2004 Lancer Evolution VIII MR')>-1);
ok('library clean', !/undefined|NaN/.test(els['out'].innerHTML));

// same model, different year must be two entries
set('year','2006'); set('name','Lancer Evolution IX MR');
els['calc'].onclick(); els['save'].onclick();
els['lib'].onclick();
ok('distinct years stored separately', (els['out'].innerHTML.match(/class="libitem"/g)||[]).length===2,
   (els['out'].innerHTML.match(/class="libitem"/g)||[]).length+' entries');

// blank year must not break anything
set('year',''); set('name','No Year Car');
els['calc'].onclick();
ok('blank year renders cleanly', !/undefined|NaN/.test(els['out'].innerHTML));
els['save'].onclick();
ok('blank-year sheet clean', !/undefined|NaN|\{\{/.test(blob.parts[0]));
