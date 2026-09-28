// Keep the scientific state independent of where apparatus rests on the table.
const clone=v=>JSON.parse(JSON.stringify(v));
export function validBench(bench){return bench===undefined||!!bench&&typeof bench==='object'&&!Array.isArray(bench)&&Object.keys(bench).length<=100&&Object.entries(bench).every(([id,p])=>/^[\w:-]+$/.test(id)&&p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=12&&Math.abs(p.z)<=8);}
export function wrapNatural(base){
 if(!base.natural)return base;
 const wrapped={...base,
  valid:s=>base.valid(s)&&validBench(s._bench),
  act(s,id,value){
   if(id==='__move'){
    if(!value||typeof value.id!=='string'||!Number.isFinite(value.x)||!Number.isFinite(value.z))return clone(s);
    const next=clone(s);next._bench={...next._bench,[value.id]:{x:Math.max(-12,Math.min(12,value.x)),z:Math.max(-8,Math.min(8,value.z))}};return next;
   }
   const next=base.act.call(base,clone(s),id,value);
   if(id!=='reset'&&s._bench&&!next._bench)next._bench=clone(s._bench);
   return next;
  },
  build(kit){const v=base.build(kit);v.naturalPoses=[];v.naturalEntities=[];return v;},
  update(v,s,kit){
   for(const p of v.naturalPoses){p.object.position.copy(p.position);p.object.rotation.copy(p.rotation);}
   base.update.call(base,v,s,kit);
   const list=base.natural.entities(s,v,kit),ids=new Set();
   v.naturalEntities=list.filter(e=>e&&e.object?.isObject3D&&!ids.has(e.id)&&ids.add(e.id));
   v.naturalPoses=v.naturalEntities.map(e=>({object:e.object,position:e.object.position.clone(),rotation:e.object.rotation.clone()}));
   for(const e of v.naturalEntities){const p=s._bench?.[e.id];if(p&&e.movable!==false&&!e.adjust){e.object.position.x=p.x;e.object.position.z=p.z;}}
  }
 };return wrapped;
}
