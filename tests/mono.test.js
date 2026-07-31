const { readScript, makeShim } = require('./shim');
const { els, document, window, localStorage } = makeShim();
const js = readScript();

const URL={createObjectURL:()=>'x',revokeObjectURL(){}}, Blob=class{constructor(a){this.parts=a}};
eval(js+';globalThis.__X={compute};');
const C=globalThis.__X.compute;
const base={name:'x',cls:'A',disc:'road',wt:3000,fw:50,hp:500,tq:400,dt:'RWD',gr:6,
  tire:'sport',aero:'rear',twf:NaN,twr:NaN};
const at=o=>C(Object.assign({},base,o)).v;

let bad=[];
function sweep(label,key,from,to,step,checks){
  let prev=null;
  for(let x=from;x<=to;x+=step){
    const v=at({[key]:x});
    if(prev) for(const [name,fn] of checks){
      const r=fn(prev.v,v,prev.x,x);
      if(r===false) bad.push(label+': '+name+' broke between '+key+'='+prev.x+' and '+x);
    }
    prev={x,v};
  }
}
const up  =k=>[k+' rises',       (a,b)=>b[k]>=a[k]-1e-9];
const down=k=>[k+' falls',       (a,b)=>b[k]<=a[k]+1e-9];

console.log('weight 1500 -> 6000 (road, 50/50)');
sweep('weight','wt',1500,6000,100,[up('spF'),up('spR'),up('arF'),up('arR'),up('reF')]);

console.log('front% 30 -> 70');
sweep('front%','fw',30,70,1,[up('spF'),down('spR'),up('arF'),down('arR'),up('reF'),down('reR'),up('bal')]);

console.log('torque 150 -> 1200 (diff accel should ease off)');
sweep('torque','tq',150,1200,25,[down('dra')]);

console.log('hp 100 -> 1600 (final drive should lengthen)');
sweep('hp','hp',100,1600,25,[down('fd')]);

console.log('gears 4 -> 10 (more gears -> shorter final drive)');
sweep('gears','gr',4,10,1,[up('fd')]);

// continuity: no single step should jump absurdly
console.log('\ncontinuity (max single-step jump over weight sweep)');
let prev=null,worst={};
for(let w=1500;w<=6000;w+=50){
  const v=at({wt:w});
  if(prev) for(const k of ['spF','arF','reF','buF','pF','bal']){
    const d=Math.abs(v[k]-prev[k]);
    if(!worst[k]||d>worst[k].d) worst[k]={d,at:w};
  }
  prev=v;
}
for(const k in worst) console.log('  '+k.padEnd(5)+' max jump '+worst[k].d.toFixed(2)+' at '+worst[k].at+' lb');

if(bad.length){
  console.log('\n!!! '+bad.length+' MONOTONICITY BREAK(S):');
  bad.slice(0,15).forEach(b=>console.log('FAIL  '+b));
} else {
  console.log('\nPASS  all sweeps monotonic in the expected direction');
}
