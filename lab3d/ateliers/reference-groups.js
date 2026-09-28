import {buildCircuit,updateCircuit,validLayout} from './reference-models.js';
import {terminals,validWires,solveCircuit,lampRemoved} from './reference-circuit.js';
import {fmt} from './modules/electricite-common.js';

const copy=s=>JSON.parse(JSON.stringify(s));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const scenes=['lustre','voiture'];
const returnWire={a:'chassis:r',b:'pile:m'};
const edge=w=>[w.a,w.b].sort().join('|');
const same=(a,b)=>edge(a)===edge(b);
export function groupPositions(scene){return scene==='lustre'
  ?{pile:[-4.2,-1.5],interrupteur:[-3.4,.9],B0:[-3.25,2.7],L0:[-.55,-1.95],L1:[2.5,-1.85],L2:[-.4,1.6],L3:[2,1.6],L4:[4.3,1.6],chassis:[2.5,2.6]}
  :{pile:[-4.2,-1.5],interrupteur:[-3.3,1.15],B0:[-.9,2.6],L0:[.15,-1.3],L1:[3.15,-.8],L2:[-.4,1.6],L3:[2,1.6],L4:[4.3,1.6],chassis:[2.7,2.45]};}
export function groupWires(scene,returnPath=true){
  const w=[{a:'pile:p',b:'interrupteur:a'},{a:'pile:p',b:'B0:a'}];
  const n=scene==='lustre'?5:2;
  for(let i=0;i<n;i++){
    w.push({a:(scene==='lustre'?i<2:i===0)?'interrupteur:b':'B0:b',b:`L${i}:a`});
    w.push({a:`L${i}:b`,b:scene==='lustre'?'pile:m':i===0?'chassis:a':'chassis:b'});
  }
  if(scene==='voiture'&&returnPath)w.push({...returnWire});
  return w;
}
export function groupCircuit(s){
  const b=s.benches?.[s.scene]??{},car=s.scene==='voiture';
  const c={n:car?2:5,main:s.g1,switches:['interrupteur','B0'],switchStates:{interrupteur:s.g1,B0:s.g2},
    connections:b.connections??groupWires(s.scene,s.returnPath),layout:b.layout??{},
    unscrewed:b.unscrewed??(car&&s.fault?[1]:[]),
    extraTerminals:car?['chassis:a','chassis:b','chassis:r']:[],
    conductors:car?[{a:'chassis:a',b:'chassis:r'},{a:'chassis:b',b:'chassis:r'}]:[],
    deviceNames:{interrupteur:car?'Commande phare gauche':'Commande 1 · 2 lampes',B0:car?'Commande phare droit':'Commande 2 · 3 lampes',...(car?{L0:'Phare gauche · L1',L1:'Phare droit · L2'}:{})},
    portNames:{'chassis:a':'A','chassis:b':'B','chassis:r':'Retour R'},deviceStatus:{chassis:'Métal conducteur · bornes reliées'}};
  return c;
}
function prepared(s){return groupCircuit(s).connections.map(edge).sort().join(';')===groupWires(s.scene,s.scene==='voiture'?s.returnPath:true).map(edge).sort().join(';');}
function editBench(s){s.benches??={};return s.benches[s.scene]??=(copy({connections:groupCircuit(s).connections,layout:groupCircuit(s).layout,unscrewed:groupCircuit(s).unscrewed}));}
const value=(n,u)=>n===null?'—':`${fmt(n,3)} ${u}`;
function addPlate(devices,kit){
  const {T,scene,root}=kit,g=new T.Group();root.add(g);
  const metal=new T.MeshStandardMaterial({color:'#b9c4c8',metalness:.72,roughness:.38,bumpMap:scene.surface.stone,bumpScale:.0015});
  scene.rounded(g,3.1,.1,.85,.12,metal,0,.18,0);
  const helper=Object.create(scene);helper.pins={};
  for(const [t,x]of [['a',-1.12],['b',0],['r',1.12]])helper.post(g,`chassis:${t}`,x,.22,0);
  for(const x of [-1.15,1.15])scene.cyl(g,.15,.15,.12,new T.MeshStandardMaterial({color:'#384653',roughness:.8}),x,.065,0);
  devices.chassis={g,s:{},pins:helper.pins};
}
function build(kit){return buildCircuit(kit,true,{lampCount:5,branchCount:1,addDevices:addPlate,
  positions:s=>groupPositions(s.n===5?'lustre':'voiture'),visible:(id,s)=>id==='chassis'?s.n===2:id.startsWith('L')?Number(id.slice(1))<s.n:true,
  labelAnchor:(id,v,s)=>id==='pile'?new kit.T.Vector3(-1.2,.05,.3):id==='interrupteur'?new kit.T.Vector3(-1.8,.01,.1):s.n===5&&/^L[01]$/.test(id)?new kit.T.Vector3(1.55,1.3,.15):new kit.T.Vector3(0,.01,id==='chassis'?.65:id.startsWith('L')?1.05:.8),
  wireLabelT:(i,v,s)=>s.n===2&&[s.connections[i]?.a,s.connections[i]?.b].includes('pile:m')?.22:.3+(i%4)*.12,
  wireRoute(w,v,s){const ends=[w.a,w.b],a=v.pins[w.a],b=v.pins[w.b],T=kit.T;
    if(ends.includes('pile:p')){const t=ends.find(t=>t!=='pile:p'),p=v.pins['pile:p'],q=v.pins[t],lane=t.startsWith('B')?-5.45:-5.15;return {color:0,points:[p,p.clone().add(new T.Vector3(-.3,0,0)),new T.Vector3(lane,.1,p.z),new T.Vector3(lane,.1,q.z),q.clone().add(new T.Vector3(-.25,0,0)),q]};}
    if(ends.includes('interrupteur:b')||ends.includes('B0:b')){const first=ends.includes('interrupteur:b'),t=first?'interrupteur:b':'B0:b',p=v.pins[t],q=v.pins[ends.find(e=>e!==t)],lane=first?-2.2:-1.7;return {color:first?0:2,points:[p,p.clone().add(new T.Vector3(.2,0,.1)),new T.Vector3(lane,.12,p.z+.4),new T.Vector3(lane,.12,q.z+.35),q.clone().add(new T.Vector3(-.15,0,.15)),q]};}
    if(ends.includes('pile:m')&&ends.some(t=>t.startsWith('chassis:'))){const p=v.pins[ends.find(t=>t!=='pile:m')],q=v.pins['pile:m'],lane=Math.max(5.3,p.x+.45);return {color:1,points:[p,p.clone().add(new T.Vector3(.3,0,.1)),new T.Vector3(lane,.1,p.z+.3),new T.Vector3(lane,.1,-2.75),new T.Vector3(q.x+.5,.1,-2.75),q.clone().add(new T.Vector3(.25,.1,0)),q]};}
    if(ends.some(t=>t.startsWith('chassis:')))return {color:1,points:[a,a.clone().add(new T.Vector3(0,0,.3)),new T.Vector3((a.x+b.x)/2,.1,Math.max(a.z,b.z)+.7),b.clone().add(new T.Vector3(0,0,.3)),b]};
    return null;
  }
});}
function update(v,s){for(const [id,d]of Object.entries(v.devices))d.g.scale.setScalar(id.startsWith('L')?(s.scene==='lustre'?.96:1.17):id==='chassis'?1:id==='pile'?1.17:1.02);updateCircuit(v,groupCircuit(s));}

