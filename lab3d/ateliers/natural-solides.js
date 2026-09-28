/* M02-A01 — compare a compact solid and divided solid, one observable gesture at a time.
   Legacy states {kind, side, zoom} remain valid. The loupe changes the view, never the grains. */
import {rig,jar,obs,metric} from './modules/matiere-common.js';
const sides=['gauche','droite'],opposite=s=>s==='gauche'?'droite':'gauche';
const names={gauche:'étroit',droite:'large'},ids={gauche:'left',droite:'right'};
const copy=s=>JSON.parse(JSON.stringify(s));
const entity=(id,label,object,extra={})=>({id,label,object,movable:false,...extra});
const zoomSVG=()=>`<div class="solid-closeup"><strong>Le sable vu de près</strong><svg viewBox="0 0 260 240" role="img" aria-label="Vue agrandie illustrative : six grains de sable aux contours solides"><defs><clipPath id="grain-lens"><circle cx="130" cy="120" r="104"/></clipPath></defs><circle cx="130" cy="120" r="106" fill="#faf4e5" stroke="#58717b" stroke-width="4"/><g clip-path="url(#grain-lens)" stroke="#8b7048" stroke-width="2">${[[69,67,-12],[143,61,18],[197,105,-23],[80,150,21],[148,154,-10],[134,217,14]].map(([x,y,a],i)=>`<g transform="translate(${x} ${y}) rotate(${a})"><path d="M-25-12L-6-29 21-18 30 7 10 28-19 23-32 4Z" fill="${['#d7bd88','#e5cda4','#c3a879'][i%3]}"/><path d="M-25-12-5-6 21-18M-5-6 10 28M-5-6 30 7" fill="none" stroke="#b19568" stroke-width="1"/></g>`).join('')}</g></svg><p><b>Chaque grain a sa propre forme.</b> Les grains restent solides, même si le tas s’écoule et change de forme.</p><p class="muted">Vue agrandie illustrative : les grains sur la table ne grossissent pas.</p></div>`;
function observation(s){
 const sand=s.kind==='sable',seen=sand?s.seenSand:s.seenCompact;
 const result=sand?(seen?`Le tas est plus ${s.side==='droite'?'large et moins haut':'étroit et plus haut'}.`:'Compare la forme du tas dans les deux récipients.'):(seen?'La pile garde exactement la même forme.':'Compare la pile avant et après le déplacement.');
 return obs(sand?'Le tas change de forme ; les grains restent solides.':'La pile est un solide compact.',[result,...(sand?['Le sable peut s’écouler sans devenir liquide.','La loupe propose un dessin agrandi des grains ; elle ne modifie pas le sable.']:['On utilise ici la pile comme objet solide, sans montage électrique.']), 'Manuel p. 18–20 et 23 : solide compact et solide divisé.'],[metric('Dans le récipient '+names[s.side],sand?'Sable':'Pile'),metric('Observation',result),...(sand&&s.zoom?[metric('À la loupe','Des grains solides')]:[])]);
}
function build(kit){
 const group=new kit.T.Group();group.scale.setScalar(1.5);kit.root.add(group);
 const r=rig({...kit,root:group});r.m.glass.opacity=.15;
 const cups={gauche:jar(r,-1.35,0,{radius:.55,height:1.7,title:''}),droite:jar(r,1.35,0,{radius:.86,height:1.3,title:''})};
 for(const cup of Object.values(cups)){cup.water.visible=false;cup.g.traverse(o=>{if(o.material?.map)o.visible=false;});const rim=r.mesh(new r.T.TorusGeometry(cup.radius,.016,8,64),r.mat('#8a9e9f',{metalness:.3,roughness:.25}),0,cup.height,0,cup.g);rim.rotation.x=Math.PI/2;}
 function battery(parent){const g=r.group(0,0,0,parent);r.box(.48,.78,.35,r.m.dark,0,.43,0,g);r.box(.49,.095,.36,r.m.metal,0,.865,0,g);for(const [x,rad]of [[-.12,.055],[.12,.075]])r.cyl(rad,.08,r.m.metal,x,.945,0,g);r.box(.34,.28,.012,r.m.white,0,.50,.181,g);return g;}
 const compact=battery(group);
 const sand=r.group(),sandBody=r.cyl(1,1,r.m.sand,0,0,0,sand);
 const grains=new r.T.InstancedMesh(new r.T.IcosahedronGeometry(.028,0),r.mat('#ceb484',{roughness:.95}),480);grains.castShadow=true;grains.receiveShadow=true;sand.add(grains);
 const dummy=new r.T.Object3D(),palette=['#baa171','#ceb484','#ddc498','#bfa578'];for(let i=0;i<grains.count;i++)grains.setColorAt(i,new r.T.Color(palette[i%4]));
 const choice=r.group(-2.4,.12,1.45);r.box(1.05,.075,.8,r.m.white,0,0,0,choice);
 const sandChoice=r.group(0,0,0,choice);r.mesh(new r.T.CylinderGeometry(.34,.27,.2,48,1,true),r.m.white,0,.13,0,sandChoice);r.cyl(.295,.10,r.m.sand,0,.13,0,sandChoice);
 const compactChoice=battery(choice);compactChoice.scale.setScalar(.66);
 const lens=r.group(1.85,.18,1.7);const ring=r.mesh(new r.T.TorusGeometry(.39,.045,12,64),r.m.metal,0,.025,0,lens);ring.rotation.x=Math.PI/2;r.cyl(.36,.014,r.m.glass,0,.025,0,lens);r.box(.14,.10,.65,r.m.dark,0,.025,.67,lens);
 return {r,group,cups,compact,sand,sandBody,grains,dummy,choice,sandChoice,compactChoice,lens};
}
function update(v,s){
 const isSand=s.kind==='sable',cup=v.cups[s.side];
 for(const [side,c]of Object.entries(v.cups)){c.g.position.set(side==='gauche'?-1.35:1.35,.12,0);c.g.rotation.set(0,0,0);}
 v.compact.visible=!isSand;v.compact.position.set(cup.g.position.x,.15,0);
 v.sand.visible=isSand;cup.g.add(v.sand);v.sand.position.set(0,.035,0);v.sand.rotation.set(0,0,0);
 // Constant represented amount. The larger section produces a lower heap.
 const radius=cup.radius-.04,h=.49*.49*.70/(radius*radius);
 v.sandBody.scale.set(radius,h,radius);v.sandBody.position.y=h/2;
 for(let i=0;i<v.grains.count;i++){const angle=i*2.399963229728653,rad=radius*.96*Math.sqrt((i+.5)/v.grains.count);v.dummy.position.set(rad*Math.cos(angle),h+.012+Math.sin(i*7.2)*.009,rad*Math.sin(angle));v.dummy.rotation.set(i*.31,i*.17,i*.29);v.dummy.scale.setScalar(1);v.dummy.updateMatrix();v.grains.setMatrixAt(i,v.dummy.matrix);}v.grains.instanceMatrix.needsUpdate=true;v.grains.computeBoundingSphere();
 v.choice.position.set(-2.4,.12,1.45);v.sandChoice.visible=!isSand;v.compactChoice.visible=isSand;
 v.lens.visible=isSand;v.lens.position.set(s.zoom&&isSand?cup.g.position.x:1.85,s.zoom&&isSand?cup.height+.38:.18,s.zoom&&isSand?0:1.7);v.lens.rotation.set(0,0,0);
 v.r.kit.invalidate?.();
}
function entities(s,v){
 const sand=s.kind==='sable',target=opposite(s.side),destination=ids[target];
 const list=sides.map(side=>{
  const full=side===s.side,cup=v.cups[side];
  return entity(ids[side],`Récipient ${names[side]} · ${full?(sand?'sable':'pile'):'vide'}`,cup.g,{
   hint:full?(sand?`Saisis ce récipient et verse son sable dans le récipient ${names[target]}.`:'Prends la pile elle-même pour la placer dans l’autre récipient.'):`Dépose ${sand?'le sable':'la pile'} ici, ou touche ce récipient pour ${sand?'verser':'déplacer la pile'}.`,
   shortHint:full?(sand?'Saisir pour verser':'Saisir la pile'):'Recevoir ici',
   controls:['transfer'],
   ...(full&&sand?{pose:'pour',drop:[{target:destination,action:'solid-transfer',value:target,message:`Le sable est dans le récipient ${names[target]}. Compare la forme du tas.`}]}:{}),
   ...(!full?{click:{id:'solid-transfer',value:side}}:{}),
   dragMessage:full?'Saisis la pile elle-même.':'Ce récipient est vide. Prends la pile ou le récipient qui contient le sable.'
  });
 });
 if(!sand)list.push(entity('sample','Pile · à déplacer',v.compact,{hint:`Glisse la pile dans le récipient ${names[target]}. Observe si sa forme change.`,controls:['transfer'],drop:[{target:destination,action:'solid-transfer',value:target,message:'La pile a changé de récipient, mais garde sa forme.'}]}));
 list.push(entity('compare',sand?'Revenir à la pile':'Essayer avec le sable',v.choice,{hint:sand?'Comparer de nouveau avec un seul objet compact.':'Passer au sable pour comparer un solide divisé à la pile.',click:{id:'solid-material',value:sand?'compact':'sable'}}));
 if(sand)list.push(entity('lens',s.zoom?'Loupe · voir les grains':'Loupe · observer le sable',v.lens,{hint:'Dépose la loupe sur le récipient contenant le sable, ou touche-la pour ouvrir la vue agrandie.',controls:['zoom'],inspectAfterDrop:true,drop:[{target:ids[s.side],action:'zoom',value:true,message:'La vue agrandie montre les contours des grains. Ils restent solides.'}],click:{id:'zoom',value:true}}));
 return list;
}
export function refineSolids(base){return {...base,
 valid:s=>base.valid(s)&&['seenCompact','seenSand'].every(k=>s[k]===undefined||typeof s[k]==='boolean'),
 act(s,id,value){
  if(id==='reset')return base.initial();let n=copy(s);
  if(id==='solid-material'||id==='kind'){if(['compact','sable'].includes(value)&&value!==s.kind){n.kind=value;n.side='gauche';n.zoom=false;}return n;}
  if(id==='solid-transfer'||id==='transfer'){const side=id==='transfer'?opposite(s.side):value;if(sides.includes(side)&&side!==s.side){n.side=side;n.zoom=false;n[s.kind==='sable'?'seenSand':'seenCompact']=true;}return n;}
  if(id==='zoom'){n.zoom=s.kind==='sable'&&value===true;return n;}
  return base.act(s,id,value);
 },
 controls(s){return base.controls(s).filter(c=>s.kind==='sable'||c.id!=='zoom').map(c=>c.id==='transfer'?{...c,label:s.kind==='sable'?`Verser dans le récipient ${names[opposite(s.side)]}`:`Placer la pile dans le récipient ${names[opposite(s.side)]}`} :c.id==='zoom'?{...c,label:'Ouvrir la vue agrandie des grains'}:c);},
 build,update,observe:observation,
 natural:{
  goal:s=>s.kind==='compact'?(s.seenCompact?'La pile a gardé sa forme. Touche « Essayer avec le sable » pour comparer.': `1 · Prends la pile et dépose-la dans le récipient ${names[opposite(s.side)]}.`):(s.zoom?'3 · À la loupe : chaque grain reste solide, même si le tas s’écoule.':s.seenSand?'Le tas a changé de forme. Pose la loupe sur le sable pour regarder les grains.': `2 · Prends le récipient rempli de sable et verse-le dans le récipient ${names[opposite(s.side)]}.`),
  hint:s=>s.kind==='compact'?'Déplace la pile elle-même. Le petit plateau « Essayer avec le sable » prépare la comparaison.':'Seul le récipient plein permet de verser. La loupe ouvre une vue agrandie du sable.',
  entities,readings:s=>observation(s).metrics,
  instrument:(s,id)=>id==='lens'&&s.kind==='sable'&&s.zoom?zoomSVG():`<p>${observation(s).lines[0]}</p>`
 }
};}
