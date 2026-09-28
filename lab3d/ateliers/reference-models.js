import {wiresFor,seriesWires,terminals,validWires,solveCircuit,switchClosed,lampRemoved,parallelBench} from './reference-circuit.js';
import {fmt} from './modules/electricite-common.js';
import {addContactShadow} from '../materials.js';
const ML=1e-6;
const copy=s=>JSON.parse(JSON.stringify(s));
const bound=(x,min,max)=>Math.max(min,Math.min(max,x));
export const positions={pile:[-3.65,-1.15],L0:[1.4,-1.0],L1:[3.75,1.0],L2:[.45,1.3],interrupteur:[-2.2,2.4]};
export function parallelPositions(s){const z=s.n===3?[-2.05,.15,2.35]:[-1.45,1.7,2.35],p={pile:[-4.3,-1.4],interrupteur:[-4.0,2.65],...Object.fromEntries(z.flatMap((z,i)=>[[`B${i}`,[-.85,z]],[`L${i}`,[s.n===3?1.2+i*1.1:1.75+i*1.25,z]]]))};if(s.swap&&s.n>1)[p.L0,p.L1]=[p.L1,p.L0];return p;}
const mesh=(T,p,g,m,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o;};
function approvedObject(kit,type){
  const s=Object.create(Object.getPrototypeOf(kit.scene));
  Object.assign(s,{scene:kit.root,objects:{},pins:{},materials:kit.scene.materials,textures:kit.scene.textures,surface:kit.scene.surface,renderer:kit.scene.renderer});
  s[type==='pile'?'makeBattery':type==='lampe'?'makeLamp':'makeSwitch']();
  const g=s.objects[type];return {s,g,pins:s.pins};
}
export function buildCircuit(kit,parallel=false,options={}){
  const {T,root}=kit,devices={pile:approvedObject(kit,'pile'),interrupteur:approvedObject(kit,'interrupteur')};
  for(let i=0;i<(options.lampCount??3);i++)devices[`L${i}`]=approvedObject(kit,'lampe');
  if(parallel){
    if(options.branchSwitches!==false)for(let i=0;i<(options.branchCount??3);i++){devices[`B${i}`]=approvedObject(kit,'interrupteur');devices[`B${i}`].g.scale.setScalar(.91);}
    kit.scene.print(devices.pile.g,'RÉGULÉE',1.1,.19,0,.36,.53,{background:'#dce9e9',color:'#233e4a'});
  }
  if(parallel||options.removableBulbs){
    for(let i=0;i<(options.lampCount??3);i++){const d=devices[`L${i}`],bulb=new T.Group();
      for(const o of [...d.g.children]){if(o.geometry)o.geometry.computeBoundingBox();if(o===d.s.lampLight||o.geometry&&o.geometry.boundingBox.min.y+o.position.y>.43){bulb.add(o);o.traverse(child=>child.userData.referenceLamp=i);}}
      d.g.add(bulb);d.bulb=bulb;
      mesh(T,d.g,new T.CylinderGeometry(.225,.225,.018,32),new T.MeshStandardMaterial({color:'#384049',roughness:.6}),0,.46,0);
    }
  }
  options.addDevices?.(devices,kit);
  for(const [id,d]of Object.entries(devices))d.g.traverse(o=>{if(o.isMesh)o.userData.referenceDevice=id;});
  const wires=new T.Group();root.add(wires);
  const colors=['#a0322d','#26363d','#977230','#2e648e'];
  const wireMaterials=colors.map(color=>new T.MeshStandardMaterial({color,roughness:.34}));
  const rings=Object.fromEntries(Object.entries(devices).map(([id,d])=>{
    const ring=mesh(T,root,new T.RingGeometry(1.05,1.09,64),new T.MeshBasicMaterial({color:'#3983c3',transparent:true,opacity:.72,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;return [id,ring];
  }));
  return {kit,parallel,options,devices,wires,wireMaterials,rings,pins:{},curves:[],wireKey:''};
}
export function updateCircuit(v,s){
  const {T}=v.kit,r=solveCircuit(s);v.result=r;
  for(const [id,d]of Object.entries(v.devices)){
    const i=/^[LB]/.test(id)?Number(id.slice(1)):-1;
    d.g.visible=v.options?.visible?.(id,s)??(i<0||i<s.n);const defaults=v.options?.positions?.(s)??(v.parallel?parallelPositions(s):positions),at=s.layout?.[id]??defaults[id];d.g.position.set(at[0],0,at[1]);
    if(id.startsWith('L')){const removed=lampRemoved(s,i);if(d.bulb){d.bulb.position.y=removed?.42:0;d.bulb.rotation.y=removed?Math.PI*.8:0;}else d.g.position.y=removed?.48:0;const power=r.lamps[i]?.p??0,lit=power>1e-8,brightness=bound(power/1.8,0,1.25);d.s.filamentMat.emissiveIntensity=lit?4.5*brightness:0;d.s.glow.visible=lit;d.s.glassMat.color.set(lit?'#fff6df':'#fcfdff');d.s.lampLight.intensity=lit?3*brightness:0;}
    if(d.s.lever)d.s.lever.rotation.z=switchClosed(s,id)?0:.62;
    v.rings[id].position.set(at[0],.07,at[1]);
  }
  v.kit.root.updateMatrixWorld(true);v.pins={};
  for(const t of terminals(s)){
    const [id,port]=t.split(':'),d=v.devices[id];
    const original=id.startsWith('L')?`lampe:${port==='a'?(v.parallel?'culot2':'culot'):'plot'}`:id.startsWith('B')?`interrupteur:${port}`:t;
    const p=d.pins[original];v.pins[t]=p.group.localToWorld(p.local.clone());
  }
  const key=JSON.stringify([wiresFor(s),s.layout,s.n,s.removed]);
  if(key!==v.wireKey){v.wireKey=key;v.wires.traverse(o=>o.geometry?.dispose());v.wires.clear();v.curves=[];
    wiresFor(s).forEach((w,i)=>{
      const a=v.pins[w.a],b=v.pins[w.b],aa=a.clone(),bb=b.clone();
      aa.z+=.38;bb.z+=.38;const ga=aa.clone(),gb=bb.clone();ga.y=gb.y=.08+(i%3)*.018;ga.z+=.35;gb.z+=.35;
      const mid=ga.clone().lerp(gb,.5);mid.z+=.2;
      let points=[a,aa,ga,mid,gb,bb,b],color=i%4;
      if(v.parallel){
        const end=w.b==='pile:m'?w.a:w.a==='pile:m'?w.b:null;
        if(end?.match(/^L\d:b$/)){const p=v.pins[end],q=v.pins['pile:m'],lane=Math.max(p.x+.9,4.3+Number(end[1])*.13);points=[p,p.clone().add(new T.Vector3(0,0,.3)),new T.Vector3(lane,.11,p.z+.4),new T.Vector3(lane,.11,-2.75),new T.Vector3(q.x+.5,.11,-2.75),q.clone().add(new T.Vector3(.3,.05,0)),q];color=1;}
        else if([w.a,w.b].includes('pile:p')&&[w.a,w.b].includes('interrupteur:a')){const p=v.pins['pile:p'],q=v.pins['interrupteur:a'];points=[p,p.clone().add(new T.Vector3(-.3,0,0)),new T.Vector3(-5.5,.1,p.z),new T.Vector3(-5.5,.1,q.z),q.clone().add(new T.Vector3(-.3,0,0)),q];color=0;}
        else if([w.a,w.b].includes('interrupteur:b')&&[w.a,w.b].some(t=>/^B\d:a$/.test(t))){const p=v.pins['interrupteur:b'],q=v.pins[[w.a,w.b].find(t=>/^B\d:a$/.test(t))],lane=-2.35;points=[p,p.clone().add(new T.Vector3(.25,0,0)),new T.Vector3(lane,.1,p.z+.25),new T.Vector3(lane,.1,q.z),q.clone().add(new T.Vector3(-.25,0,0)),q];color=0;}
        else if([w.a,w.b].some(t=>/^B\d:b$/.test(t))&&[w.a,w.b].some(t=>/^L\d:a$/.test(t))){const p=v.pins[[w.a,w.b].find(t=>/^B\d:b$/.test(t))],q=v.pins[[w.a,w.b].find(t=>/^L\d:a$/.test(t))];points=[p,p.clone().add(new T.Vector3(.25,0,0)),new T.Vector3((p.x+q.x)/2,.1,(p.z+q.z)/2+.3),q.clone().add(new T.Vector3(-.25,0,0)),q];color=2;}
        else if(v.options?.branchSwitches===false&&[w.a,w.b].includes('interrupteur:b')&&[w.a,w.b].some(t=>/^L\d:a$/.test(t))){const p=v.pins['interrupteur:b'],q=v.pins[[w.a,w.b].find(t=>/^L\d:a$/.test(t))],lane=Math.min(p.x+.5,q.x-.6);points=[p,p.clone().add(new T.Vector3(.2,0,0)),new T.Vector3(lane,.1,p.z+.3),new T.Vector3(lane,.1,q.z+.3),q.clone().add(new T.Vector3(-.2,0,0)),q];color=0;}
      }
      const custom=v.options?.wireRoute?.(w,v,s);if(custom){points=custom.points;color=custom.color;}
      const raw=new T.CatmullRomCurve3(points);const curve=new T.Curve();curve.getPoint=(t,p=new T.Vector3())=>{raw.getPoint(t,p);p.y=Math.max(.075,p.y);return p;};
      const o=mesh(T,v.wires,new T.TubeGeometry(curve,64,.034,10,false),v.wireMaterials[color]);o.castShadow=true;o.userData.referenceWire=i;v.curves.push(curve);
    });
  }
  v.kit.invalidate();
}
export function validLayout(s,allowed=positions){return s.layout===undefined||s.layout&&typeof s.layout==='object'&&!Array.isArray(s.layout)&&Object.entries(s.layout).every(([id,p])=>Object.hasOwn(allowed,id)&&Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&p[0]>=-5.5&&p[0]<=5.5&&Number.isFinite(p[1])&&p[1]>=-2.5&&p[1]<=3.3);}
export function refineCircuit(base){return {...base,reference:'circuit',build:buildCircuit,update:updateCircuit,
  initial:()=>({...base.initial(),n:2}),
  valid:s=>base.valid(s)&&!parallelBench(s)&&validWires(s)&&validLayout(s),
  controls:s=>[{type:'button',id:'add',label:'Ajouter une lampe en série',disabled:s.n>=3},{type:'button',id:'subtract',label:'Retirer la dernière lampe',disabled:s.n<=1},{type:'button',id:'closed',label:s.closed?'Ouvrir l’interrupteur':'Fermer l’interrupteur'},{type:'button',id:'permute',label:'Permuter les lampes en gardant leurs fils'},{type:'button',id:'arrange',label:'Ranger les objets sur la table'},{type:'button',id:'series',label:'Préparer le montage en série'},{type:'button',id:'unwire',label:'Retirer les fils pour construire mon montage'}],
  act(state,id,value){let s=copy(state);
    if(id==='move'&&value&&Object.hasOwn(positions,value.id)&&Number.isFinite(value.x)&&Number.isFinite(value.z)){s.layout={...s.layout,[value.id]:[bound(value.x,-5.5,5.5),bound(value.z,-2.5,3.3)]};return s;}
    if(id==='add'||id==='subtract'){s.n=bound(s.n+(id==='add'?1:-1),1,3);s.removed='none';s.connections=seriesWires(s);return s;}
    if(id==='closed')return {...s,closed:typeof value==='boolean'?value:!s.closed};
    if(id==='removeLamp'){const i=String(value);if(Number.isInteger(Number(i))&&Number(i)>=0&&Number(i)<s.n)s.removed=s.removed===i?'none':i;return s;}
    if(id==='permute'){const a=s.layout?.L0??positions.L0,b=s.layout?.L1??positions.L1;s.layout={...s.layout,L0:[...b],L1:[...a]};return s;}
    if(id==='arrange'){delete s.layout;return s;}
    if(id==='unwire'){s.connections=[];return s;}
    if(id==='series'){s.connections=seriesWires(s);s.removed='none';s.closed=true;return s;}
    if(id==='unplug'){const ws=copy(wiresFor(s));if(Number.isInteger(value)&&value>=0&&value<ws.length)ws.splice(value,1);s.connections=ws;return s;}
    if(id==='connect'&&value){const ws=copy(wiresFor(s)),ts=terminals(s);if(ts.includes(value.a)&&ts.includes(value.b)&&value.a!==value.b&&ws.length<24&&!ws.some(w=>[w.a,w.b].includes(value.a)&&[w.a,w.b].includes(value.b)))ws.push({a:value.a,b:value.b});s.connections=ws;return s;}
    if(id==='n'){s=base.act(s,id,value);s.connections=seriesWires(s);return s;}
    return base.act(s,id,value);
  },
  observe(s){const r=solveCircuit(s),title=r.short?'Court-circuit de la pile':r.lit?`${r.lit===1?'La lampe est allumée':`Les ${r.lit} lampes sont allumées`}`:'Les lampes sont éteintes';
    return {title,metrics:[{label:'Tension de la pile',value:`${fmt(r.voltage,2)} V`},{label:'Courant de la pile',value:`${fmt(r.current)} A`},...r.lamps.map((l,i)=>({label:`Puissance L${i+1}`,value:`${fmt(l.p)} W`}))],lines:[r.inSeries?'Les lampes sont traversées par le même courant. Ajoute une lampe, puis compare leur éclat.':r.short?'Un fil contourne les lampes et relie directement les bornes de la pile. Débranche cette liaison.':r.lit?'Ce branchement fonctionne. Pour étudier la série, suis un seul trajet passant par toutes les lampes.':'Vérifie les fils, les contacts et l’interrupteur. Dévisser une lampe en série ouvre toute la boucle.','Les fils suivent les contacts même quand tu déplaces les objets. Deux fils croisés ne sont pas reliés.','Même profil que le premier circuit : pile 6 V, résistance interne 1 Ω ; lampes L6 identiques. Régime continu, fils idéaux, sans calcul de température ni délai de destruction.'],board:[`${s.n} lampe(s) · ${r.inSeries?'en série':'montage libre'}`,`Pile : ${fmt(r.voltage,2)} V · ${fmt(r.current)} A`,...r.lamps.slice(0,2).map((l,i)=>`L${i+1} : ${fmt(Math.abs(l.u),2)} V · ${fmt(l.p,2)} W`)],warning:r.short?'Court-circuit : retire le fil qui contourne les lampes.':''};
  }
};}

// New water apparatus: a large physical cylinder and a front reading view.
export const waterScales={fine:{capacity:100,step:1},moyenne:{capacity:100,step:2},grande:{capacity:250,step:5}};
export const waterPositions={cylinder:[.3,.1],bottle:[-3,-.1],dropper:[-1.45,1.9],tray:[3.1,1.2]};
export const bottleVolume=s=>s.reserve??500*ML;
export const dropperVolume=s=>s.pipette??.5*ML;
export function buildWater(kit){
  const {T,root,scene}=kit,glass=new T.MeshPhysicalMaterial({color:'#edf7fa',roughness:.06,transmission:.85,thickness:.055,ior:1.46,transparent:true,opacity:1,side:T.FrontSide,depthWrite:false});
  const water=new T.MeshPhysicalMaterial({color:'#a2ced8',roughness:.12,transparent:true,opacity:.5,side:T.DoubleSide,depthWrite:false,metalness:0});
  const ink=new T.MeshBasicMaterial({color:'#172f3a',toneMapped:false,transparent:true}),blue=new T.MeshStandardMaterial({color:'#315568',roughness:.32}),v={kit,groups:{},marks:[],ticks:[]};
  const g=new T.Group();g.position.set(.3,.09,.1);root.add(g);v.groups.cylinder=g;
  const contour=[[0,0],[.46,0],[.47,.12],[.47,3.4],[.5,3.46],[.465,3.48],[.43,3.42],[.43,.14],[0,.14]];
  mesh(T,g,new T.LatheGeometry(contour.map(p=>new T.Vector2(...p)),64),glass);
  mesh(T,g,new T.CylinderGeometry(.75,.8,.13,6),blue,0,.01,0);
  v.liquid=mesh(T,g,new T.CylinderGeometry(.425,.425,1,64),water,0,.5,0);v.liquid.renderOrder=2;
  v.meniscus=mesh(T,g,new T.TorusGeometry(.421,.018,8,64),new T.MeshBasicMaterial({color:'#477e91',transparent:true,opacity:.6}),0,1,0);v.meniscus.rotation.x=Math.PI/2;
  // Draw the scale after the glass, so transmission does not duplicate its ink.
  for(let i=0;i<=100;i++){const y=.15+i*.0305,tick=mesh(T,g,new T.BoxGeometry(i%5===0?.28:.115,.012,.012),ink,.025,y,.52);tick.renderOrder=3;v.ticks.push(tick);if(i%5===0){const m=scene.print(g,String(i),.34,.12,.38,y,.525,{background:'#fffdf6',color:'#172f3a'});m.material.dispose();m.material=new T.MeshBasicMaterial({map:scene.textures.at(-1),toneMapped:false,transparent:true});m.renderOrder=4;v.marks.push(m);}}
  const bottle=new T.Group();bottle.position.set(-3,.08,-.1);root.add(bottle);v.groups.bottle=bottle;
  const profile=[[0,0],[.67,0],[.71,.12],[.71,1.9],[.65,2.2],[.25,2.65],[.25,3],[.22,3],[.22,2.66],[.62,2.19],[.67,1.88],[.67,.15],[0,.15]];
  mesh(T,bottle,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),64),glass);
  v.bottleWater=mesh(T,bottle,new T.CylinderGeometry(.66,.66,1,48),water,0,.95,0);
  const band=scene.print(bottle,'EAU',.95,.38,0,1.15,.73,{background:'#f8f6eb',color:'#243d4c'});band.material.toneMapped=false;
  const dropper=new T.Group();dropper.position.set(-1.45,.28,1.9);dropper.rotation.z=-.7;root.add(dropper);v.groups.dropper=dropper;
  mesh(T,dropper,new T.CylinderGeometry(.06,.025,.88,24),glass,0,.44,0);v.bulb=mesh(T,dropper,new T.SphereGeometry(.14,24,16),blue,0,.94,0);v.bulb.scale.y=1.6;
  v.dropperWater=mesh(T,dropper,new T.CylinderGeometry(.035,.017,.65,16),water,0,.4,0);
  const tray=new T.Group();tray.position.set(3.1,.1,1.2);root.add(tray);v.groups.tray=tray;
  const ceramic=new T.MeshStandardMaterial({color:'#eeeade',roughness:.25});scene.rounded(tray,2,.14,1.35,.18,ceramic,0,.06,0);
  for(const z of [-.67,.67])mesh(T,tray,new T.BoxGeometry(2,.25,.055),ceramic,0,.18,z);for(const x of [-.97,.97])mesh(T,tray,new T.BoxGeometry(.055,.25,1.35),ceramic,x,.18,0);
  v.pool=mesh(T,tray,new T.BoxGeometry(1.87,.015,1.22),water,0,.15,0);
  v.shadows={};
  for(const [id,group]of Object.entries(v.groups)){group.traverse(o=>{if(o.isMesh)o.userData.referenceDevice=id;});const before=new Set(group.children);addContactShadow(group,scene.surface.shadow,id==='cylinder'?1.5:2,1.5,.03,.45);v.shadows[id]=group.children.filter(o=>!before.has(o));}
  v.stream=mesh(T,root,new T.CylinderGeometry(.035,.024,1,12),new T.MeshBasicMaterial({color:'#548fa5',transparent:true,opacity:.7,depthWrite:false}));v.stream.visible=false;
  v.drops=new T.Group();root.add(v.drops);v.drops.visible=false;
  const dropMaterial=new T.MeshBasicMaterial({color:'#397c9c',transparent:true,opacity:.85,depthWrite:false});
  for(let i=0;i<3;i++){const drop=mesh(T,v.drops,new T.SphereGeometry(.048,12,8),dropMaterial);drop.scale.y=1.4;}
  return v;
}
export function updateWater(v,s){
  const d=waterScales[s.scale],height=3.05*bound(s.water/ML/d.capacity,0,1);
  for(const [id,g]of Object.entries(v.groups)){const at=s.waterLayout?.[id]??waterPositions[id];g.position.set(at[0],id==='cylinder'?.09:id==='dropper'?.28:id==='tray'?.1:.08,at[1]);g.rotation.set(0,0,id==='dropper'?-.7:0);v.shadows[id].forEach(o=>o.visible=true);}
  v.stream.visible=false;v.drops.visible=false;v.bulb.scale.set(1,1.6,1);
  const fill=1.65*bound(bottleVolume(s)/(500*ML),0,1);v.bottleWater.visible=fill>0;v.bottleWater.scale.y=Math.max(.0001,fill);v.bottleWater.position.y=.125+fill/2;v.dropperWater.visible=dropperVolume(s)>1e-12;
  const pipetteFill=bound(dropperVolume(s)/(.5*ML),0,1);v.dropperWater.scale.y=Math.max(.0001,pipetteFill);v.dropperWater.position.y=.075+.325*pipetteFill;
  v.groups.cylinder.scale.set(Math.sqrt(d.capacity/100),1,Math.sqrt(d.capacity/100));
  v.liquid.visible=s.water>0;v.liquid.scale.y=Math.max(.0001,height);v.liquid.position.y=.15+height/2;v.meniscus.visible=s.water>0;v.meniscus.position.y=.15+height;
  v.level=.09+.15+height;v.pool.visible=s.drained+s.spill>0;
  if(v.scale!==s.scale){v.scale=s.scale;const count=d.capacity/d.step;v.ticks.forEach((m,i)=>{m.visible=i<=count;m.position.y=.15+i/count*3.05;});v.marks.forEach((m,i)=>{m.visible=i*5<=count;m.position.y=.15+i*5/count*3.05;const c=m.material.map.image,ctx=c.getContext('2d');ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#172f3a';ctx.font=`600 ${c.height*.47}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i*5*d.step),c.width/2,c.height/2,c.width-30);m.material.map.needsUpdate=true;});}
  v.kit.invalidate();
}
// Transient pose only: measured volumes remain in the workshop state.
export function poseWater(v,id,amount,flowing,time=0,target='cylinder'){
  const {T}=v.kit,g=v.groups[id],receiver=v.groups[target];
  const mouth=receiver.localToWorld(new T.Vector3(0,target==='cylinder'?3.48:3.0,0));
  if(id==='bottle'){
    g.rotation.z=-1.88*amount;
    const neck=new T.Vector3(0,3,0).applyEuler(g.rotation);
    const desired=mouth.clone().add(new T.Vector3(-.07,.3,0)).sub(neck);
    g.position.lerp(desired,amount);
  }else{
    g.rotation.z=-.7*(1-amount);
    g.position.lerp(mouth.clone().add(new T.Vector3(0,target==='bottle'?-.5:.35,0)),amount);
    if(flowing) v.bulb.scale.set(.87,1.4,.87);
  }
  v.shadows[id].forEach(o=>o.visible=amount<.05);
  v.kit.root.updateMatrixWorld(true);
  if(flowing&&target==='cylinder'){
    const a=g.localToWorld(new T.Vector3(0,id==='bottle'?3:0,0));
    const b=v.groups.cylinder.localToWorld(new T.Vector3(0,v.liquid.position.y+v.liquid.scale.y/2,0));
    if(id==='dropper'){v.drops.visible=true;v.drops.children.forEach((drop,i)=>drop.position.copy(a).lerp(b,(time/520+i/3)%1));}
    else {const delta=b.clone().sub(a);v.stream.position.copy(a).lerp(b,.5);v.stream.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());v.stream.scale.set(1,delta.length(),1);v.stream.visible=true;}
  }
  v.kit.invalidate();
}
export function refineWater(base){return {...base,reference:'water',build:buildWater,update:updateWater,
  valid:s=>base.valid(s)&&(s.reserve===undefined||Number.isFinite(s.reserve)&&s.reserve>=0&&s.reserve<=500*ML)&&(s.pipette===undefined||Number.isFinite(s.pipette)&&s.pipette>=0&&s.pipette<=.5*ML)&&(s.waterLayout===undefined||s.waterLayout&&typeof s.waterLayout==='object'&&!Array.isArray(s.waterLayout)&&Object.entries(s.waterLayout).every(([id,p])=>Object.hasOwn(waterPositions,id)&&Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-5&&p[0]<=5&&p[1]>=-2.3&&p[1]<=3)),
  controls:s=>[...base.controls(s).filter(c=>['scale','target','pour','drop','remove','answer','check','align','reset'].includes(c.id)).map(c=>({...c,label:({pour:'Verser 5 mL depuis la bouteille',drop:'Vider le compte-gouttes dans l’éprouvette',remove:'Retirer 0,5 mL dans le bac',align:'Placer le regard au niveau de l’eau'})[c.id]??c.label})),{type:'button',id:'fillDropper',label:'Remplir le compte-gouttes depuis la bouteille'},{type:'button',id:'refill',label:'Remplir la bouteille (500 mL)'},{type:'button',id:'arrange',label:'Ranger le matériel sur la table'}],
  act(state,id,value){let s=copy(state);
    if(id==='move'&&value&&Object.hasOwn(waterPositions,value.id)&&Number.isFinite(value.x)&&Number.isFinite(value.z)){s.waterLayout={...s.waterLayout,[value.id]:[bound(value.x,-5,5),bound(value.z,-2.3,3)]};return s;}
    if(id==='arrange'){delete s.waterLayout;return s;}
    if(id==='refill'){s.reserve=500*ML;return s;}
    if(id==='fillDropper'){const take=Math.min(.5*ML-dropperVolume(s),bottleVolume(s));s.reserve=bottleVolume(s)-take;s.pipette=dropperVolume(s)+take;return s;}
    if(id==='pour'||id==='drop'||id==='flow'){
      const source=id==='drop'||value?.source==='dropper'?'dropper':'bottle',available=source==='bottle'?bottleVolume(s):dropperVolume(s),ml=id==='pour'?5:id==='drop'?.5:value?.ml;
      if(!Number.isFinite(ml)||ml<=0)return s;
      const volume=Math.min(ml*ML,available),total=s.water+volume,capacity=waterScales[s.scale].capacity*ML;
      s.added+=volume;s.water=Math.min(capacity,total);s.spill+=Math.max(0,total-capacity);s.checked=false;
      if(source==='bottle')s.reserve=available-volume;else s.pipette=available-volume;
      return s;
    }
    return base.act(s,id,value);
  },
};}