export function refineGroups(base){return {...base,reference:'circuit',directCircuit:true,circuitState:groupCircuit,build,update,
  boardTitle:'COMMANDER DES GROUPES · SUIVRE LE RETOUR',boardRule:'Un contact coupe les trajets qui passent par lui.',
  materialIntro:'Actionne les leviers et touche les ampoules. Les deux maquettes gardent chacune leurs fils et leur disposition. Tu peux débrancher le retour métallique ou construire un autre montage.',
  presets:[{value:'lustre',label:'Lustre · 2 + 3'},{value:'voiture',label:'Phares · retour métallique'}],presetAction:'scene',presetLabel:'Maquette :',activePreset:s=>s.scene,schema:groupSchema,
  valid(s){if(!base.valid(s)||s.benches!==undefined&&(!s.benches||typeof s.benches!=='object'||Array.isArray(s.benches)||Object.keys(s.benches).some(k=>!scenes.includes(k))))return false;
    return scenes.every(scene=>{const b=s.benches?.[scene];if(!b)return b===undefined;const c=groupCircuit({...s,scene});return typeof b==='object'&&!Array.isArray(b)&&validWires(c)&&validLayout(c,groupPositions(scene))&&(b.unscrewed===undefined||Array.isArray(b.unscrewed)&&new Set(b.unscrewed).size===b.unscrewed.length&&b.unscrewed.every(i=>Number.isInteger(i)&&i>=0&&i<c.n));});},
  goal(s){const c=groupCircuit(s),r=solveCircuit(c);if(r.fault)return 'Retire la liaison qui court-circuite l’alimentation.';
    if(s.scene==='voiture')return !s.g1||!s.g2?'Ferme les deux commandes, puis retire le fil entre Retour R et la borne −.':r.lit===2?'Retire le fil de retour commun. Que deviennent les deux phares ?':'Observe les phares. Rebranche le retour commun, puis essaie de dévisser une seule ampoule.';
    return !s.g1&&!s.g2?'Touche la commande 1. Combien de lampes s’allument ? Puis essaie la commande 2.':r.lit===5?'Dévisse une ampoule. Les quatre autres restent-elles allumées ?':'Essaie les deux leviers : peux-tu allumer 2, 3, puis 5 lampes ?';},
  controls:s=>[
    {type:'button',id:'g1',label:`${s.g1?'Ouvrir':'Fermer'} la commande 1`},{type:'button',id:'g2',label:`${s.g2?'Ouvrir':'Fermer'} la commande 2`},
    ...Array.from({length:s.scene==='lustre'?5:2},(_,i)=>({type:'button',id:`bulb-${i}`,label:`${lampRemoved(groupCircuit(s),i)?'Revisser':'Dévisser'} L${i+1}`})),
    ...(s.scene==='voiture'?[{type:'button',id:'returnPath',label:'Débrancher ou rétablir le retour commun'}]:[]),
    {type:'button',id:'prepare',label:'Rebrancher la maquette de départ'},{type:'button',id:'unwire',label:'Enlever les fils pour construire mon montage'},{type:'button',id:'arrange',label:'Ranger le matériel'}
  ],
  act(state,id,v){const s=copy(state),c=groupCircuit(s);
    if(id==='scene'&&scenes.includes(v)){s.scene=v;return s;}
    if(id==='closed')id='g1';if(id==='b0')id='g2';
    if(id==='g1'||id==='g2'){s[id]=typeof v==='boolean'?v:!s[id];return s;}
    if(id.startsWith('bulb-')){v=id.slice(5);id='removeLamp';}
    if(id==='move'&&v&&Object.hasOwn(groupPositions(s.scene),v.id)&&Number.isFinite(v.x)&&Number.isFinite(v.z)){const b=editBench(s);b.layout={...c.layout,[v.id]:[clamp(v.x,-5.5,5.5),clamp(v.z,-2.5,3.3)]};return s;}
    if(id==='removeLamp'){const i=Number(v);if(Number.isInteger(i)&&i>=0&&i<c.n){const b=editBench(s);b.unscrewed=c.unscrewed.includes(i)?c.unscrewed.filter(n=>n!==i):[...c.unscrewed,i];if(s.scene==='voiture')s.fault=b.unscrewed.includes(1);}return s;}
    if(id==='fault'){const b=editBench(s);s.fault=typeof v==='boolean'?v:!s.fault;b.unscrewed=s.fault?[...new Set([...c.unscrewed,1])]:c.unscrewed.filter(i=>i!==1);return s;}
    if(id==='returnPath'&&s.scene==='voiture'){const b=editBench(s),has=c.connections.some(w=>same(w,returnWire));s.returnPath=typeof v==='boolean'?v:!has;b.connections=c.connections.filter(w=>!same(w,returnWire));if(s.returnPath)b.connections.push({...returnWire});return s;}
    if(id==='prepare'){const b=editBench(s);b.connections=groupWires(s.scene);b.unscrewed=[];s.returnPath=true;s.fault=false;return s;}
    if(id==='unwire'){editBench(s).connections=[];return s;}
    if(id==='arrange'){editBench(s).layout={};return s;}
    if(id==='unplug'){const b=editBench(s);if(Number.isInteger(v)&&v>=0&&v<c.connections.length){b.connections=copy(c.connections);b.connections.splice(v,1);if(s.scene==='voiture')s.returnPath=b.connections.some(w=>same(w,returnWire));}return s;}
    if(id==='connect'&&v){const ports=terminals(c),b=editBench(s);if(ports.includes(v.a)&&ports.includes(v.b)&&v.a!==v.b&&c.connections.length<24&&!c.connections.some(w=>same(w,v))){b.connections=[...c.connections,{a:v.a,b:v.b}];if(s.scene==='voiture')s.returnPath=b.connections.some(w=>same(w,returnWire));}return s;}
    return base.act(s,id,v);
  },
  observe(s){const c=groupCircuit(s),r=solveCircuit(c),car=s.scene==='voiture',title=r.fault?'Alimentation en défaut · court-circuit':`${r.lit} ${car?'phare':'lampe'}${r.lit>1?'s':''} allumé${car?'':'e'}${r.lit>1?'s':''}${prepared(s)?'':' · montage libre'}`;
    const count=indices=>indices.filter(i=>r.lamps[i].p>1e-8).length;
    return {title,metrics:[{label:'Tension régulée',value:value(r.voltage,'V')},{label:'Courant total',value:value(r.current,'A')},...r.lamps.map((l,i)=>({label:`Puissance L${i+1}`,value:value(l.p,'W')}))],boardMetrics:car?[{label:'Phare gauche',value:r.fault?'—':r.lamps[0].p>1e-8?'Allumé':'Éteint'},{label:'Phare droit',value:r.fault?'—':r.lamps[1].p>1e-8?'Allumé':'Éteint'}]:[{label:'L1 et L2',value:r.fault?'—':`${count([0,1])} / 2`},{label:'L3, L4 et L5',value:r.fault?'—':`${count([2,3,4])} / 3`},{label:'Total allumé',value:r.fault?'—':`${r.lit} / 5`}],lines:[
      car?'Les bornes A, B et R sont reliées par le métal de la plaque. Dans la maquette préparée, retirer le retour R vers la borne − ouvre les deux trajets ; dévisser un seul phare laisse l’autre fonctionner.':'Dans le montage préparé, la commande 1 alimente L1 et L2 ; la commande 2 alimente L3, L4 et L5. Deux commandes ouvertes : 0 ; la première seule : 2 ; la seconde seule : 3 ; les deux fermées : 5.',
      'Prévois le résultat, actionne les leviers, puis observe. Saisis les socles ou leurs étiquettes pour les déplacer ; les fils restent attachés. Touche une ampoule pour la dévisser.',
      'Les connexions libres sont réellement calculées. Si tu rebranches autrement les fils, les commandes peuvent avoir un autre effet. Déplacer le matériel ou croiser deux fils ne change pas les contacts.',
      'Manuel p. 178, adaptation sur une maquette de laboratoire basse tension. Alimentation régulée idéale 6 V, domaine 2 A ; cinq lampes L6 au maximum, fils et plaque idéaux. À 6 V, une lampe intacte reçoit 0,30 A et 1,80 W. Pas de calcul thermique ni de destruction simulée. Cette maquette ne décrit pas le câblage d’une installation réelle.'
    ],warning:r.fault?'Court-circuit : retire la liaison qui contourne les lampes. Aucune mesure n’est donnée hors du modèle.':''};
  }
};}

