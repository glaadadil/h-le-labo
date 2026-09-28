import {displace} from './modules/mesures.js';
import {addContactShadow} from '../materials.js';
const ML=1e-6,EPS=1e-12,copy=s=>JSON.parse(JSON.stringify(s));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const vessel={radius:.8,height:4,base:.18,capacity:100*ML,step:2};
const units=vessel.capacity/(Math.PI*vessel.radius**2*vessel.height);
export const keyOutline=[[-.2,0],[.46,0],[.46,.2],[.2,.2],[.2,.4],[.4,.4],[.4,.6],[.2,.6],[.2,1], [.47,1.1],[.57,1.4],[.4,1.75],[0,1.92],[-.4,1.75],[-.57,1.4],[-.47,1.1],[-.2,1]];
export const keyHole=Array.from({length:24},(_,i)=>[.17*Math.cos(i*Math.PI/12),1.45+.17*Math.sin(i*Math.PI/12)]);
export function polygonArea(points){return Math.abs(points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;}
function below(points,y){const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=a[1]<=y,next=b[1]<=y;if(inside)result.push(a);if(inside!==next)result.push([a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),y]);}return result;}
const keyArea=polygonArea(keyOutline)-polygonArea(keyHole);
export const solids={
 bloc:{name:'Bloc métallique',volume:24*ML,height:24*ML/units,at:[-3.7,.8]},
 caillou:{name:'Caillou non poreux',volume:18*ML,height:2*18*ML/units/(4/3*Math.PI*.62*.58),at:[-2.1,.95]},
 cle:{name:'Clé métallique',volume:12*ML,height:1.92,thickness:12*ML/units/keyArea,at:[-.45,.85]}
};
export const mounted=s=>s.inVessel??s.fraction>0;
export const levels=s=>displace(s.water,solids[s.object].volume,vessel.capacity,s.fraction,s.spill);
export const measurable=s=>mounted(s)&&s.fraction===1&&s.spill<EPS;
export function fractionAtDepth(id,depth){const d=solids[id],t=clamp(depth/d.height,0,1);return id==='bloc'?t:id==='caillou'?t*t*(3-2*t):clamp((polygonArea(below(keyOutline,depth))-polygonArea(below(keyHole,depth)))/keyArea,0,1);}
export function depthForFraction(id,f){if(f<=0)return 0;if(f>=1)return solids[id].height;let a=0,b=solids[id].height;for(let i=0;i<40;i++){const m=(a+b)/2;if(fractionAtDepth(id,m)<f)a=m;else b=m;}return (a+b)/2;}
const fmt=n=>n.toLocaleString('fr-FR',{maximumFractionDigits:2});
export function answerFeedback(s){if(s.spill>EPS)return 'De l’eau a débordé : cette différence ne donne plus le volume du solide. Prépare un nouvel essai.';if(!measurable(s))return 'Immerge entièrement le solide avant de calculer son volume.';if(s.answer===undefined||s.answer===null)return 'Entre la différence entre les deux niveaux, en cm³.';const volume=solids[s.object].volume/ML;return Math.abs(s.answer-volume)<=2+1e-8?`Ta réponse est compatible avec les graduations. V₂ − V₁ = ${fmt(levels(s).level/ML)} − ${fmt(s.initialWater/ML)} = ${fmt(volume)} cm³.`:'Reprends la différence V₂ − V₁. Le niveau final représente l’eau et le solide ensemble.';}
export function refineDisplacement(base){return {...base,reference:'immersion',build,update,
 boardTitle:'LE SOLIDE DÉPLACE L’EAU',boardRule:'V solide = V₂ − V₁ · immersion complète, sans débordement.',
 materialIntro:'Saisis un solide et dépose-le sur le repère de l’éprouvette. Tire le solide ou son fil vers le haut pour le soulever ; vers le bas pour l’immerger. Les commandes ci-dessous restent disponibles au clavier.',
 valid:s=>base.valid(s)&&(s.inVessel===undefined||typeof s.inVessel==='boolean'&&(s.inVessel||s.fraction===0))&&(s.answer===undefined||s.answer===null||Number.isFinite(s.answer)&&s.answer>=0&&s.answer<=100)&&(s.checked===undefined||typeof s.checked==='boolean')&&(s.bench===undefined||s.bench&&typeof s.bench==='object'&&!Array.isArray(s.bench)&&Object.entries(s.bench).every(([id,p])=>['cylinder',...Object.keys(solids)].includes(id)&&Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-5&&p[0]<=4.5&&p[1]>=-2&&p[1]<=2.8)),
 controls:s=>[{type:'select',id:'object',label:'Solide à saisir',value:s.object,options:Object.entries(solids).map(([value,o])=>({value,label:o.name}))},{type:'button',id:'immerse',label:'Immerger le solide choisi'},{type:'range',id:'fraction',label:'Part du volume immergée',min:0,max:100,step:5,value:Math.round(s.fraction*100),unit:'%'},{type:'button',id:'lift',label:'Soulever hors de l’eau'},{type:'button',id:'return',label:'Reposer le solide sur le plateau'},{type:'range',id:'initialWater',label:'Nouvel essai : eau de départ',min:40,max:95,step:1,value:s.initialWater/ML,unit:'mL'},{type:'button',id:'fresh',label:'Préparer un nouvel essai avec le même volume d’eau'},{type:'button',id:'arrange',label:'Ranger le matériel'}],
 act(state,id,value){let s=copy(state);
  if(id==='reset')return this.initial();
  if(id==='move'&&value&&['cylinder',...Object.keys(solids)].includes(value.id)&&Number.isFinite(value.x)&&Number.isFinite(value.z)){s.bench={...s.bench,[value.id]:[clamp(value.x,-5,4.5),clamp(value.z,-2,2.8)]};return s;}
  if(id==='arrange'){delete s.bench;return s;}
  if(id==='answer'){const n=typeof value==='string'?Number(value.replace(',','.')):value;s.answer=value===''?null:Number.isFinite(n)?clamp(n,0,100):s.answer;s.checked=false;return s;}
  if(id==='check'){s.checked=true;return s;}
  if(id==='fresh'||id==='initialWater'){const initial=id==='fresh'?s.initialWater/ML:Number(value);if(!Number.isFinite(initial))return s;return {...s,initialWater:clamp(initial,40,95)*ML,water:clamp(initial,40,95)*ML,fraction:0,spill:0,inVessel:false,answer:null,checked:false};}
  if(id==='object'){if(!Object.hasOwn(solids,value))return s;s.object=value;s.fraction=0;s.inVessel=false;s.answer=null;s.checked=false;return s;}
  if(id==='place'){if(!Object.hasOwn(solids,value))return s;if(s.object!==value)s=this.act(s,'object',value);return this.act(s,'immerse');}
  if(id==='return'){s.fraction=0;s.inVessel=false;s.checked=false;return s;}
  if(['fraction','immerse','lift'].includes(id)){const f=id==='immerse'?1:id==='lift'?0:Number(value)/100;if(!Number.isFinite(f))return s;s.fraction=clamp(f,0,1);s.inVessel=true;s.checked=false;const r=levels(s);s.water=r.water;s.spill=r.spill;return s;}
  return s;
 },
 observe(s){const r=levels(s),state=s.spill>EPS?'De l’eau a débordé':s.fraction===1?'Solide entièrement immergé':s.fraction>0?'Immersion partielle':mounted(s)?'Solide hors de l’eau':'Lis l’eau seule, puis introduis un solide';return {title:state,metrics:[{label:'Niveau initial V₁',value:`${fmt(s.initialWater/ML)} mL`},{label:'Niveau actuel',value:`${fmt(r.level/ML)} mL`},{label:'Eau recueillie',value:`${fmt(s.spill/ML)} mL`}],boardMetrics:[{label:'Avant V₁',value:`${fmt(s.initialWater/ML)} mL`},{label:'Niveau actuel',value:`${fmt(r.level/ML)} mL`},{label:'Solide',value:s.fraction===1?'Immergé':s.fraction>0?'Partiel':'Hors d’eau'}],lines:[
 'Le solide prend de la place sous la surface. L’eau ne devient pas plus abondante : son niveau monte selon le volume immergé.',
 'Lis les deux niveaux au bas du ménisque. V₂ − V₁ donne le volume total seulement quand le solide est entièrement immergé et qu’aucune eau n’a débordé. 1 mL = 1 cm³.',
 'Une division vaut 2 mL ; chaque lecture admet une demi-division. La différence de deux lectures est comparée avec une tolérance de ± 2 cm³.',
 'Source principale : manuel p. 27, 29, 31–32 ; guide complémentaire p. 51. Valeurs construites pour cette expérience, sans relever de chiffres incertains sur les petites figures du manuel.',
 'Objets pleins, insolubles, non absorbants, sans bulles. Caillou représenté par un ellipsoïde ; clé extrudée simplifiée. Géométrie et volume immergé cohérents. Suspension imposée par le fil, de volume négligeable ; pas de chute libre ni de calcul de tension du fil.',
 'Sortir le solide ne remet pas l’eau débordée dans l’éprouvette. Un nouvel essai rétablit explicitement l’eau de départ. Le bac et le ménisque sont représentés de façon illustrative.'
 ],warning:s.spill>EPS?'Refais un essai sans perte d’eau avant de calculer le volume.':''};}
};}
const mesh=(T,g,geometry,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);g.add(m);return m;};
function build(kit){const {T,root,scene}=kit,v={kit,solids:{},groups:{},ticks:[]};
 const glass=new T.MeshPhysicalMaterial({color:'#e7f1f4',roughness:.08,transmission:.72,thickness:.03,transparent:true,opacity:.75,depthWrite:false});
 const water=new T.MeshPhysicalMaterial({color:'#8bbfce',roughness:.2,transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide});
 const ink=new T.MeshBasicMaterial({color:'#243f4a',toneMapped:false}),silver=new T.MeshStandardMaterial({color:'#929fa6',metalness:.72,roughness:.3}),blue=new T.MeshStandardMaterial({color:'#31586b',roughness:.3});
 const cylinder=new T.Group();root.add(cylinder);v.groups.cylinder=cylinder;
 const basin=new T.Group();cylinder.add(basin);const ceramic=new T.MeshStandardMaterial({color:'#e9e5da',roughness:.36});scene.rounded(basin,2.55,.12,2.55,.2,ceramic,0,.06,0);for(const z of [-1.25,1.25])scene.box(basin,2.5,.18,.06,ceramic,0,.16,z);for(const x of [-1.25,1.25])scene.box(basin,.06,.18,2.5,ceramic,x,.16,0);
 v.pool=mesh(T,basin,new T.PlaneGeometry(2.4,2.4),water,0,.13,0);v.pool.rotation.x=-Math.PI/2;
 const tube=new T.Group();tube.position.y=.21;cylinder.add(tube);v.tube=tube;
 mesh(T,tube,new T.CylinderGeometry(.97,1.03,.11,6),blue,0,.055,0);
 const contour=[[0,.12],[.86,.12],[.86,4.18],[.89,4.22],[.8,4.18],[.8,.18],[0,.18]];
 mesh(T,tube,new T.LatheGeometry(contour.map(p=>new T.Vector2(...p)),64),glass);
 v.water=mesh(T,tube,new T.CylinderGeometry(.795,.795,1,64),water);v.water.renderOrder=2;
 v.meniscus=mesh(T,tube,new T.TorusGeometry(.795,.016,8,64),new T.MeshBasicMaterial({color:'#47758b',transparent:true,opacity:.8}));v.meniscus.rotation.x=Math.PI/2;v.meniscus.renderOrder=3;
 for(let ml=0;ml<=100;ml+=2){const y=vessel.base+ml/100*vessel.height,t=mesh(T,tube,new T.BoxGeometry(ml%10===0?.24:.12,.012,.014),ink,.13,y,.89);t.renderOrder=4;if(ml%10===0){const p=scene.print(tube,String(ml),.32,.17,.48,y,.9,{background:'#fffdf5',color:'#213d48'});p.material.dispose();p.material=new T.MeshBasicMaterial({map:scene.textures.at(-1),toneMapped:false,transparent:true});p.renderOrder=5;}}
 v.baseline=mesh(T,tube,new T.TorusGeometry(.87,.018,8,64,Math.PI*1.2),new T.MeshBasicMaterial({color:'#ae8048'}));v.baseline.rotation.x=Math.PI/2;
 // A laboratory support keeps the specimen off the bottom.
 scene.rounded(cylinder,.5,.17,1.35,.06,blue,-1.05,.2,-.75);v.rod=scene.cyl(cylinder,.04,.04,4.75,silver,-1.05,2.57,-.75);v.arm=scene.box(cylinder,1.22,.07,.07,silver,-.48,4.88,-.75);v.armEnd=scene.box(cylinder,.07,.07,.82,silver,.1,4.88,-.34);
 const wireMat=new T.LineBasicMaterial({color:'#485052'});v.thread=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),wireMat);cylinder.add(v.thread);
 v.grip=mesh(T,cylinder,new T.TorusGeometry(.11,.025,8,32),silver,.1,4.7,.06);v.grip.userData.immersionHandle=true;
 const tray=new T.Group();root.add(tray);v.groups.tray=tray;tray.position.set(-2.25,.05,.85);scene.rounded(tray,4.7,.12,2.55,.15,scene.mat('wood','#c5a476'),0,0,0);
 const make=(id,geo,mat)=>{const g=new T.Group();root.add(g);const body=mesh(T,g,geo,mat);g.traverse(o=>{if(o.isMesh)o.userData.immersionSolid=id;});v.solids[id]={g,body};return body;};
 make('bloc',new T.BoxGeometry(1,solids.bloc.height,1),silver).position.y=solids.bloc.height/2;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=731;for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=120+(seed>>>24)%42;pixels.data.set([value,value-5,value-14,255],i);}ctx.putImageData(pixels,0,0);const stoneTexture=new T.CanvasTexture(canvas);stoneTexture.colorSpace=T.SRGBColorSpace;scene.textures.push(stoneTexture);
 const stone=make('caillou',new T.SphereGeometry(1,40,24),new T.MeshStandardMaterial({color:'#b7b2a7',map:stoneTexture,roughness:.92}));stone.scale.set(.62,solids.caillou.height/2,.58);stone.position.y=solids.caillou.height/2;
 const shape=new T.Shape(keyOutline.map(p=>new T.Vector2(...p)));shape.holes.push(new T.Path(keyHole.map(p=>new T.Vector2(...p))));const key=make('cle',new T.ExtrudeGeometry(shape,{depth:solids.cle.thickness,bevelEnabled:false,curveSegments:24}),new T.MeshStandardMaterial({color:'#b4a16d',metalness:.75,roughness:.3}));key.position.z=-solids.cle.thickness/2;
 for(const [id,d]of Object.entries(v.solids)){const before=new Set(d.g.children);addContactShadow(d.g,scene.surface.shadow,1.7,1.6,.012,.35);d.shadows=d.g.children.filter(o=>!before.has(o));}
 cylinder.traverse(o=>{if(o.isMesh&&!o.userData.immersionHandle)o.userData.immersionDevice='cylinder';});
 return v;
}
function update(v,s){const {T}=v.kit,r=levels(s),c=v.groups.cylinder,at=s.bench?.cylinder??[1.55,-.1];c.position.set(at[0],.08,at[1]);
 const h=r.level/vessel.capacity*vessel.height;v.water.visible=h>0;v.water.scale.y=Math.max(.0001,h);v.water.position.y=vessel.base+h/2;v.meniscus.position.y=vessel.base+h;v.baseline.position.y=vessel.base+s.initialWater/vessel.capacity*vessel.height;v.pool.visible=s.spill>EPS;
 const inTube=mounted(s);v.thread.visible=inTube;v.grip.visible=inTube;if(!inTube){v.rod.scale.y=(4.88-.2)/4.75;v.rod.position.y=(4.88+.2)/2;v.arm.position.y=v.armEnd.position.y=4.88;v.grip.position.y=4.7;}
 for(const [id,d]of Object.entries(v.solids)){const p=s.bench?.[id]??solids[id].at;d.g.rotation.set(0,0,0);d.g.position.set(p[0],.16,p[1]);d.shadows.forEach(o=>o.visible=true);
  if(id===s.object&&inTube){const depth=depthForFraction(id,s.fraction),bottom=vessel.base+h-depth+(s.fraction===0?.06:s.fraction===1?-.025:0);d.g.rotation.set(0,0,0);d.g.position.set(at[0],.08+.21+bottom,at[1]);d.shadows.forEach(o=>o.visible=false);const top=.21+bottom+solids[id].height,stand=Math.max(4.88,top+.45);v.rod.scale.y=(stand-.2)/4.75;v.rod.position.y=(stand+.2)/2;v.arm.position.y=v.armEnd.position.y=stand;v.grip.position.y=stand-.18;const a=v.thread.geometry.attributes.position;a.setXYZ(0,.1,v.grip.position.y,.06);a.setXYZ(1,0,.21+bottom+solids[id].height,0);a.needsUpdate=true;v.thread.geometry.computeBoundingSphere();}
 }
 v.kit.invalidate();
}
export function immersionReading(s){const r=levels(s),v1=s.initialWater/ML,v2=r.level/ML,span=Math.max(40,Math.ceil(Math.abs(v2-v1)/10)*10+20),low=clamp(Math.floor((Math.min(v1,v2)-10)/10)*10,0,100-span),y=n=>244-(n-low)/span*214;let ticks='';for(let n=low;n<=low+span;n+=2)ticks+=`<path d="M142 ${y(n)}h${n%10===0?31:17}"/>${n%10===0?`<text x="183" y="${y(n)+5}">${n}</text>`:''}`;return `<svg class="immersion-reading" viewBox="0 0 255 275" role="img" aria-label="Graduations de 2 mL, niveau initial en pointillés et niveau actuel en bleu"><rect x="52" y="22" width="107" height="224" rx="5" fill="#fff" stroke="#8da8b6"/><path d="M53 ${y(v2)-6}Q105 ${y(v2)+6} 158 ${y(v2)-6}V245H53Z" fill="#afcfda"/><path class="immersion-level" d="M53 ${y(v2)-6}Q105 ${y(v2)+6} 158 ${y(v2)-6}" fill="none" stroke="#315e73" stroke-width="2"/><path d="M52 ${y(v1)}H174" stroke="#ad7e45" stroke-dasharray="5 4"/><text x="19" y="${y(v1)+4}" fill="#785733" font-size="13">V₁</text><g fill="#244451" stroke="#244451" font-size="14">${ticks.replaceAll('<text','<text stroke="none"')}</g><text x="182" y="16" font-size="13" fill="#244451">mL</text><text x="127" y="267" text-anchor="middle" font-size="12" fill="#244451">1 division = 2 mL</text></svg>`;}
