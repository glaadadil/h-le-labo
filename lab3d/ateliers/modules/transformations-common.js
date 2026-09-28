// Shared only by the transformations suite. No scene/camera or existing module changes.
export const EPS=1e-10;
export const clone=s=>JSON.parse(JSON.stringify(s));
export const clamp=(v,a,b,d=a)=>typeof v==='number'&&Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export const pick=(v,vs,d)=>vs.includes(v)?v:d;
export const near=(a,b)=>Math.abs(a-b)<EPS;
export const num=(s,k,a,b)=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=a-EPS&&s[k]<=b+EPS;
export const obj=s=>s!==null&&typeof s==='object'&&!Array.isArray(s);
export const bool=(s,...ks)=>ks.every(k=>typeof s[k]==='boolean');
export const en=(s,k,vs)=>vs.includes(s[k]);
export const f=(n,d=2)=>Number(n.toFixed(d)).toLocaleString('fr-FR');
export const g=n=>`${f(n*1000,3)} g`;
export const b=(id,label,disabled=false)=>({id,type:'button',label,disabled});
export const ck=(id,label,value)=>({id,type:'checkbox',label,value});
export const rg=(id,label,value,min,max,step,unit)=>({id,type:'range',label,value,min,max,step,unit});
export const sel=(id,label,value,options)=>({id,type:'select',label,value,options:options.map(x=>({value:x[0],label:x[1]}))});
export const ob=(title,lines,metrics=[],warning='')=>({title,lines,metrics:metrics.map(([label,value])=>({label,value})),warning,board:[title,...metrics.slice(0,3).map(x=>x.join(' : '))]});
export const limits='Représentation schématique : niveaux sans volume gradué, étapes sans durée réelle.';
export function define(w){const reduce=w.act;w.act=(s,id,v)=>id==='reset'?w.initial():reduce(clone(s),id,v);const controls=w.controls;w.controls=s=>[...controls(s),b('reset','Recommencer')];return w;}
export function materials(k){const {T,scene:s}=k;return {glass:new T.MeshPhysicalMaterial({color:'#d2e9ef',transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide,roughness:.07,metalness:0}),water:new T.MeshStandardMaterial({color:'#81b4c7',transparent:true,opacity:.55,depthWrite:false,roughness:.23}),edge:s.mat('trans-edge','#819da7',{metalness:.4}),solid:s.mat('trans-solid','#e5dfc9'),sand:s.mat('trans-sand','#ba9264'),oil:s.mat('trans-oil','#dfb75c',{transparent:true,opacity:.8}),dark:s.mat('trans-dark','#314956'),blue:s.mat('trans-blue','#5391b5'),red:s.mat('trans-red','#cb785e'),green:s.mat('trans-green','#759576'),white:s.mat('trans-white','#efefe5'),ice:s.mat('trans-ice','#97d0e4',{transparent:true,opacity:.72}),metal:s.mat('trans-metal','#94a7ad',{metalness:.7})};}
export function group(k,x=0,y=.05,z=0){const a=new k.T.Group();a.position.set(x,y,z);k.root.add(a);return a;}
export function hit(m,id,value){m.userData.workshopAction={id,value};return m;}
export function label(k,p,t,w,h,x,y,z){return k.scene.print(p,t,w,h,x,y,z,{background:'#e3e8da',color:'#28434b'});}
export function text(mesh,t){if(mesh.userData.text===t)return;mesh.userData.text=t;const c=mesh.material.map?.image;if(!c?.getContext)return;const ctx=c.getContext('2d');ctx.fillStyle='#e3e8da';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#28434b';ctx.font=`500 ${t.length>23?34:55}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,c.width/2,c.height/2,c.width-12);mesh.material.map.needsUpdate=true;}
export function cup(k,m,x,z=0,title='',r=.56,h=1.6,y=.05){const a=group(k,x,y,z),s=k.scene,T=k.T;const shell=s.mesh(a,new T.LatheGeometry([[0,0],[r,0],[r,h],[r-.03,h],[r-.03,.06],[0,.06]].map(p=>new T.Vector2(...p)),32),m.glass);const rim=s.mesh(a,new T.TorusGeometry(r-.012,.018,10,48),m.edge,0,h,0);rim.rotation.x=Math.PI/2;for(let i=1;i<5;i++){const mark=s.box(a,i%2?.09:.16,.012,.012,m.dark,r*.52,h*i/5,r*.86);mark.rotation.y=.35;}const liquid=s.cyl(a,r-.055,r-.055,1,m.water.clone(),0,.5,0);const meniscus=s.mesh(a,new T.TorusGeometry(r-.060,.011,8,48),m.water.clone(),0,1,0);meniscus.rotation.x=Math.PI/2;meniscus.material.opacity=.78;const layer=s.cyl(a,r-.055,r-.055,.2,m.oil.clone(),0,1.1,0);const grains=[];for(let i=0;i<24;i++)grains.push(s.mesh(a,new T.SphereGeometry(.055,8,6),m.sand,Math.sin(i*2.4)*r*.65,.11+(i%3)*.04,Math.cos(i*2.4)*r*.65));const tag=label(k,a,title,r*2.4,.24,0,.25,r+.05);const rod=s.cyl(a,.025,.025,h,m.edge,r*.6,h*.7,0);rod.rotation.z=-.16;layer.visible=false;return {g:a,shell,liquid,meniscus,layer,grains,tag,rod,r,h};}
export function fill(v,fraction,color='#81b4c7'){const h=Math.max(.001,clamp(fraction,0,.95)*(v.h-.12));v.liquid.visible=fraction>EPS;v.liquid.scale.y=h;v.liquid.position.y=.065+h/2;v.liquid.material.color.set(color);if(v.meniscus){v.meniscus.visible=fraction>EPS;v.meniscus.position.y=.069+h;v.meniscus.material.color.set(color);}}
export function grains(v,amount,suspended=false,mat=null){v.grains.forEach((p,i)=>{p.visible=i<Math.ceil(clamp(amount,0,1)*v.grains.length);p.position.y=suspended?.22+(i%7)*.13:.12+(i%3)*.03;if(mat)p.material=mat;});}
export function layer(v,amount){v.layer.visible=amount>EPS;v.layer.scale.y=Math.max(.01,amount/.2);v.layer.position.y=.065+v.liquid.scale.y+amount/2;}
export function button(k,m,x,z,t,id,value){const a=group(k,x,.05,z);a.userData.naturalObsolete=true;hit(k.scene.box(a,1,.15,.62,m.blue,0,.08,0),id,value);label(k,a,t,1.08,.22,0,.23,.33);return a;}
export function spheres(k,parent,count,mat,r=.075){return Array.from({length:count},()=>k.scene.mesh(parent,new k.T.SphereGeometry(r,12,8),mat));}
export function particles(ps,state,phase=0,width=1,height=1.2){ps.forEach((p,i)=>{const a=i*2.399+phase*.27;if(state==='solid'){p.position.set((i%4-1.5)*.22+Math.sin(phase+i)*.008,.18+Math.floor(i/4)*.17,(i%3-1)*.18);}else if(state==='liquid'){p.position.set(Math.sin(a)*.40,.14+((i*7+phase)%ps.length)/ps.length*.58,Math.cos(a)*.34);}else{p.position.set(((((i*7)%ps.length)+.5)/ps.length-.5)*width,.12+((i*11+phase)%ps.length+.5)/ps.length*height,Math.sin(a)*.34);}p.scale.setScalar(1);});}
export function panel(k,m,x,z,title,id){const a=group(k,x,.05,z);const base=k.scene.box(a,1.4,.12,1,m.white,0,.06,0);if(id)hit(base,id);const tag=label(k,a,title,1.35,.3,0,.5,.16);return {g:a,tag,base};}
export function pipe(k,m,points,id){const p=k.scene.tube(k.root,points,.045,m).mesh;if(id)hit(p,id);return p;}
export function plot(k,m,x,z,count=32){const a=group(k,x,.05,z),s=k.scene; s.box(a,3.4,2.4,.05,m.white,0,1.25,0);s.box(a,2.9,.015,.04,m.dark,0,.25,.045);s.box(a,.015,1.9,.04,m.dark,-1.45,1.2,.045);const dots=spheres(k,a,count,m.red,.045);dots.forEach(p=>p.visible=false);return {g:a,dots};}
export function plotPoints(v,points,xmax,ymin,ymax){v.dots.forEach((p,i)=>{p.visible=i<points.length;if(p.visible)p.position.set(-1.45+points[i][0]/xmax*2.85,.25+(points[i][1]-ymin)/(ymax-ymin)*1.9,.09);});}
// Specific enthalpy with ice at 0 °C as origin; pure water at 101325 Pa.
export function waterState(q,m=.1){const h=q/m,L=334000,B=L+418600,V=2256000;let t,ice=0,liquid=0,vapor=0;
 if(h<0){t=h/2090;ice=m;}else if(h<L){t=0;liquid=m*h/L;ice=m-liquid;}else if(h<B){t=(h-L)/4186;liquid=m;}else{t=100;vapor=m*clamp((h-B)/V,0,1);liquid=m-vapor;}return {t,ice,liquid,vapor};}
export const WATER_MAX=.1*(334000+418600+2256000);