export function groupSchema(raw){
  const s=groupCircuit(raw),car=raw.scene==='voiture',coords={pile:[75,250],interrupteur:[car?330:355,145],B0:[car?650:655,145]},cols=car?[330,650]:[280,425,565,710,855];
  cols.forEach((x,i)=>coords[`L${i}`]=[x,310]);
  const plate={a:[330,425],b:[650,425],r:[175,425]};
  const point=t=>{const [id,p]=t.split(':');if(id==='chassis')return plate[p];const [x,y]=coords[id];return [x,y+(p==='a'||p==='p'?-35:35)];};
  let art=car?'<rect x="155" y="400" width="525" height="57" rx="9" fill="#e0e5e6" stroke="#82959c" stroke-width="2"/><path d="M175 425H650" stroke="#657c86" stroke-width="4"/><text x="410" y="490" text-anchor="middle" font-size="17" fill="#263f4b">Plaque métallique : A, B et R sont reliés</text>':'';
  s.connections.forEach((w,i)=>{const ends=[w.a,w.b],sw=ends.find(t=>t==='interrupteur:b'||t==='B0:b'),input=ends.find(t=>/^L\d:a$/.test(t));let route=[point(w.a),point(w.b)],color='#405668';
    if(ends.includes('pile:p')){const q=point(ends.find(t=>t!=='pile:p'));route=[point('pile:p'),[75,65],[q[0],65],q];color='#a0322d';}
    else if(sw&&input){const p=point(sw),q=point(input);route=[p,[p[0],220],[q[0],220],q];color=sw.startsWith('B')?'#977230':'#a0322d';}
    else if(ends.includes('pile:m')){const p=point(ends.find(t=>t!=='pile:m')),q=point('pile:m');route=car?[p,[75,425],q]:[p,[p[0],445],[75,445],q];}
    art+=`<path d="M${route.map(p=>p.join(' ')).join(' L')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"><title>Fil F${i+1}</title></path>`;
  });
  for(const [id,[x,y]]of Object.entries(coords)){
    const lamp=id.startsWith('L'),i=Number(id.slice(1)),removed=lamp&&lampRemoved(s,i),closed=id==='interrupteur'?raw.g1:raw.g2;
    art+=`<g transform="translate(${x} ${y}) rotate(90)" fill="#fffdf6" stroke="#263f4b" stroke-width="3">`;
    if(id==='pile')art+='<path d="M-35 0H-22 M22 0H35"/><circle r="22"/><path d="M-13 0h10 M-8 -5v10 M7 0h9"/>';
    else if(!lamp)art+=`<path d="M-35 0H-20 L20 ${closed?0:-24} M20 0H35"/><circle cx="-20" r="4"/><circle cx="20" r="4"/>`;
    else if(removed)art+='<path d="M-35 0H-28 M28 0H35"/><circle r="22" stroke-dasharray="4 5" opacity=".4"/>';
    else art+='<path d="M-35 0H-22 M22 0H35"/><circle r="22"/><path d="M-15 -15L15 15 M-15 15L15 -15"/>';
    art+=`</g><text x="${x+33}" y="${y+5}" fill="#263f4b" font-size="17">${id==='pile'?'6 V':lamp?`L${i+1}`:id==='interrupteur'?'C1':'C2'}</text>`;
  }
  if(car)for(const [id,[x,y]]of Object.entries(plate))art+=`<circle cx="${x}" cy="${y}" r="5" fill="#3e657b"/><text x="${x+9}" y="${y-8}" font-size="16" fill="#263f4b">${id.toUpperCase()}</text>`;
  return `<p>${car?'La plaque métallique forme un conducteur commun aux deux phares.':'C1 commande le groupe de deux lampes ; C2, celui de trois, dans le branchement préparé.'} Les fils, contacts et ampoules ci-dessous suivent l’état réel de ta table.</p><svg viewBox="0 20 955 500" role="img" aria-label="Schéma des connexions réelles de la maquette">${art}</svg><p>Un croisement de fils seul ne crée pas de connexion.${car?' Les bornes de la plaque, elles, sont reliées par le métal.':''}</p>`;
}
