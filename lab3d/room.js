import * as T from './vendor/three.module.min.js';
import {addContactShadow} from './materials.js';
import {addBlackboard} from './blackboard.js';

// The room envelope, bench and window positions match the first interactive scene.
export function buildRoom(s){
  const root=s.scene,tex=s.surface;
  const stone=s.mat('stone','#ffffff',{map:tex.stone,bumpMap:tex.stone,bumpScale:.013,roughness:.57});
  const wood=s.mat('wood','#ffffff',{map:tex.wood,bumpMap:tex.wood,bumpScale:.028,roughness:.43});
  const wall=s.mat('wall','#ecd1aa',{roughness:.94,emissive:'#ecd1aa',emissiveIntensity:.30}),metal=s.mat('frame','#a5afb1',{metalness:.8,roughness:.28});
  s.rounded(root,16,.28,9,.13,wood,0,-.25,.2);s.rounded(root,15.96,.14,8.97,.13,stone,0,-.075,.2);
  // The thin recessed joint separates the stone slab from its oak edge.
  s.rounded(root,15.98,.022,8.99,.12,s.mat('tableJoint','#645b4d',{roughness:.9}),0,-.17,.2);
  s.box(root,36,.1,35,s.mat('floor','#ffffff',{map:tex.floor,roughness:.79}),0,-3,-4);
  for(const wallMesh of [s.box(root,32,12,.3,wall,0,3,-7),s.box(root,.3,12,25,wall,-10,3,-1)]){wallMesh.castShadow=false;wallMesh.receiveShadow=false;}
  s.box(root,20,.18,.05,s.mat('skirting','#aaa9a1'),0,-2.81,-6.8);
  for(const x of [-6.8,6.8])for(const z of [-3,3.5]){s.box(root,.18,2.6,.18,metal,x,-1.6,z);s.box(root,.22,.08,.22,s.mat('rubber','#303435',{roughness:.86}),x,-2.91,z);}
  const floorShadow=addContactShadow(root,tex.shadow,19,11,-2.938,.62);floorShadow.position.z=.2;
  const cabinetry=s.mat('cabinet','#c0cac9',{roughness:.55}),edge=s.mat('cabinetEdge','#657476',{roughness:.7});
  s.box(root,12,1.5,1.15,edge,1.6,-.15,-6.15);s.box(root,13,.17,1.35,wood,1.6,.7,-6.1);
  for(let i=0;i<8;i++){
    const x=-3.635+i*1.49;s.rounded(root,1.45,1.38,.05,.025,cabinetry,x,-.1,-5.55);
    s.box(root,.37,.045,.06,metal,x,.30,-5.48);s.box(root,.035,.085,.08,metal,x-.16,.30,-5.48);s.box(root,.035,.085,.08,metal,x+.16,.30,-5.48);
  }
  s.box(root,11.85,.12,.14,s.mat('toeKick','#596768'),1.6,-.93,-5.66);
  const trim=s.mat('trim','#f0f0e9',{roughness:.4});
  s.box(root,6,3.3,.09,new T.MeshBasicMaterial({map:tex.garden,toneMapped:false}),-5.1,3.3,-6.76);
  for(const x of [-8.1,-5.1,-2.1])s.box(root,.095,3.45,.15,trim,x,3.3,-6.63);
  for(const y of [1.65,3.2,4.95])s.box(root,6.12,.085,.15,trim,-5.1,y,-6.63);
  s.box(root,6.4,.14,.5,wood,-5.1,1.59,-6.5);
  for(const x of [-7.94,-2.27])s.box(root,.045,3.16,.035,s.mat('windowSeal','#8b9696'),x,3.3,-6.69);
  s.box(root,.045,.26,.09,metal,-5.24,2.92,-6.49);
  addBlackboard(s,metal);
  // Small nameplate on the visible front-left area; camera and table stay fixed.
  s.rounded(root,1.40,.024,.44,.025,s.mat('nameplate','#dfcfb2',{roughness:.65}),-5.05,.069,4.25);
  const name=s.print(root,'Hidaya',1.18,.29,-5.05,.092,4.25,{background:'#dfcfb2',color:'#302e29'});name.rotation.x=-Math.PI/2;
  glassware(s);plant(s);books(s);microscope(s);
  plant(s,[10.25,-2.945,-6.35],1.4);
  for(const x of [-7.4,7.5]){
    s.cyl(root,.53,.53,.14,wood,x,-1.5,-3.8);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;s.box(root,.055,1.35,.055,metal,x+Math.sin(a)*.35,-2.18,-3.8+Math.cos(a)*.35);}
    const ring=s.mesh(root,new T.TorusGeometry(.36,.026,8,32),metal,x,-2.16,-3.8);ring.rotation.x=Math.PI/2;
  }
  batchStaticRoom(root);
}

