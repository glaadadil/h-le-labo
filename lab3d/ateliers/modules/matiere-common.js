// Shared apparatus only; each lesson owns its state, interactions and scientific model.
export const ML=1e-6,EPS=1e-10;
export const num=(v,a,b,f=a)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):f;
export const pick=(v,list,f)=>list.includes(v)?v:f;
export const fmt=(v,d=2)=>Number(v.toFixed(d)).toLocaleString('fr-FR');
export const range=(id,label,value,min,max,step,unit='')=>({id,type:'range',label,value,min,max,step,unit});
export const button=(id,label,disabled=false)=>({id,type:'button',label,disabled});
export const check=(id,label,value)=>({id,type:'checkbox',label,value});
export const select=(id,label,value,options)=>({id,type:'select',label,value,options:options.map(x=>Array.isArray(x)?{value:x[0],label:x[1]}:{value:x,label:x})});
export const metric=(label,value)=>({label,value});
export const obs=(title,lines,metrics=[],warning='')=>({title,lines,metrics,warning,board:[title,...metrics.slice(0,4).map(x=>`${x.label} : ${x.value}`)]});
export const N=(a,b)=>v=>typeof v==='number'&&Number.isFinite(v)&&v>=a-EPS&&v<=b+EPS;
export const E=(...values)=>v=>values.includes(v);
export const B=v=>typeof v==='boolean';
export const record=s=>s!==null&&typeof s==='object'&&!Array.isArray(s);
export const valid=(s,schema)=>record(s)&&Object.entries(schema).every(([k,test])=>test(s[k]));
export function workshop(config){const original=config.act;return {...config,act(s,id,v){if(id==='reset')return config.initial();return original.call(config,{...s},id,v);},controls(s){return [...config.controls(s),button('reset','Recommencer')];}};}
export const rounded=(n,step)=>Math.sign(n)*Math.floor(Math.abs(n)/step+.5+1e-10)*step;
export function rig(kit){const {T,root,scene}=kit;
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.5,...extra});
 const m={glass:new T.MeshPhysicalMaterial({color:'#e4f0ed',transparent:true,opacity:.23,roughness:.09,metalness:.02,clearcoat:1,side:T.DoubleSide,depthWrite:false}),water:mat('#65b7d0',{transparent:true,opacity:.64,depthWrite:false}),metal:mat('#9caab0',{metalness:.65}),dark:mat('#304b59'),wood:mat('#c8a578'),red:mat('#c7664d'),white:mat('#efeadc'),sand:mat('#cbb27b')};
 const mesh=(geo,material,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=!material.transparent;o.receiveShadow=true;parent.add(o);return o;};
 const box=(w,h,d,material,x=0,y=0,z=0,parent=root)=>mesh(new T.BoxGeometry(w,h,d),material,x,y,z,parent);
 const cyl=(r,h,material,x=0,y=0,z=0,parent=root)=>mesh(new T.CylinderGeometry(r,r,h,40),material,x,y,z,parent);
 const sphere=(r,material,x=0,y=0,z=0,parent=root)=>mesh(new T.SphereGeometry(r,24,16),material,x,y,z,parent);
 const group=(x=0,y=0,z=0,parent=root)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;};
 const label=(text,x,y,z,w=1.6,h=.22,parent=root)=>scene.print(parent,text,w,h,x,y,z,{background:'#eee4d0',color:'#263f4b'});
 return {kit,T,root,m,mat,mesh,box,cyl,sphere,group,label};
}
export function tag(o,id,value){o.userData.workshopAction={id,value};return o;}
export function text(mesh,message){if(mesh.userData.message===message)return;mesh.userData.message=message;const map=mesh.material?.map,c=map?.image,ctx=c?.getContext?.('2d');if(!ctx)return;ctx.fillStyle='#eee4d0';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#263f4b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${message.length>23?38:58}px sans-serif`;ctx.fillText(message,c.width/2,c.height/2,c.width-12);map.needsUpdate=true;}
export function jar(r,x=0,z=0,{radius=.55,height=1.7,title='Récipient',base=.12}={}){const g=r.group(x,base,z);r.mesh(new r.T.CylinderGeometry(radius,radius,height,64,1,true),r.m.glass,0,height/2,0,g);r.cyl(radius,.04,r.m.glass,0,0,0,g);for(const y of [.02,height]){const ring=r.mesh(new r.T.TorusGeometry(radius,.018,8,64),r.m.glass,0,y,0,g);ring.rotation.x=Math.PI/2;}const water=r.cyl(radius-.025,1,r.m.water.clone(),0,.5,0,g);r.label(title,0,.18,radius+.035,Math.max(1.2,radius*2),.18,g);return {g,water,height,radius};}
export function fill(v,f,color){const h=v.height*Math.max(.00001,num(f,0,1));v.water.visible=f>0;v.water.scale.y=h;v.water.position.y=h/2;if(color)v.water.material.color.set(color);}
export function scale(r,x=0,z=0,title='Balance'){const g=r.group(x,.08,z);r.box(2.05,.32,1.5,r.m.white,0,.16,0,g);for(const a of [-.8,.8])for(const b of [-.48,.48])r.cyl(.09,.08,r.m.dark,a,-.015,b,g);r.cyl(.74,.08,r.m.metal,0,.34,-.05,g);r.box(1.65,.25,.045,r.m.dark,0,.18,.774,g);const screen=r.label(title,-.15,.18,.801,1.18,.19,g);const power=r.cyl(.09,.025,r.m.red,.75,.18,.81,g);power.rotation.x=Math.PI/2;return {g,screen,power};}
export function particles(r,count=24){const out=[];for(let i=0;i<count;i++)out.push(r.sphere(.065,i%2?r.m.water:r.m.white));return out;}
export function dial(r,x=0,y=1.2,z=0,label='Cadran',max=100,unit=''){const g=r.group(x,y,z);const face=r.cyl(.65,.06,r.m.white,0,0,0,g);face.rotation.x=Math.PI/2;for(let i=0;i<=10;i++){const a=-Math.PI*.75+i*Math.PI*1.5/10;const mark=r.box(.018,.10,.03,r.m.dark,.54*Math.sin(a),.54*Math.cos(a),.04,g);mark.rotation.z=-a;if(i%2===0)r.label(fmt(max*i/10),.43*Math.sin(a),.43*Math.cos(a),.045,.2,.11,g);}const needle=r.box(.025,.48,.03,r.m.red,0,.24,.09);const pivot=r.group(0,0,.08,g);pivot.add(needle);needle.position.set(0,.24,.02);r.label(label+' '+unit,0,-.78,.08,1.7,.18,g);return {g,pivot};}
export function needle(d,f){d.pivot.rotation.z=Math.PI*.75-num(f,0,1)*Math.PI*1.5;}
export function bars(r,n,x=-1.8){return Array.from({length:n},(_,i)=>r.box(.22,1,.25,r.m.water.clone(),x+i*.48,.5,1.05));}
