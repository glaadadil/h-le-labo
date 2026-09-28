/* M12 — source: catalogue M12 + règles R02/R06/R13–R16, profils NaCl_20C
 * et CONCENTRATION_FINALE. SI dans les états quantitatifs. Les progrès sans
 * unité sont des étapes illustratives, jamais des secondes ou des volumes.
 * Pas de dépendance, DOM limité aux étiquettes du rendu, états JSON purs. */
const EPS=1e-12;
const bounded=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
const choice=(v,values,fallback)=>values.includes(v)?v:fallback;
const copy=s=>JSON.parse(JSON.stringify(s));
const fmt=(n,d=2)=>Number(n.toFixed(d)).toLocaleString('fr-FR');
const grams=n=>`${fmt(n*1000)} g`;
const btn=(id,label,disabled=false)=>({id,type:'button',label,disabled});
const check=(id,label,value)=>({id,type:'checkbox',label,value});
const range=(id,label,value,min,max,step,unit)=>({id,type:'range',label,value,min,max,step,unit});
const select=(id,label,value,options)=>({id,type:'select',label,value,options:options.map(([value,label])=>({value,label}))});
const metric=(label,value)=>({label,value});
const obs=(title,lines,metrics=[],warning='')=>({title,lines,metrics,warning,board:[title,...metrics.slice(0,3).map(m=>`${m.label} : ${m.value}`)]});
const resetControl=()=>btn('reset','Recommencer');
const visualLimit='Niveaux intermédiaires et grains schématiques, sans graduation de volume. Aucune durée réelle simulée.';

export function saltEquilibrium(waterKg,saltKg){
  const water=bounded(waterKg,0,1),salt=bounded(saltKg,0,1),capacity=.358*water;
  const dissolved=Math.min(salt,capacity),deposit=Math.max(0,salt-dissolved);
  return {capacity,dissolved,deposit,saturated:water>0&&salt+EPS>=capacity};
}
export function concentration(massKg,volumeM3){return Number.isFinite(massKg)&&massKg>=0&&Number.isFinite(volumeM3)&&volumeM3>0?massKg/volumeM3:null;}
export function massOnPlate(s){
  return .1+s.water+s.saltBeaker+(s.dishOn ? .02+s.saltDish : 0)+(s.rodOn ? .01 : 0);
}
export function gasInventory(s){return s.remaining+s.collected+s.escaped+s.tested;}
export function preparationInventory(s){return s.beakerSalt+s.flaskSalt+s.lostSalt;}

// Shared material construction; apparatus geometry is reused only when appropriate.
function kitMaterials(kit){
  const {T,scene}=kit;
  return {
    glass:new T.MeshPhysicalMaterial({color:'#d5ebee',transparent:true,opacity:.19,roughness:.09,side:T.DoubleSide,depthWrite:false}),
    water:new T.MeshStandardMaterial({color:'#8bb9c8',transparent:true,opacity:.47,roughness:.23,depthWrite:false}),
    edge:scene.mat('dissolution-edge','#92b0b5',{metalness:.3,roughness:.23}),
    salt:scene.mat('dissolution-salt','#f5f0dc',{roughness:.82}),
    sand:scene.mat('dissolution-sand','#b99a66',{roughness:.95}),
    oil:scene.mat('dissolution-oil','#d4b357',{transparent:true,opacity:.65}),
    white:scene.mat('dissolution-ceramic','#e5e6dd',{roughness:.38}),
    dark:scene.mat('dissolution-dark','#394c55',{roughness:.45}),
    metal:scene.mat('dissolution-metal','#8e9d9e',{metalness:.68,roughness:.3}),
    blue:scene.mat('dissolution-blue','#4b85b8',{roughness:.35}),
    bag:new T.MeshPhysicalMaterial({color:'#e3f4fa',transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false,roughness:.2}),
    ice:new T.MeshPhysicalMaterial({color:'#65a9c1',transparent:true,opacity:.8,roughness:.15}),
  };
}
function group(kit,x=0,y=.05,z=0){const g=new kit.T.Group();g.position.set(x,y,z);kit.root.add(g);return g;}
function action(mesh,id,value){mesh.userData.workshopAction={id,value};return mesh;}
function label(kit,parent,text,w,h,x,y,z){return kit.scene.print(parent,text,w,h,x,y,z,{background:'#e5e5d7',color:'#233d46'});}
function displayText(mesh,text){
  if(mesh.userData.lastText===text)return;
  mesh.userData.lastText=text;const canvas=mesh.material.map?.image;
  if(!canvas?.getContext)return;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#dce4d0';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#203c38';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${text.length>21?38:58}px sans-serif`;ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width-20);mesh.material.map.needsUpdate=true;
}
function vessel(kit,m,x,z=0,{radius=.62,height=1.65,title='Bécher',parent=null,y=.05}={}){
  const {T,scene}=kit,g=new T.Group();g.position.set(x,y,z);(parent||kit.root).add(g);
  const profile=[[0,0],[radius,0],[radius,.05],[radius,height],[radius-.035,height],[radius-.035,.065],[0,.065]].map(p=>new T.Vector2(...p));
  const shell=scene.mesh(g,new T.LatheGeometry(profile,40),m.glass);
  const rim=scene.mesh(g,new T.TorusGeometry(radius-.015,.018,8,40),m.edge,0,height,0);rim.rotation.x=Math.PI/2;
  const liquid=scene.cyl(g,radius-.055,radius-.055,1,m.water.clone(),0,.6,0,40);liquid.castShadow=false;
  const deposit=scene.cyl(g,radius*.69,radius*.78,.08,m.salt,0,.105,0,24);
  const grains=[];for(let i=0;i<18;i++){const a=i*2.399,r=radius*.66*Math.sqrt((i+.5)/18);const mesh=scene.box(g,.10,.09,.095,m.salt,Math.sin(a)*r,.12+(i%3)*.03,Math.cos(a)*r);mesh.rotation.y=a;grains.push(mesh);}
  const rod=scene.cyl(g,.035,.035,height*.95,m.edge,radius*.58,height*.67,0,12);rod.rotation.z=-.2;
  const tag=label(kit,g,title,radius*2.5,.26,0,.32,radius+.025);
  return {g,shell,rim,liquid,deposit,grains,rod,tag,radius,height};
}
function fill(v,f,color='#8bb9c8'){
  const h=Math.max(.001,(v.height-.16)*bounded(f,0,.92));v.liquid.visible=f>0;v.liquid.scale.y=h;v.liquid.position.y=.075+h/2;v.liquid.material.color.set(color);
}
function residue(v,f,mat=null){v.deposit.visible=f>EPS;v.deposit.scale.y=Math.max(.04,Math.min(3,f*3));for(let i=0;i<v.grains.length;i++){v.grains[i].visible=i<Math.ceil(bounded(f,0,1)*v.grains.length);if(mat)v.grains[i].material=mat;}if(mat)v.deposit.material=mat;}
function stock(kit,m,x,z,title,id){
 const {scene}=kit,g=group(kit,x,.05,z);const body=action(scene.cyl(g,.32,.36,.8,m.white,0,.4,0),id);scene.cyl(g,.34,.34,.075,m.dark,0,.84,0);label(kit,g,title,.85,.25,0,.43,.36);return {g,body};
}
function balance(kit,m,x,z){
 const {scene}=kit,g=group(kit,x,.05,z);scene.rounded(g,2.7,.24,1.6,.12,m.white,0,.12,0);scene.cyl(g,1.1,1.1,.07,m.metal,0,.30,-.15);const screen=label(kit,g,'0 g',1.25,.3,0,.22,.82);action(screen,'tare');return {g,screen};
}
function buttonObject(kit,m,x,z,title,id,color=m.blue){const g=group(kit,x,.05,z);g.userData.naturalObsolete=true;const b=action(kit.scene.box(g,.85,.13,.6,color,0,.065,0),id);label(kit,g,title,.9,.2,0,.2,.31);return b;}
function baseView(kit){return {m:kitMaterials(kit)};}