// Static opaque surfaces sharing a finish are submitted together. The room stays
// detailed without making every cabinet handle or leaf a separate GPU draw call.
function batchStaticRoom(root){
  root.updateMatrixWorld(true);const buckets=new Map(),discard=new Set();
  root.traverse(mesh=>{if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.material.transparent)return;const key=mesh.material.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(mesh);});
  for(const meshes of buckets.values()){
    if(meshes.length<2)continue;
    const chunks=meshes.map(mesh=>{const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrixWorld);return geo;});
    const combined=new T.BufferGeometry();
    for(const name of ['position','normal','uv']){
      const size=name==='uv'?2:3,count=chunks.reduce((n,g)=>n+g.attributes.position.count,0),data=new Float32Array(count*size);let offset=0;
      for(const g of chunks){const attr=g.getAttribute(name);if(attr)data.set(attr.array,offset);offset+=g.attributes.position.count*size;}
      combined.setAttribute(name,new T.BufferAttribute(data,size));
    }
    combined.computeBoundingSphere();const merged=new T.Mesh(combined,meshes[0].material);merged.castShadow=meshes[0].castShadow;merged.receiveShadow=meshes[0].receiveShadow;root.add(merged);
    meshes.forEach(mesh=>{mesh.removeFromParent();discard.add(mesh.geometry);});chunks.forEach(g=>g.dispose());
  }
  discard.forEach(g=>g.dispose());
}

