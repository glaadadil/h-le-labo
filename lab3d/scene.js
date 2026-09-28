import * as T from './vendor/three.module.min.js';
import {makeMaterials,addContactShadow} from './materials.js';
import {buildRoom} from './room.js';

// A persistent, demand-rendered scene. Physics stays in the shared E02 engine.
window.Hidaya3D = class {
  constructor() {
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.VSMShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.94;
    this.canvas=this.renderer.domElement;this.canvas.className='lab-canvas';this.canvas.setAttribute('aria-hidden','true');
    this.scene=new T.Scene();this.scene.background=new T.Color('#e9e5dc');this.scene.fog=new T.Fog('#e9e5dc',30,75);
    this.camera=new T.PerspectiveCamera(40,1,.1,100);this.ray=new T.Raycaster();this.tablePlane=new T.Plane(new T.Vector3(0,1,0),-.08);
    this.objects={};this.pins={};this.curves={};this.wires=new T.Group();this.scene.add(this.wires);this.frame=0;this.stateKey='';this.width=1;this.height=1;
    this.materials={};this.interactives=[];this.textures=[];
    this.surface=makeMaterials();this.textures.push(...Object.values(this.surface));
    this.scene.add(new T.HemisphereLight('#e2ebf7','#978975',.8));
    const sun=new T.DirectionalLight('#fff1d8',2.6);sun.position.set(-6,10,-3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.normalBias=.012;sun.shadow.bias=-.0001;sun.shadow.radius=2.6;sun.shadow.blurSamples=8;this.scene.add(sun);
    const fill=new T.DirectionalLight('#e5edfa',1.25);fill.position.set(4,5,8);this.scene.add(fill);
    // A local HDR studio environment supplies window-shaped glass/metal reflections.
    const env=new T.Scene();env.background=new T.Color('#555e69');
    const panels=[];
    for(const [w,h,pos,color,intensity] of [[6,7,[-6,5,-3],'#f6f4ec',3.4],[5,5,[5,3,6],'#dce9fa',.75],[10,9,[0,8,0],'#e4e0d5',1.15]]){
      const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));panel.position.set(...pos);panel.lookAt(0,0,0);env.add(panel);panels.push(panel);
    }
    const pmrem=new T.PMREMGenerator(this.renderer);this.envTarget=pmrem.fromScene(env,.025,.1,30);this.scene.environment=this.envTarget.texture;this.scene.environmentIntensity=.72;pmrem.dispose();panels.forEach(p=>{p.geometry.dispose();p.material.dispose();});
    this.makeRoom();this.makeBattery();this.makeLamp();this.makeSwitch();this.makeSocket();
    this.halo=new T.Mesh(new T.RingGeometry(.92,1.00,64),new T.MeshBasicMaterial({color:'#397bbe',transparent:true,opacity:.46,side:T.DoubleSide,depthWrite:false}));this.halo.rotation.x=-Math.PI/2;this.halo.position.y=.058;this.scene.add(this.halo);
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.canvas.dispatchEvent(new CustomEvent('lab-context-lost',{bubbles:true}));});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.invalidate();});
  }
  mat(name,color,extra={}){if(!this.materials[name])this.materials[name]=new T.MeshStandardMaterial({color,roughness:.55,...extra});return this.materials[name];}
  mesh(parent,geo,mat,x=0,y=0,z=0,shadow=true){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=shadow;parent.add(m);return m;}
  box(parent,w,h,d,mat,x,y,z){return this.mesh(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);}
  rounded(parent,w,h,d,r,mat,x=0,y=0,z=0){const shape=new T.Shape(),a=-w/2,b=-d/2;shape.moveTo(a+r,b);shape.lineTo(a+w-r,b);shape.quadraticCurveTo(a+w,b,a+w,b+r);shape.lineTo(a+w,b+d-r);shape.quadraticCurveTo(a+w,b+d,a+w-r,b+d);shape.lineTo(a+r,b+d);shape.quadraticCurveTo(a,b+d,a,b+d-r);shape.lineTo(a,b+r);shape.quadraticCurveTo(a,b,a+r,b);const geo=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelThickness:r*.4,bevelSize:r*.45,bevelSegments:3,steps:1,curveSegments:6});geo.rotateX(Math.PI/2);return this.mesh(parent,geo,mat,x,y+h/2,z);}
  cyl(parent,rt,rb,h,mat,x,y,z,n=32){return this.mesh(parent,new T.CylinderGeometry(rt,rb,h,n),mat,x,y,z);}
  tube(parent,points,r,mat,name='',segments=32){const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:new T.Vector3(...p)));const m=this.mesh(parent,new T.TubeGeometry(curve,segments,r,8,false),mat);if(name)m.userData.hit={type:'wire',id:name};return {mesh:m,curve};}
  print(parent,text,w,h,x,y,z,opts={}){const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle=opts.background||'#e9dfc8';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=opts.color||'#38464e';ctx.font='500 90px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,100,480);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;this.textures.push(map);const m=this.mesh(parent,new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,roughness:.65}),x,y,z,false);return m;}
  makeRoom(){buildRoom(this);}
  group(id){const g=new T.Group();g.userData.hit={type:'device',id};g.scale.setScalar(1.17);this.objects[id]=g;this.scene.add(g);const size=id==='pile'?[2.1,1.5]:id==='lampe'?[2.4,1.65]:[2.5,1.45];addContactShadow(g,this.surface.shadow,...size,.05,.83);return g;}
  post(g,t,x,y,z){const brass=this.mat('brass','#b9a36c',{metalness:.85,roughness:.24});this.cyl(g,.12,.13,.055,brass,x,y-.07,z);this.cyl(g,.065,.075,.14,brass,x,y+.015,z);this.cyl(g,.092,.092,.04,this.mat('silver','#c5d1d9',{metalness:.85,roughness:.19}),x,y+.10,z);const slot=this.box(g,.11,.003,.014,this.mat('screwSlot','#515a5b',{roughness:.4}),x,y+.122,z);slot.rotation.y=.35;this.pins[t]={group:g,local:new T.Vector3(x,y+.125,z)};}
  makeBattery(){const g=this.group('pile');this.rounded(g,1.55,1.18,.88,.12,this.mat('battery','#253340',{metalness:.07,roughness:.31,bumpMap:this.surface.stone,bumpScale:.003}),0,.62,0);this.rounded(g,1.57,.24,.90,.12,this.mat('batteryTop','#3f5365',{metalness:.18,roughness:.32}),0,1.30,0);this.post(g,'pile:p',-.51,1.52,0);this.post(g,'pile:m',.51,1.52,0);this.print(g,'6 V',.80,.30,0,.68,.52);this.plus=this.print(g,'+',.30,.19,-.5,1.24,.52,{background:'#526c83',color:'#f89479'});this.minus=this.print(g,'−',.30,.19,.5,1.24,.52,{background:'#526c83',color:'#f8f4e6'});}
  makeLamp(){const g=this.group('lampe'),ceramic=this.mat('ceramic','#ebe9de',{roughness:.23,metalness:.04}),silver=this.mat('silver','#c5d1d9',{metalness:.85,roughness:.19});this.rounded(g,1.8,.16,1.1,.22,ceramic,0,.09,0);this.cyl(g,.27,.45,.32,ceramic,0,.32,0);this.cyl(g,.23,.26,.27,silver,0,.57,0);for(let i=0;i<5;i++)this.cyl(g,.26,.26,.027,silver,0,.47+i*.05,0);
    const profile=[[.0,.0],[.17,.0],[.17,.16],[.25,.28],[.39,.43],[.44,.62],[.43,.83],[.34,1.02],[.18,1.14],[.0,1.18]].map(p=>new T.Vector2(...p));
    this.glassMat=new T.MeshPhysicalMaterial({color:'#fcfdff',metalness:0,roughness:.045,transmission:.97,thickness:.035,ior:1.46,transparent:true,opacity:1,side:T.FrontSide,depthWrite:false,clearcoat:1,envMapIntensity:1.2});this.bulb=this.mesh(g,new T.LatheGeometry(new T.SplineCurve(profile).getPoints(56),48),this.glassMat,0,.62,0,false);
    const stem=this.mat('stem','#9cabad',{metalness:.6,roughness:.3});this.tube(g,[[-.08,.65,0],[-.08,1.15,0],[-.16,1.24,0]],.012,stem);this.tube(g,[[.08,.65,0],[.08,1.15,0],[.16,1.24,0]],.012,stem);
    this.filamentMat=new T.MeshStandardMaterial({color:'#7d6954',emissive:'#ffbb43',emissiveIntensity:0,roughness:.5});this.filament=this.tube(g,[[-.16,1.24,0],[-.1,1.39,0],[-.03,1.23,0],[.04,1.40,0],[.11,1.23,0],[.16,1.32,0]],.017,this.filamentMat).mesh;
    this.lampLight=new T.PointLight('#ffcc73',0,5,2);this.lampLight.position.set(0,1.25,.1);g.add(this.lampLight);
    this.post(g,'lampe:culot2',-.69,.22,0);this.post(g,'lampe:culot',.69,.22,0);this.post(g,'lampe:plot',0,.18,.62);
    this.pins['lampe:verre']={group:g,local:new T.Vector3(-.34,1.46,.17)};
    // This ceramic rest only exposes the bulb contacts; the optional socket is separate.
    this.glow=new T.Mesh(new T.SphereGeometry(.39,20,16),new T.MeshBasicMaterial({color:'#ffe19a',transparent:true,opacity:.06,depthWrite:false}));this.glow.position.set(0,1.26,0);g.add(this.glow);
  }
  makeSwitch(){const g=this.group('interrupteur'),wood=this.mat('wood','#d3b083'),brass=this.mat('brass','#b9a36c',{metalness:.85,roughness:.24});this.rounded(g,1.95,.22,.90,.06,wood,0,.12,0);this.post(g,'interrupteur:a',-.72,.30,.12);this.post(g,'interrupteur:b',.72,.30,.12);this.box(g,.20,.23,.25,brass,-.57,.35,.0);this.box(g,.20,.23,.25,brass,.58,.35,.0);this.lever=new T.Group();this.lever.position.set(-.58,.46,0);g.add(this.lever);this.box(this.lever,1.19,.065,.15,brass,.58,0,0);this.rounded(this.lever,.45,.17,.34,.04,this.mat('handle','#26353f',{roughness:.45}),1.07,.04,0);this.lever.userData.hit={type:'switch',id:'interrupteur'};}
  makeSocket(){const g=this.group('douille'),ceramic=this.mat('ceramic','#eeeadd');this.rounded(g,1.7,.14,.95,.22,ceramic,0,.08,0);this.cyl(g,.40,.55,.3,ceramic,0,.27,0);this.cyl(g,.31,.31,.055,this.mat('socketHole','#39444c'),0,.445,0);this.post(g,'douille:a',-.66,.21,.16);this.post(g,'douille:b',.66,.21,.16);}
  mount(board){if(this.canvas.parentElement!==board)board.prepend(this.canvas);this.board=board;this.resize(board.clientWidth,board.clientHeight);}
  resize(w,h){if(w===this.width&&h===this.height)return;this.width=w;this.height=h;this.renderer.setSize(w,h,false);const portrait=w/h<.95;this.portrait=portrait;this.camera.aspect=w/h;this.camera.fov=portrait?46:40;this.camera.position.set(portrait?0:1.1,portrait?11.5:8.9,portrait?10.5:11.8);this.camera.lookAt(0,portrait?.1:.12,portrait?-.3:-.6);if(w/h<.62){this.camera.position.multiplyScalar(.7/(w/h));this.camera.lookAt(0,0,-.2);}this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.invalidate();}
  worldFor(p){return new T.Vector3((p.x-.5)*(this.portrait?4.4:9),0,(p.y-.5)*(this.portrait?7:4.6)+.15);}
  positionFor(world){return {x:T.MathUtils.clamp(world.x/(this.portrait?4.4:9)+.5,0,1),y:T.MathUtils.clamp((world.z-.15)/(this.portrait?7:4.6)+.5,0,1)};}
  project(v){const p=v.clone().project(this.camera);return {x:(p.x*.5+.5)*this.width,y:(-.5*p.y+.5)*this.height,visible:p.z>=-1&&p.z<=1};}
  terminal(t){const pin=this.pins[t];return this.project(pin.group.localToWorld(pin.local.clone()));}
  body(id){return this.project(this.objects[id].localToWorld(new T.Vector3(0,id==='pile'?.7:id==='lampe'?.85:.25,.0)));}
  label(id){return this.project(this.objects[id].localToWorld(new T.Vector3(0,.02,id==='lampe'?1.02:.77)));}
  leverPoint(){return this.project(this.lever.localToWorld(new T.Vector3(.82,.06,.0)));}
  onTable(x,y){this.ray.setFromCamera(new T.Vector2(x/this.width*2-1,1-y/this.height*2),this.camera);return this.ray.ray.intersectPlane(this.tablePlane,new T.Vector3());}
  pick(x,y){this.ray.setFromCamera(new T.Vector2(x/this.width*2-1,1-y/this.height*2),this.camera);const hits=this.ray.intersectObjects([...Object.values(this.objects).filter(g=>g.visible),this.wires],true);for(const h of hits){let node=h.object;while(node&&!node.userData.hit)node=node.parent;if(node?.userData.hit)return node.userData.hit;}return null;}
  clearWires(){this.wires.traverse(o=>{if(o.geometry)o.geometry.dispose();});this.wires.clear();this.curves={};}
  setState(s,ui){const key=JSON.stringify([s,ui.selected,ui.selectedWire,ui.pending,ui.previewPoint,this.portrait]);if(key===this.stateKey)return;this.stateKey=key;this.state=s;const r=window.HidayaCircuit.solve(s);this.updateBlackboard(r,s);
    for(const [id,g]of Object.entries(this.objects)){g.visible=s.devices[id];g.position.copy(this.worldFor(s.positions[id]));}
    this.lever.rotation.z=s.switchClosed?0:.62;this.filament.visible=s.filamentIntact;this.filamentMat.emissiveIntensity=r.lit?5:0;this.glassMat.color.set(r.lit?'#fff6df':'#fcfdff');this.glow.visible=r.lit;this.lampLight.intensity=r.lit?5*r.brightness:0;
    if(this.lastPolarity!==s.polarity){if(this.lastPolarity!==undefined){const mat=this.plus.material;this.plus.material=this.minus.material;this.minus.material=mat;}else if(s.polarity===-1){const mat=this.plus.material;this.plus.material=this.minus.material;this.minus.material=mat;}this.lastPolarity=s.polarity;}
    this.halo.visible=!!ui.selected&&s.devices[ui.selected];if(this.halo.visible){this.halo.position.copy(this.objects[ui.selected].position);this.halo.position.y=.058;}
    this.scene.updateMatrixWorld(true);this.clearWires();
    const colors=['#9c2722','#202a30','#245e91','#8f692c'];
    s.wires.forEach((w,i)=>{const a=this.pins[w.a].group.localToWorld(this.pins[w.a].local.clone()),b=this.pins[w.b].group.localToWorld(this.pins[w.b].local.clone());const dirs={'pile:p':[-1,0,0],'pile:m':[1,0,0],'lampe:culot': [1,0,0],'lampe:culot2':[-1,0,0],'lampe:plot':[0,0,1],'lampe:verre':[-1,0,0],'interrupteur:a':[-1,0,0],'interrupteur:b':[1,0,0],'douille:a':[-1,0,0],'douille:b':[1,0,0]};const da=new T.Vector3(...dirs[w.a]),db=new T.Vector3(...dirs[w.b]),outA=a.clone().addScaledVector(da,.38),outB=b.clone().addScaledVector(db,.38),groundA=a.clone().addScaledVector(da,.85),groundB=b.clone().addScaledVector(db,.85);groundA.y=groundB.y=.07+(i%3)*.026;const center=groundA.clone().lerp(groundB,.5);center.z+=.27;const rawCurve=new T.CatmullRomCurve3([a,outA,groundA,center,groundB,outB,b]);const curve=new T.Curve();curve.getPoint=(t,target=new T.Vector3())=>{rawCurve.getPoint(t,target);target.y=Math.max(.055,target.y);return target;};this.curves[w.id]=curve;const color=colors[(Number(w.id.slice(1))-1)%4],mat=this.mat('wire-'+color,color,{roughness:.34});
      if(w.id===ui.selectedWire){const haloMat=this.mat('wireSelect','#6ba6ec',{transparent:true,opacity:.42,depthWrite:false});this.mesh(this.wires,new T.TubeGeometry(curve,48,.06,8,false),haloMat).userData.hit={type:'wire',id:w.id};}
      if(w.intact){this.mesh(this.wires,new T.TubeGeometry(curve,64,.032,10,false),mat).userData.hit={type:'wire',id:w.id};}else{for(let j=0;j<16;j++){const a=j/16,b=(j+.57)/16;const part=new T.CatmullRomCurve3([curve.getPoint(a),curve.getPoint((a+b)/2),curve.getPoint(b)]);this.mesh(this.wires,new T.TubeGeometry(part,4,.026,6,false),mat).userData.hit={type:'wire',id:w.id};}}
    });
    if(ui.pending){const a=this.pins[ui.pending].group.localToWorld(this.pins[ui.pending].local.clone());let b;if(ui.previewPoint?.target)b=this.pins[ui.previewPoint.target].group.localToWorld(this.pins[ui.previewPoint.target].local.clone());else if(ui.previewPoint)b=this.onTable(ui.previewPoint.x,ui.previewPoint.y);else b=a.clone().add(new T.Vector3(0,.12,.65));if(b)this.tube(this.wires,[a,a.clone().lerp(b,.5).add(new T.Vector3(0,.35,0)),b],.026,this.mat('preview','#508fce',{transparent:true,opacity:.8}));}
    this.scene.updateMatrixWorld(true);this.invalidate();
  }
  wirePoint(id,t=.30+(Number(id.slice(1))%3)*.19){const curve=this.curves[id];return curve?this.project(curve.getPoint(t)):null;}
  invalidate(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.renderer.render(this.scene,this.camera);});}
  stats(){return {boardReadings:this.boardReadings,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,framePending:!!this.frame,viewport:{width:this.width,height:this.height},revision:T.REVISION};}
};