const substances=[['salt','Sel'],['sugar','Sucre'],['sand','Sable'],['dye','Colorant'],['ethanol','Éthanol virtuel'],['oil','Huile']];
const a1={
 id:'M12-A01',
 initial:()=>({substance:'salt',added:false,stage:'before',stirs:0}),
 controls:s=>[select('substance','Nouvel échantillon : matière',s.substance,substances),btn('add','Ajouter la petite dose préparée',s.added),btn('stir','Agiter',!s.added),btn('rest','Observer après repos',!s.added),resetControl()],
 act(s,id,value){const n=copy(s);if(id==='reset')return this.initial();if(id==='substance')return {...this.initial(),substance:choice(value,substances.map(x=>x[0]),s.substance)};if(id==='add'&&!n.added){n.added=true;n.stage='added';}if(id==='stir'&&n.added){n.stage='stirred';n.stirs=Math.min(20,n.stirs+1);}if(id==='rest'&&n.added)n.stage='rested';return n;},
 observe(s){
  const name=substances.find(x=>x[0]===s.substance)[1];let observation='La dose et l’eau sont encore séparées.';
  if(s.added){
   if(s.substance==='sand')observation=s.stage==='stirred'?'Des grains de sable sont dispersés ; ils restent visibles.':'Le sable reste visible au fond après repos.';
   else if(s.substance==='oil')observation=s.stage==='stirred'?'Des gouttes d’huile sont dispersées : émulsion temporaire.':'L’huile forme une phase au-dessus de l’eau.';
   else observation=s.stage==='added'?'La matière vient d’être ajoutée ; observer après mélange.':s.substance==='dye'?'L’eau prend une couleur uniforme ; le colorant reste présent.':s.substance==='ethanol'?'Une seule phase liquide apparaît après mélange.':'Les cristaux ne sont plus visibles ; le soluté reste dans la solution.';
  }
  return obs('Tester ce qui se dissout',[observation,'Une solution contient encore le soluté. La disparition visuelle n’est pas une destruction.', 'Petites doses préparées sous le seuil pour sel et sucre ; autres comportements qualitatifs. Solvant : eau.',visualLimit],[metric('Matière',name),metric('État',s.stage==='before'?'Séparés':s.stage==='added'?'Ajout récent':s.stage==='stirred'?'Agité':'Au repos')]);
 },
 build(kit){const v=baseView(kit);v.cup=vessel(kit,v.m,0,0,{title:'Eau + matière'});action(v.cup.rod,'stir');v.stock=stock(kit,v.m,-1.8,.1,'Dose','add');v.rest=buttonObject(kit,v.m,1.8,.2,'Repos','rest');v.drops=[];for(let i=0;i<14;i++)v.drops.push(kit.scene.mesh(v.cup.g,new kit.T.SphereGeometry(.065,10,8),v.m.oil,Math.sin(i*2.4)*.35,.3+(i%5)*.18,Math.cos(i*2.4)*.35));v.layer=kit.scene.cyl(v.cup.g,.56,.56,.15,v.m.oil,0,1.13,0);return v;},
 update(v,s){const mixed=s.added&&s.stage!=='added',insoluble=s.substance==='sand';fill(v.cup,.65,s.substance==='dye'&&mixed?'#6a80c2':'#8bb9c8');residue(v.cup,s.added&&(insoluble||(!mixed&&['salt','sugar','dye'].includes(s.substance)))?.65:0,insoluble?v.m.sand:v.m.salt);v.stock.body.scale.y=s.added?.5:1;v.cup.rod.rotation.z=s.stage==='stirred'?.35:-.2;v.layer.visible=s.added&&s.substance==='oil'&&s.stage!=='stirred';v.drops.forEach((d,i)=>{d.visible=s.added&&s.substance==='oil'&&s.stage==='stirred';v.cup.grains[i]&&(v.cup.grains[i].position.y=insoluble&&s.stage==='stirred'?.25+(i%5)*.16:.12+(i%3)*.03);});}
};
const a2={
 id:'M12-A02',
 initial:()=>({water:.1,salt:0,dissolved:0,evaporated:0,doseG:5,steps:0}),
 controls:s=>[range('dose','Dose de NaCl',s.doseG,0,50,.1,'g'),btn('add','Ajouter cette dose',s.salt>=.15-EPS),btn('threshold','Préparer le seuil exact : 35,8 g / 100 g d’eau'),btn('step','Observer une étape illustrative'),btn('stir','Agiter une étape illustrative'),btn('equilibrium','Observer à l’équilibre'),btn('water','Ajouter 50 g d’eau',s.water>=.3-EPS),btn('evaporate','Faire sortir 25 g d’eau par évaporation',s.water<=0),resetControl()],
 act(s,id,value){let n=copy(s);if(id==='reset')return this.initial();if(id==='dose')n.doseG=bounded(value,0,50,s.doseG);if(id==='threshold')return {...this.initial(),salt:.0358};if(id==='add')n.salt=Math.min(.15,n.salt+n.doseG/1000);if(id==='water')n.water=Math.min(.3,n.water+.05);if(id==='evaporate'){const out=Math.min(n.water,.025);n.water=n.water-out<EPS?0:n.water-out;n.evaporated+=out;}
  const eq=saltEquilibrium(n.water,n.salt);n.dissolved=Math.min(n.dissolved,eq.dissolved);
  if(id==='step'||id==='stir'){n.dissolved+=Math.min(eq.dissolved-n.dissolved,id==='stir'?.008:.002);n.steps++;}if(id==='equilibrium')n.dissolved=eq.dissolved;return n;},
 observe(s){const eq=saltEquilibrium(s.water,s.salt),at=Math.abs(eq.dissolved-s.dissolved)<EPS;const status=s.water<=EPS?'Sans eau : solide seul':!at?'Équilibre non atteint':eq.saturated?(eq.deposit>EPS?'Solution saturée + dépôt':'Solution saturée, sans dépôt'):'Solution non saturée';return obs('Dissolution du NaCl à 20 °C',[status,at?'L’équilibre dépend de la masse d’eau et de la quantité de sel.':'Des grains visibles maintenant ne prouvent pas la saturation.', 'Agiter accélère les étapes illustratives, sans changer la capacité. Profil : 35,8 g de NaCl par 100 g d’eau à 20 °C.',visualLimit],[metric('Eau restante',grams(s.water)),metric('Sel dissous',grams(s.dissolved)),metric('Sel non dissous',grams(s.salt-s.dissolved)),metric('Eau sortie',grams(s.evaporated)),metric('Capacité à 20 °C',grams(eq.capacity))],s.water<=EPS?'Sans solvant, aucune solution saturée de volume nul.':'');},
 build(kit){const v=baseView(kit);v.cup=vessel(kit,v.m,0,0,{title:'NaCl · 20 °C'});action(v.cup.rod,'stir');v.salt=stock(kit,v.m,-2.0,0,'NaCl','add');v.water=stock(kit,v.m,2.0,0,'+ 50 g eau','water');v.loss=vessel(kit,v.m,2.9,1.5,{radius:.32,height:.72,title:'Eau sortie'});v.loss.rod.visible=false;label(kit,kit.root,'Bilan, pas condensateur',1.6,.18,2.8,.08,2);buttonObject(kit,v.m,-1.8,1.6,'Équilibre','equilibrium');v.screen=label(kit,kit.root,'',2.4,.35,0,.3,1.05);return v;},
 update(v,s){fill(v.cup,s.water/.4);residue(v.cup,(s.salt-s.dissolved)/.05);fill(v.loss,Math.min(.85,s.evaporated/.3));residue(v.loss,0);v.cup.rod.rotation.z=s.steps%2?.32:-.2;displayText(v.screen,`${fmt(s.dissolved*1000)} g dissous`);}
};
const a3={
 id:'M12-A03',
 initial:()=>({connected:false,prepared:false,submerged:false,warm:false,remaining:8,collected:0,escaped:0,tested:0,cloudy:false,last:'Montage à préparer.'}),
 controls:s=>[check('connected','Relier le tuyau de dégagement',s.connected),btn('prepare','Remplir d’eau et retourner le collecteur'),check('submerged','Immerger l’ouverture du collecteur',s.submerged),check('warm','Bain tiède virtuel',s.warm),btn('release','Observer une étape de dégazage',s.remaining===0),btn('test','Faire passer le gaz recueilli dans l’eau de chaux',s.collected===0),resetControl()],
 act(s,id,value){const n=copy(s);if(id==='reset')return this.initial();if(['connected','submerged','warm'].includes(id))n[id]=value===true;if(id==='prepare'){n.escaped+=n.collected;n.collected=0;n.prepared=true;n.last='Collecteur rempli d’eau, retourné : placer son ouverture sous l’eau.';}if(id==='submerged'&&!n.submerged&&s.submerged){n.escaped+=n.collected;n.collected=0;n.prepared=false;n.last='Le collecteur relevé perd son eau et le gaz recueilli. Il faut le préparer à nouveau.';}if(id==='release'&&n.remaining){const q=Math.min(n.remaining,n.warm?2:1);n.remaining-=q;if(n.connected&&n.prepared&&n.submerged){n.collected+=q;n.last='Les bulles déplacent l’eau dans le collecteur.';}else{n.escaped+=q;n.last='Le gaz s’échappe ; collection impossible avec ce montage.';}}if(id==='test'&&n.collected){n.tested+=n.collected;n.collected=0;n.cloudy=true;n.last='Le gaz recueilli traverse l’eau de chaux, qui se trouble.';}return n;},
 observe(s){return obs('Recueillir un gaz dissous',[s.last,s.cloudy?'Dans ce cas préparé, le test indique le dioxyde de carbone de la boisson.':'Les bulles seules ne suffisent pas à identifier un gaz.', 'Le gaz provient de la boisson. Le bain tiède ne le crée pas ; la sortie reste toujours libre.', 'Recueil et bilan qualitatifs : fractions représentatives conservées, sans litres ni durée de dégazage. Le trouble n’est pas un test universel sans interférences.'],[metric('Tuyau',s.connected?'Relié':'Débranché'),metric('Collecteur',s.prepared&&s.submerged?'Prêt':'À préparer'),metric('Gaz recueilli',s.collected?'Présent':'Absent'),metric('Eau de chaux',s.cloudy?'Trouble':'Limpide')],s.remaining===0?'La réserve représentée de gaz dissous est épuisée. Recommencer pour une nouvelle boisson.':'');},
 build(kit){const v=baseView(kit),{scene,T}=kit;v.bath=vessel(kit,v.m,-2.1,0,{radius:.85,height:.55,title:'Bain virtuel'});v.bath.rod.visible=false;v.bottle=vessel(kit,v.m,-2.1,0,{radius:.4,height:1.7,title:'Eau gazeuse',y:.12});v.bottle.rod.visible=false;action(v.bottle.shell,'release');scene.cyl(v.bottle.g,.39,.39,.12,v.m.dark,0,1.72,0);v.basin=vessel(kit,v.m,.3,0,{radius:1,height:.65,title:'Cuve d’eau'});v.basin.rod.visible=false;v.collector=vessel(kit,v.m,.3,0,{radius:.29,height:1.5,title:'Collecteur',y:.38});v.collector.rod.visible=false;v.collector.g.rotation.z=Math.PI;v.collector.g.position.y=2.03;v.collector.tag.visible=false;action(v.collector.shell,'prepare');v.tube=scene.tube(kit.root,[[-2.1,1.91,0],[-1.7,2.4,0],[-.8,2.4,0],[-.2,.4,0],[.3,.41,0]],.055,v.m.edge).mesh;action(v.tube,'connected',true);v.free=scene.tube(kit.root,[[-2.1,1.91,0],[-1.7,2.4,0],[-1,1,.8]],.055,v.m.edge).mesh;action(v.free,'connected',true);v.lime=vessel(kit,v.m,2.3,0,{radius:.4,height:1.2,title:'Eau de chaux'});v.lime.rod.visible=false;action(v.lime.shell,'test');v.bubbles=[];for(let i=0;i<8;i++)v.bubbles.push(scene.mesh(kit.root,new T.SphereGeometry(.055,12,8),v.m.glass,-2.1+.15*Math.sin(i),.6+i*.14,0));v.cloud=scene.cyl(v.lime.g,.34,.34,.65,v.m.white,0,.40,0);return v;},
 update(v,s){fill(v.bath,.65,s.warm?'#d4ab8e':'#8bb9c8');fill(v.bottle,.66);fill(v.basin,.7);fill(v.lime,.6);[v.bath,v.bottle,v.basin,v.lime].forEach(c=>residue(c,0));v.tube.visible=s.connected;v.free.visible=!s.connected;v.collector.g.position.y=s.submerged?1.88:2.5;fill(v.collector,s.prepared?Math.max(0,.90-s.collected/8*.85):0);v.collector.liquid.position.y=v.collector.height-.055-v.collector.liquid.scale.y/2;residue(v.collector,0);v.cloud.visible=s.cloudy;v.bubbles.forEach((b,i)=>b.visible=i<s.remaining&&s.remaining<8);}
};
const a4={
 id:'M12-A04',
 initial:()=>({water:0,saltDish:0,saltBeaker:0,dissolved:0,lostWater:0,lostSalt:0,loaded:false,dishOn:true,rodOn:true,tare:0,before:null}),
 controls:s=>[btn('tare','Tarer le plateau actuel'),btn('load','Déposer 100 g d’eau et 10 g de sel',s.loaded),btn('before','Mémoriser la pesée avant mélange',!s.loaded),btn('pour','Verser le sel de la soucoupe',!s.loaded||s.saltDish===0),btn('stir','Dissoudre avec l’agitateur',s.saltBeaker===0||!s.rodOn),check('dishOn','Soucoupe sur le plateau',s.dishOn),check('rodOn','Agitateur sur le plateau',s.rodOn),btn('spill','Renverser 5 % de la solution hors plateau',s.dissolved<=0),resetControl()],
 act(s,id,value){const n=copy(s);if(id==='reset')return this.initial();if(id==='tare')n.tare=massOnPlate(n);if(id==='load'&&!n.loaded){n.water=.1;n.saltDish=.01;n.loaded=true;}if(id==='before'&&n.loaded)n.before={gross:massOnPlate(n),reading:massOnPlate(n)-n.tare,tare:n.tare,dishOn:n.dishOn,rodOn:n.rodOn};if(id==='pour'&&n.loaded){n.saltBeaker+=n.saltDish;n.saltDish=0;}if(id==='stir'&&n.rodOn)n.dissolved=saltEquilibrium(n.water,n.saltBeaker).dissolved;if(['dishOn','rodOn'].includes(id))n[id]=value===true;if(id==='spill'&&n.dissolved>0){const w=n.water*.05,ss=n.dissolved*.05;n.water-=w;n.saltBeaker-=ss;n.dissolved-=ss;n.lostWater+=w;n.lostSalt+=ss;}return n;},
 observe(s){const gross=massOnPlate(s),read=gross-s.tare,changed=s.before&&(s.before.dishOn!==s.dishOn||s.before.rodOn!==s.rodOn||Math.abs(s.before.tare-s.tare)>EPS);return obs('Conserver une même pesée',[s.before?`Avant : ${grams(s.before.reading)}. Maintenant : ${grams(read)}.`:'Tarer les accessoires, déposer eau et sel, puis mémoriser la pesée.', 'Scénario construit : bécher 100 g, soucoupe 20 g, agitateur 10 g. Balance idéale, affichage au 0,1 g.', 'La tare soustrait une référence ; elle ne retire aucune matière. La matière hors plateau reste comptée dans le bilan.',visualLimit],[metric('Balance',`${fmt(read*1000,1)} g`),metric('Masse sur plateau',grams(gross)),metric('Matière sortie',grams(s.lostWater+s.lostSalt)),metric('Sel total suivi',grams(s.saltDish+s.saltBeaker+s.lostSalt))],changed?'Accessoires ou tare différents : ces deux affichages ne prouvent pas à eux seuls une perte de matière.':s.lostWater+s.lostSalt>0?'La solution renversée a quitté le plateau. Sa masse est conservée dans le bilan extérieur.':'');},
 build(kit){const v=baseView(kit);v.scale=balance(kit,v.m,0,0);v.cup=vessel(kit,v.m,-.25,-.18,{radius:.48,height:1.4,title:'Eau + sel',y:.42});action(v.cup.rod,'stir');v.dish=group(kit,.67,.40,.05);kit.scene.cyl(v.dish,.30,.33,.07,v.m.white,0,.035,0);v.powder=action(kit.scene.cyl(v.dish,.22,.24,.12,v.m.salt,0,.10,0),'pour');v.catch=vessel(kit,v.m,2.3,.35,{radius:.5,height:.55,title:'Hors plateau'});v.catch.rod.visible=false;v.extraRod=kit.scene.cyl(kit.root,.035,.035,1.3,v.m.edge,-2,.14,.3);v.extraRod.rotation.z=Math.PI/2;buttonObject(kit,v.m,-2,1.4,'Charger','load');return v;},
 update(v,s){fill(v.cup,s.water/.15);residue(v.cup,(s.saltBeaker-s.dissolved)/.015);v.powder.visible=s.saltDish>0;v.dish.position.set(s.dishOn?.67:1.8,s.dishOn?.40:.05,s.dishOn?.05:-1.0);v.cup.rod.visible=s.rodOn;v.extraRod.visible=!s.rodOn;fill(v.catch,Math.min(.85,(s.lostWater+s.lostSalt)/.04));residue(v.catch,0);displayText(v.scale.screen,`${fmt((massOnPlate(s)-s.tare)*1000,1)} g`);}
};
const a5={
 id:'M12-A05',
 initial:()=>({warm:true,iceFree:0,iceBag:0,sugarFree:0,sugarBag:0,iceOpen:false,sugarOpen:false}),
 controls:s=>[check('warm','Bain tiède (sinon équilibre glace/eau à 0 °C)',s.warm),btn('heat','Observer un échange thermique'),btn('stir','Agiter l’eau des béchers'),btn('openSugar','Ouvrir le sachet de sucre',s.sugarOpen),btn('openIce','Ouvrir le sachet de glace',s.iceOpen),resetControl()],
 act(s,id,value){const n=copy(s);if(id==='reset')return this.initial();if(id==='warm')n.warm=value===true;if(id==='heat'&&n.warm){n.iceFree=Math.min(1,n.iceFree+.5);n.iceBag=Math.min(1,n.iceBag+.5);}if(id==='stir'){n.sugarFree=Math.min(1,n.sugarFree+.5);if(n.sugarOpen)n.sugarBag=Math.min(1,n.sugarBag+.5);}if(id==='openSugar')n.sugarOpen=true;if(id==='openIce')n.iceOpen=true;return n;},
 observe(s){return obs('Fondre ou se dissoudre ?',[`Glace libre : ${s.iceFree===1?'fondue':s.iceFree?'fusion partielle':'solide'}. Glace en sachet : ${s.iceBag===1?'fondue':s.iceBag?'fusion partielle':'solide'}.`,`Sucre libre : ${s.sugarFree===1?'dissous':'encore visible'}. Sucre en sachet : ${s.sugarBag===1?'dissous':s.sugarOpen?'au contact de l’eau':'sec, séparé de l’eau'}.`,'Le sachet étanche laisse passer de l’énergie, mais pas l’eau ni le sucre. Le glaçon fond sans contact direct avec le bain.','Cas préparés qualitatifs : petites doses de sucre solubles ; pas de vitesse ni de bilan thermique chiffrés. Des étapes égales ne signifient pas des durées égales.','Les glaçons colorés contiennent un colorant : leur eau finale n’est pas de l’eau pure.'],[metric('Contact sucre en sachet',s.sugarOpen?'Ouvert':'Fermé'),metric('Bain',s.warm?'Tiède':'Équilibre à 0 °C')]);},
 build(kit){const v=baseView(kit);v.cups=[];v.solids=[];v.bags=[];v.inside=[];const names=['Glace libre','Glace en sachet','Sucre libre','Sucre en sachet'];for(let i=0;i<4;i++){const c=vessel(kit,v.m,-2.7+i*1.8,0,{radius:.56,height:1.6,title:names[i]});c.rod.visible=false;v.cups.push(c);v.solids.push(kit.scene.box(c.g,.37,.38,.37,i<2?v.m.ice:v.m.salt,0,i<2?1.02:.3,0));if(i%2){const bag=kit.scene.box(c.g,.64,.95,.38,v.m.bag,0,.8,0);action(bag,i===1?'openIce':'openSugar');v.bags[i]=bag;v.inside[i]=kit.scene.box(c.g,.54,.4,.29,v.m.water.clone(),0,.6,0);const seam=kit.scene.box(c.g,.62,.05,.4,v.m.blue,0,1.29,0);v.bags[i].userData.seam=seam;}}buttonObject(kit,v.m,-1,1.4,'Échange','heat');buttonObject(kit,v.m,1,1.4,'Agiter','stir');return v;},
 update(v,s){const p=[s.iceFree,s.iceBag,s.sugarFree,s.sugarBag];v.cups.forEach((c,i)=>{const tint=i===0&&s.iceFree>0||i===1&&s.iceOpen&&s.iceBag>0;fill(c,.64,tint?'#598fae':'#8bb9c8');residue(c,0);v.solids[i].visible=p[i]<1;v.solids[i].scale.setScalar(Math.cbrt(Math.max(.001,1-p[i])));if(i%2){const open=i===1?s.iceOpen:s.sugarOpen;v.bags[i].visible=!open;v.bags[i].userData.seam.visible=!open;v.inside[i].visible=i===1&&!open&&s.iceBag>0;if(i===1){v.inside[i].scale.y=Math.max(.01,s.iceBag);v.inside[i].material.color.set('#598fae');}}});}
};
const a6={
 id:'M12-A06',
 initial:()=>({target:100,volume:.0001,mass:.01,stage:'weigh',beakerSalt:0,flaskSalt:0,lostSalt:0,finalVolume:null,mixed:false,wrongWater:false,previous:null}),
 controls:s=>[select('target','Concentration cible',String(s.target),[['25','25 g/L'],['50','50 g/L'],['100','100 g/L']]),select('volume','Fiole / volume final',String(s.volume),[['0.0001','100 mL'],['0.0002','200 mL']]),range('mass','Masse pesée',s.mass*1000,1,20,.5,'g'),btn('dissolve','Dissoudre dans une portion d’eau',s.stage!=='weigh'),btn('wrongWater','Essayer : prendre le volume final d’eau seul',s.stage!=='weigh'),btn('transfer','Transférer dans la fiole',s.stage!=='dissolved'),btn('rinse','Rincer bécher et entonnoir vers la fiole',s.stage!=='transferred'||s.beakerSalt<=EPS),btn('lose','Omettre les dernières gouttes du bécher',s.stage!=='transferred'||s.beakerSalt<=EPS),btn('mark','Compléter la solution jusqu’au trait',s.stage!=='transferred'),btn('overfill','Dépasser le trait de 10 mL (lecture finale)',s.finalVolume===null),btn('mix','Boucher et homogénéiser',s.finalVolume===null),btn('compare','Mémoriser cette préparation et recommencer',!s.mixed),resetControl()].map(c=>['target','volume','mass'].includes(c.id)?{...c,disabled:s.stage!=='weigh'}:c),
 act(s,id,value){const n=copy(s);if(id==='reset')return this.initial();if(['target','volume','mass'].includes(id)&&s.stage==='weigh'&&!s.wrongWater){if(id==='target')n.target=Number(choice(String(value),['25','50','100'],String(s.target)));if(id==='volume')n.volume=Number(choice(String(value),['0.0001','0.0002'],String(s.volume)));if(id==='mass')n.mass=bounded(value,1,20,s.mass*1000)/1000;}
  if(id==='wrongWater'&&n.stage==='weigh'){n.wrongWater=true;n.stage='wrong';n.beakerSalt=n.mass;}
  if(id==='dissolve'&&n.stage==='weigh'){n.beakerSalt=n.mass;n.stage='dissolved';}
  if(id==='transfer'&&n.stage==='dissolved'){n.flaskSalt=n.beakerSalt*.8;n.beakerSalt-=n.flaskSalt;n.stage='transferred';}
  if(id==='rinse'&&n.stage==='transferred'){n.flaskSalt+=n.beakerSalt;n.beakerSalt=0;}
  if(id==='lose'&&n.stage==='transferred'){n.lostSalt+=n.beakerSalt;n.beakerSalt=0;}
  if(id==='mark'&&n.stage==='transferred'){n.finalVolume=n.volume;n.stage='adjusted';n.mixed=false;}
  if(id==='overfill'&&n.finalVolume!==null){n.finalVolume=Math.min(n.volume+.00005,n.finalVolume+.00001);n.mixed=false;}
  if(id==='mix'&&n.finalVolume!==null)n.mixed=true;
  if(id==='compare'&&n.mixed)return {...this.initial(),previous:{mass:n.flaskSalt,volume:n.finalVolume,c:concentration(n.flaskSalt,n.finalVolume)}};
  return n;},
 observe(s){const required=s.target*s.volume,c=s.finalVolume===null?null:concentration(s.flaskSalt,s.finalVolume);const lines=[`Pour ${fmt(s.volume*1e6)} mL de solution à ${s.target} g/L : m = c × V = ${grams(required)}.`,s.finalVolume===null?'Le volume de solution intermédiaire n’est pas déterminé ; aucune concentration finale affichée.':s.mixed?`Solution homogénéisée : ${fmt(c)} g/L.`:'Volume final mesuré : homogénéiser avant de comparer la préparation.', 'Scénario construit : le premier transfert emporte 80 % du sel ; le rinçage récupère le reste. Cette fraction illustre un transfert incomplet, ce n’est pas une constante expérimentale.', 'NaCl à 20 °C, doses 1–20 g. Portion initiale d’eau suffisante (60 g ou 120 g selon la fiole) ; pas d’addition calculée des volumes eau + sel. Bilan du soluté uniquement pendant l’ajustement.', 'Le niveau avant ajustement est schématique. Seul le volume final choisi et mesuré sert au calcul.'];if(s.previous)lines.push(`Préparation mémorisée : ${fmt(s.previous.c)} g/L dans ${fmt(s.previous.volume*1e6)} mL.`);return obs('Préparer une solution jaugée',lines,[metric('Sel dans la fiole',grams(s.flaskSalt)),metric('Sel dans le bécher',grams(s.beakerSalt)),metric('Sel perdu',grams(s.lostSalt)),metric('Volume final',s.finalVolume===null?'Non déterminé':`${fmt(s.finalVolume*1e6)} mL`),metric('Concentration',s.mixed?`${fmt(c)} g/L`:'À établir')],s.wrongWater?'Le volume d’eau seul ne donne pas le volume final de solution. Cette préparation ne valide pas la cible : recommencer avec une portion d’eau.':s.lostSalt>EPS?'Une partie du soluté a été perdue : la concentration obtenue est recalculée.':s.stage==='adjusted'&&s.beakerSalt>EPS?'Du sel reste dans le bécher. Recommencer pour réaliser un transfert quantitatif.':'');},
 build(kit){const v=baseView(kit),{scene,T}=kit;v.scale=balance(kit,v.m,-2.4,-.3);delete v.scale.screen.userData.workshopAction;v.scale.g.scale.setScalar(.65);v.weighed=scene.cyl(v.scale.g,.35,.38,.13,v.m.salt,0,.43,0);action(v.weighed,'dissolve');v.cup=vessel(kit,v.m,-.7,0,{radius:.48,height:1.45,title:'Dissoudre / rincer'});action(v.cup.shell,'transfer');v.flask=group(kit,1.2,.05,0);const shape=[[0,0],[.48,.05],[.64,.35],[.61,.8],[.18,1.3],[.18,2.1],[.15,2.1],[.15,1.31],[.57,.8],[.60,.35],[.44,.10],[0,.08]].map(p=>new T.Vector2(...p));v.shell=action(scene.mesh(v.flask,new T.LatheGeometry(shape,40),v.m.glass),'mark');v.fluid=scene.mesh(v.flask,new T.SphereGeometry(.56,24,16),v.m.water.clone(),0,.61,0);v.fluid.scale.y=.86;v.neck=scene.cyl(v.flask,.14,.14,.6,v.m.water.clone(),0,1.58,0);v.mark=scene.mesh(v.flask,new T.TorusGeometry(.185,.018,8,32),v.m.dark,0,1.76,0);v.mark.rotation.x=Math.PI/2;v.cap=action(scene.cyl(v.flask,.2,.2,.16,v.m.blue,0,2.19,0),'mix');label(kit,v.flask,'Volume final',1.5,.24,0,.58,.65);v.funnel=scene.mesh(v.flask,new T.ConeGeometry(.4,.48,28,1,true),v.m.edge,0,2.38,0);v.funnel.rotation.z=Math.PI;v.spill=scene.cyl(kit.root,.35,.44,.025,v.m.salt,2.7,.07,1);stock(kit,v.m,2.7,-.25,'Rinçage','rinse');v.screen=label(kit,kit.root,'',2.4,.3,1.2,.30,1.0);return v;},
 update(v,s){displayText(v.scale.screen,`${fmt(s.mass*1000)} g`);v.weighed.visible=s.stage==='weigh';fill(v.cup,s.beakerSalt>EPS?.45:0);residue(v.cup,0);const has=s.flaskSalt>0;v.fluid.visible=has;v.fluid.scale.setScalar(s.finalVolume===null?.77:1);v.fluid.scale.y*=.86;v.neck.visible=s.finalVolume!==null;if(s.finalVolume!==null){const h=.46+(s.finalVolume-s.volume)/.00005*.28;v.neck.scale.y=h/.6;v.neck.position.y=1.3+h/2;}v.cap.visible=s.mixed;v.funnel.visible=s.stage==='dissolved'||s.stage==='transferred';v.spill.visible=s.lostSalt>0;v.flask.rotation.z=s.mixed?.07:0;displayText(v.screen,s.finalVolume===null?'Volume non mesuré':`${fmt(s.finalVolume*1e6)} mL de solution`);}
};
export const workshops=[a1,a2,a3,a4,a5,a6];

