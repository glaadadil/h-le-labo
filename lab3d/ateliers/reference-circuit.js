// Shared L6 network: the approved 6 V / 1 ohm battery for series, or the
// explicitly regulated 6 V source for the parallel-branch workshop.
import {lampI,series} from './modules/electricite-common.js';
export const parallelBench=s=>typeof s.main==='boolean';
export const switchIds=s=>s.switches??['interrupteur',...(parallelBench(s)&&s.branchSwitches!==false?Array.from({length:s.n},(_,i)=>`B${i}`):[])];
export const switchClosed=(s,id)=>s.switchStates?.[id]??(id==='interrupteur'?(parallelBench(s)?s.main:s.closed):s[`b${id.slice(1)}`]);
export const lampRemoved=(s,i)=>parallelBench(s)?(s.unscrewed??[]).includes(i):s.removed===String(i);
export const terminals=s=>['pile:p','pile:m',...switchIds(s).flatMap(id=>[`${id}:a`,`${id}:b`]),...Array.from({length:s.n},(_,i)=>[`L${i}:a`,`L${i}:b`]).flat(),...(s.extraTerminals??[])];
export function seriesWires(s){
  const lamps=Array.from({length:s.n},(_,i)=>i);if(s.reversed)lamps.reverse();
  const wires=[];let prev='pile:p';
  for(const i of lamps){wires.push({a:prev,b:`L${i}:a`});prev=`L${i}:b`;}
  wires.push({a:prev,b:'interrupteur:a'},{a:'interrupteur:b',b:'pile:m'});
  return wires;
}
export function parallelWires(s){return [{a:'pile:p',b:'interrupteur:a'},...Array.from({length:s.n},(_,i)=>[{a:'interrupteur:b',b:`B${i}:a`},{a:`B${i}:b`,b:`L${i}:a`},{a:`L${i}:b`,b:'pile:m'}]).flat()];}
export const wiresFor=s=>s.connections??(parallelBench(s)?parallelWires(s):seriesWires(s));
export function validWires(s){
  if(s.connections===undefined)return true;
  const ports=terminals(s),seen=new Set();
  return Array.isArray(s.connections)&&s.connections.length<=24&&s.connections.every(w=>{
    if(!w||!ports.includes(w.a)||!ports.includes(w.b)||w.a===w.b)return false;
    const key=[w.a,w.b].sort().join('|');if(seen.has(key))return false;seen.add(key);return true;
  });
}
// Union ideal wires and closed switches, then solve the monotone
// nonlinear resistor network by damped Newton steps (not by its screen layout).
export function solveCircuit(s){
  const ts=terminals(s),p=Object.fromEntries(ts.map(t=>[t,t]));
  const find=t=>p[t]===t?t:(p[t]=find(p[t]));const join=(a,b)=>p[find(a)]=find(b);
  for(const w of [...wiresFor(s),...(s.conductors??[])])join(w.a,w.b);for(const id of switchIds(s))if(switchClosed(s,id))join(`${id}:a`,`${id}:b`);
  const plus=find('pile:p'),ground=find('pile:m');
  const regulated=parallelBench(s),fault=()=>({fault:true,current:null,voltage:null,short:plus===ground,lamps:Array.from({length:s.n},()=>({u:null,i:null,p:null})),lit:0,inSeries:false,inParallel:false});
  if(regulated&&plus===ground)return fault();
  const edges=Array.from({length:s.n},(_,i)=>({a:find(`L${i}:a`),b:find(`L${i}:b`),live:!lampRemoved(s,i)}));
  const anchored=new Set([plus,ground]);let changed=true;
  while(changed){changed=false;for(const e of edges)if(e.live&&(anchored.has(e.a)||anchored.has(e.b)))for(const n of [e.a,e.b])if(!anchored.has(n)){anchored.add(n);changed=true;}}
  const nodes=[...anchored].filter(n=>n!==ground&&(!regulated||n!==plus)),index=new Map(nodes.map((n,i)=>[n,i]));
  let x=nodes.map(n=>n===plus?6:3);
  const evaluate=values=>{
    const f=nodes.map(()=>0),j=nodes.map(()=>nodes.map(()=>0)),v=n=>n===ground?0:regulated&&n===plus?6:values[index.get(n)];
    const add=(a,b,i,g)=>{const ai=index.get(a),bi=index.get(b);if(ai!==undefined){f[ai]+=i;j[ai][ai]+=g;if(bi!==undefined)j[ai][bi]-=g;}if(bi!==undefined){f[bi]-=i;j[bi][bi]+=g;if(ai!==undefined)j[bi][ai]-=g;}};
    if(!regulated&&plus!==ground){const i=index.get(plus);f[i]+=v(plus)-6;j[i][i]+=1;}
    for(const e of edges)if(e.live&&anchored.has(e.a)&&e.a!==e.b){const i=lampI(v(e.a)-v(e.b));add(e.a,e.b,i,1/(10+200/3*Math.abs(i)));}
    return {f,j,v,norm:Math.max(0,...f.map(Math.abs))};
  };
  for(let iter=0;iter<60;iter++){
    const r=evaluate(x);if(r.norm<1e-11)break;
    const a=r.j.map((row,i)=>[...row,r.f[i]]),n=a.length;
    for(let i=0;i<n;i++){let best=i;for(let k=i+1;k<n;k++)if(Math.abs(a[k][i])>Math.abs(a[best][i]))best=k;[a[i],a[best]]=[a[best],a[i]];const d=a[i][i];if(Math.abs(d)<1e-15)throw Error('Circuit singular');for(let k=i;k<=n;k++)a[i][k]/=d;for(let k=0;k<n;k++)if(k!==i){const m=a[k][i];for(let c=i;c<=n;c++)a[k][c]-=m*a[i][c];}}
    let t=1,next;do{next=x.map((v,i)=>v-t*a[i][n]);if(evaluate(next).norm<r.norm||t<1/1024)break;t/=2;}while(true);x=next;
  }
  const r=evaluate(x);if(r.norm>1e-8)throw Error('Circuit did not converge');
  const lamps=edges.map(e=>{const u=anchored.has(e.a)&&anchored.has(e.b)?r.v(e.a)-r.v(e.b):0,i=e.live?lampI(u):0;return {u,i,p:u*i};});
  const current=regulated?edges.reduce((sum,e,i)=>sum+(e.a===plus?lamps[i].i:0)-(e.b===plus?lamps[i].i:0),0):plus===ground?6:6-r.v(plus),lit=lamps.filter(l=>l.p>1e-8).length;
  if(regulated&&current>2+1e-8)return fault();
  const reference=series(6,s.n,regulated?0:1);
  const inSeries=lit===s.n&&lamps.every(l=>Math.abs(Math.abs(l.i)-reference.i)<1e-7)&&Math.abs(current-reference.i)<1e-7;
  const inParallel=lit>0&&edges.every((e,i)=>!lamps[i].p||e.a===plus&&e.b===ground||e.a===ground&&e.b===plus);
  return {current,voltage:plus===ground?0:r.v(plus),short:plus===ground,lamps,lit,inSeries,inParallel,fault:false};
}