function glassware(s){
  const glass=new T.MeshPhysicalMaterial({color:'#f0f9fc',transparent:true,opacity:.22,roughness:.055,metalness:0,side:T.DoubleSide,depthWrite:false,clearcoat:1,envMapIntensity:1.6});
  const rim=s.mat('glassEdge','#b6d0d4',{transparent:true,opacity:.63,metalness:.18,roughness:.16,depthWrite:false});
  const profiles=[[[0,0],[.22,0],[.23,.03],[.23,.67],[.221,.68],[.212,.66],[.212,.04],[0,.04]],[[0,0],[.28,0],[.29,.05],[.115,.59],[.115,.79],[.106,.8],[.10,.78],[.10,.58],[.268,.06],[0,.04]],[[0,0],[.17,0],[.18,.04],[.18,.51],[.173,.52],[.162,.50],[.162,.04],[0,.04]],[[0,0],[.12,0],[.135,.02],[.135,.87],[.127,.88],[.12,.86],[.12,.04],[0,.04]]];
  const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d');ctx.strokeStyle='rgba(74,109,119,.7)';ctx.lineWidth=2;ctx.fillStyle='#597d86';ctx.font='18px sans-serif';for(let i=1;i<7;i++){const y=230-i*29;ctx.beginPath();ctx.moveTo(14,y);ctx.lineTo(i%2?39:57,y);ctx.stroke();if(i%2===0)ctx.fillText(String(i*25),65,y+6);}const scaleMap=new T.CanvasTexture(c);scaleMap.colorSpace=T.SRGBColorSpace;s.textures.push(scaleMap);const scaleMat=new T.MeshBasicMaterial({map:scaleMap,transparent:true,depthWrite:false,opacity:.8});
  profiles.forEach((p,i)=>{
    const g=new T.Group();g.position.set(-.2+i*.81,.793,-5.96);s.scene.add(g);
    s.mesh(g,new T.LatheGeometry(p.map(a=>new T.Vector2(...a)),32),glass,0,0,0,false);
    const radius=[.224,.11,.175,.13][i],h=[.676,.794,.516,.874][i];const lip=s.mesh(g,new T.TorusGeometry(radius,.007,6,32),rim,0,h,0,false);lip.rotation.x=Math.PI/2;
    const label=s.mesh(g,new T.PlaneGeometry(radius*1.35,h*.76),scaleMat,0,h*.48,radius+.006,false);label.rotation.y=.03;
    const ao=addContactShadow(g,s.surface.shadow,.8,.72,.008,.47);ao.position.z=.02;
    if(i===0||i===2){const liquid=s.mat('water'+i,i===0?'#91b2bb':'#ddcea3',{transparent:true,opacity:.15,roughness:.18,depthWrite:false});s.cyl(g,radius-.013,radius-.014,i===0?.17:.11,liquid,0,i===0?.13:.10,0,32).castShadow=false;}
  });
  // A modest rack and three slender glass test tubes.
  const rack=s.mat('rack','#ae8a61',{roughness:.58});s.box(s.scene,.64,.045,.38,rack,3.11,.84,-6.13);s.box(s.scene,.045,.36,.30,rack,2.82,1.02,-6.13);s.box(s.scene,.045,.36,.30,rack,3.40,1.02,-6.13);s.box(s.scene,.64,.045,.26,rack,3.11,1.20,-6.13);
  for(let i=0;i<3;i++){const profile=[[0,0],[.033,.005],[.056,.032],[.058,.46],[.050,.46],[.05,.037],[.026,.012],[0,.01]].map(p=>new T.Vector2(...p));s.mesh(s.scene,new T.LatheGeometry(profile,16),glass,2.93+i*.18,.86,-6.12,false);}
}
function plant(s,position=[-2.1,.785,-6],scale=1){
  const g=new T.Group();g.position.set(...position);g.scale.setScalar(scale);s.scene.add(g);
  const pot=s.mat('pot','#c7b69b',{roughness:.84,bumpMap:s.surface.stone,bumpScale:.02});
  s.mesh(g,new T.LatheGeometry([[0,0],[.27,0],[.29,.04],[.35,.46],[.34,.49],[.31,.49],[.305,.44],[.26,.055],[0,.055]].map(p=>new T.Vector2(...p)),32),pot);
  s.cyl(g,.307,.307,.025,s.mat('soil','#3e3930',{roughness:1}),0,.437,0);
  const stem=s.mat('plantStem','#627051',{roughness:.88});
  const leafMats=['#637356','#7c895f','#8d966d'].map((c,i)=>s.mat('leaf'+i,c,{roughness:.69,side:T.DoubleSide}));
  const leaf=new T.Shape();leaf.moveTo(0,0);leaf.bezierCurveTo(-.17,.12,-.17,.33,0,.48);leaf.bezierCurveTo(.15,.31,.16,.12,0,0);
  const geo=new T.ShapeGeometry(leaf,8);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getY(i)/.48*Math.PI)*.065);geo.computeVertexNormals();
  for(let i=0;i<9;i++){
    const a=i*2.4,dx=Math.sin(a)*.31,dz=Math.cos(a)*.31,height=.78+(i%3)*.20;
    s.tube(g,[[0,.43,0],[dx*.6,.75,dz*.6],[dx,height,dz]],.011,stem,'',10);
    for(let j=0;j<2;j++){const m=s.mesh(g,geo,leafMats[(i+j)%3],dx*(j?.73:1),height-(j?.2:0),dz*(j?.73:1));m.rotation.set(-.35+j*.8,a+(j?Math.PI:0),Math.sin(a)*.45);m.scale.setScalar(j?.75:1);}
  }
  addContactShadow(g,s.surface.shadow,.94,.85,.014,.58);
}
function books(s){
  const page=s.mat('paper','#e5dcc7',{roughness:.93});
  for(let i=0;i<3;i++){const g=new T.Group();g.position.set(4.05,.83+i*.095,-6.14);g.rotation.y=[.03,-.07,.09][i];s.scene.add(g);const cover=s.mat('book'+i,['#596f7e','#a79a7c','#c3b492'][i]);s.box(g,.95,.07,.60,page,0,0,0);s.box(g,.98,.013,.63,cover,0,.042,0);s.box(g,.98,.013,.63,cover,0,-.042,0);s.box(g,.98,.085,.024,cover,0,0,.30);}
}
function microscope(s){
  const g=new T.Group();g.position.set(6.24,.785,-6.05);g.rotation.y=-.34;g.scale.setScalar(.86);s.scene.add(g);
  const body=s.mat('scopeBody','#d8dcda',{metalness:.16,roughness:.38}),dark=s.mat('scopeDark','#293239',{roughness:.36}),steel=s.mat('scopeSteel','#adb8bc',{metalness:.87,roughness:.22});
  s.rounded(g,1.12,.12,.76,.14,body,0,.075,0);
  s.tube(g,[[.22,.14,-.17],[.38,.6,-.22],[.30,1.13,-.2],[.08,1.43,-.13],[-.15,1.43,.04]],.095,body,'',24);
  s.box(g,.78,.07,.50,dark,-.10,.62,.09);s.box(g,.35,.015,.12,steel,-.1,.667,.12);
  s.cyl(g,.13,.18,.20,steel,-.15,1.18,.10,24);s.cyl(g,.05,.065,.23,steel,-.21,.98,.14,16);
  const barrel=s.cyl(g,.10,.105,.43,body,-.19,1.5,.035);barrel.rotation.z=.27;
  const eyepiece=s.cyl(g,.10,.08,.18,dark,-.26,1.78,.035);eyepiece.rotation.z=.27;
  const focus=s.cyl(g,.14,.14,.13,dark,.41,1.05,-.19,24);focus.rotation.z=Math.PI/2;
  s.cyl(g,.15,.18,.055,steel,-.1,.23,.11);addContactShadow(g,s.surface.shadow,1.6,1.2,.016,.55);
}