// Host draft validation: reject malformed state, never repair it invisibly.
const object=s=>s!==null&&typeof s==='object'&&!Array.isArray(s);
const number=(s,k,min,max)=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=min-EPS&&s[k]<=max+EPS;
const bool=(s,...keys)=>keys.every(k=>typeof s[k]==='boolean');
const equal=(a,b)=>Math.abs(a-b)<1e-10;
const validPrevious=p=>p===null||object(p)&&number(p,'mass',0,.02)&&number(p,'volume',.0001,.00025)&&number(p,'c',0,200)&&equal(p.c,concentration(p.mass,p.volume));
a1.valid=s=>object(s)&&substances.some(x=>x[0]===s.substance)&&bool(s,'added')&&['before','added','stirred','rested'].includes(s.stage)&&number(s,'stirs',0,20)&&Number.isInteger(s.stirs)&&s.added===(s.stage!=='before');
a2.valid=s=>object(s)&&number(s,'water',0,.3)&&number(s,'salt',0,.15)&&number(s,'dissolved',0,.15)&&number(s,'evaporated',0,1e6)&&number(s,'doseG',0,50)&&number(s,'steps',0,Number.MAX_SAFE_INTEGER)&&Number.isInteger(s.steps)&&s.dissolved<=saltEquilibrium(s.water,s.salt).dissolved+EPS;
a3.valid=s=>object(s)&&bool(s,'connected','prepared','submerged','warm','cloudy')&&['remaining','collected','escaped','tested'].every(k=>number(s,k,0,8)&&Number.isInteger(s[k]))&&gasInventory(s)===8&&typeof s.last==='string'&&s.last.length<=300&&s.cloudy===(s.tested>0)&&(s.collected===0||s.prepared&&s.submerged);
a4.valid=s=>{
 if(!object(s)||!bool(s,'loaded','dishOn','rodOn')||!['water','saltDish','saltBeaker','dissolved','lostWater','lostSalt'].every(k=>number(s,k,0,k.includes('Water')||k==='water' ? .1 : .01))||!number(s,'tare',0,.24))return false;
 if(!equal(s.water+s.lostWater,s.loaded ? .1 : 0)||!equal(s.saltDish+s.saltBeaker+s.lostSalt,s.loaded ? .01 : 0)||s.dissolved>s.saltBeaker+EPS||s.dissolved>saltEquilibrium(s.water,s.saltBeaker).dissolved+EPS)return false;
 return s.before===null||object(s.before)&&number(s.before,'gross',.1,.24)&&number(s.before,'tare',0,.24)&&number(s.before,'reading',-.24,.24)&&bool(s.before,'dishOn','rodOn')&&equal(s.before.reading,s.before.gross-s.before.tare);
};
a5.valid=s=>object(s)&&bool(s,'warm','iceOpen','sugarOpen')&&['iceFree','iceBag','sugarFree','sugarBag'].every(k=>[0,.5,1].includes(s[k]))&&(s.sugarOpen||s.sugarBag===0)&&s.iceFree===s.iceBag;
a6.valid=s=>{
 if(!object(s)||![25,50,100].includes(s.target)||![.0001,.0002].includes(s.volume)||!number(s,'mass',.001,.02)||!['weigh','dissolved','transferred','adjusted','wrong'].includes(s.stage)||!bool(s,'mixed','wrongWater')||!['beakerSalt','flaskSalt','lostSalt'].every(k=>number(s,k,0,.02))||!validPrevious(s.previous))return false;
 if(s.wrongWater!==(s.stage==='wrong')||!equal(preparationInventory(s),s.stage==='weigh'?0:s.mass))return false;
 if(s.finalVolume===null){if(s.mixed||s.stage==='adjusted')return false;}else if(!number(s,'finalVolume',s.volume,s.volume+.00005)||s.stage!=='adjusted')return false;
 if(['weigh','dissolved','wrong'].includes(s.stage)&&(s.flaskSalt!==0||s.lostSalt!==0))return false;
 return true;
};
