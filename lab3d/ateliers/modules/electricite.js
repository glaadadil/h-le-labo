/* E02-A2…A6. Manuel 157–167 ; REGLES_SCIENTIFIQUES R18–R25.
 * Aucun moteur/DOM requis par initial, act, observe. Valeurs d'échantillons :
 * scénarios construits (pas des constantes de matériau). SI pour le calcul. */
const copy = s => JSON.parse(JSON.stringify(s));
const choice = (v, options, fallback) => options.includes(v) ? v : fallback;
const num = (v, min, max, old) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : old;
const bool = (v, old) => typeof v === 'boolean' ? v : old;
const button = (id,label,disabled=false) => ({id,type:'button',label,disabled});
const check = (id,label,value) => ({id,type:'checkbox',label,value});
const select = (id,label,value,options) => ({id,type:'select',label,value,options:options.map(([value,label])=>({value,label}))});
const range = (id,label,value,min,max,step,unit='') => ({id,type:'range',label,value,min,max,step,unit});
const profile = 'Pile pédagogique E = 6 V, r = 1 Ω ; lampe L6 construite, sans durée de destruction simulée.';
export function seriesLamp(resistance=0, enabled=true) {
  if (!Number.isFinite(resistance) || resistance<0) throw new Error('Résistance invalide');
  const b=11+resistance, i=enabled ? 12/(b+Math.sqrt(b*b+800)) : 0;
  const u=10*i+(100/3)*i*i, p=u*i;
  return {current:i,voltage:u,power:p,brightness:Math.min(1,p/1.8)};
}
const terminalNames = {'P+':'Pile +','P−':'Pile −','L1':'Lampe plot','L2':'Lampe culot','S1':'Interrupteur 1','S2':'Interrupteur 2'};
const terminals = Object.keys(terminalNames);
const pairKey = (a,b) => [a,b].sort().join('|');
export function circuitResult(s) {
  const parents=Object.fromEntries(terminals.map(t=>[t,t]));
  const find=t=>parents[t]===t?t:(parents[t]=find(parents[t]));
  const join=(a,b)=>{parents[find(a)]=find(b);};
  s.wires.forEach(([a,b])=>{if(terminals.includes(a)&&terminals.includes(b))join(a,b);});
  if(s.closed)join('S1','S2');
  const same=(a,b)=>find(a)===find(b);
  const short=same('P+','P−');
  const across=(same('P+','L1')&&same('P−','L2'))||(same('P+','L2')&&same('P−','L1'));
  return {...seriesLamp(0,!short&&across),short,sourceCurrent:short?6:seriesLamp(0,across).current,
    status:short?'Court-circuit de la pile':across?'Lampe allumée':'Lampe éteinte : trajet ouvert',
    nodes:Object.fromEntries(terminals.map(t=>[t,find(t)]))};
}
export const samples = Object.freeze({
 cuivre:{label:'Cuivre',r:.1,color:'#b66c41'},acier:{label:'Acier',r:1,color:'#8f989f'},aluminium:{label:'Aluminium',r:.2,color:'#c5d0d6'},
 graphite:{label:'Mine de graphite',r:300,color:'#3c4045'},plastique:{label:'Plastique',r:1e9,color:'#b7443b'},verre:{label:'Verre',r:1e9,color:'#b4d9dd'},
 bois:{label:'Bois sec',r:1e9,color:'#b88a50'},gomme:{label:'Gomme',r:1e9,color:'#e7d5b9'},carton:{label:'Carton sec',r:1e9,color:'#b3936c'},laine:{label:'Laine sèche',r:1e9,color:'#d9cdc0'},cuir:{label:'Cuir sec',r:1e9,color:'#76513c'}
});
export function sampleResult(s) {
  const r=s.mode==='reference'?0:samples[s.sample].r;
  const electrical=seriesLamp(r,s.contacts&&s.healthy);
  const threshold=s.sensitive?.001:.01;
  return {...electrical,lit:electrical.power>=threshold,threshold,conclusive:s.verified&&s.contacts&&s.healthy};
}
const faults={one:{A:true,B:false,L1:true,L2:true,count:1},two:{A:true,B:false,L1:false,L2:true,count:2}};
export function diagnose(s) {
  const count=faults[s.challenge].count;
  const hypotheses=[];
  for(let bits=0;bits<16;bits++){
    const h=Object.fromEntries(['A','B','L1','L2'].map((k,i)=>[k,Boolean(bits&(1<<i))]));
    if(Object.values(h).filter(v=>!v).length!==count)continue;
    if(s.tests.every(t=>(Boolean((t.battery==='T'||h[t.battery])&&(t.lamp==='T'||h[t.lamp])))===t.lit))hypotheses.push(h);
  }
  const states=Object.fromEntries(['A','B','L1','L2'].map(k=>[k,hypotheses.every(h=>h[k])?'bon':hypotheses.every(h=>!h[k])?'défectueux':'indéterminé']));
  return {hypotheses,states};
}
export const ringHeight=x=>1.1+.28*Math.sin(Math.PI*x/1.4);
export function ringResult(s) {
  // Anneau intérieur .285, rayon du serpentin .04 : contact à .245.
  const contact=Math.abs(s.offset)>=.245-1e-9;
  const conductive=s.material==='metal';
  return {...seriesLamp(0,contact&&conductive&&s.connected),contact,lit:contact&&conductive&&s.connected};
}

// Petits appareils communs : géométries propres à chaque root, aucune salle/caméra.
function kitBase(kit,id){
 const {T,root,scene}=kit;
 const material=(name,color,extra={})=>scene.mat(`electricite-${id}-${name}`,color,extra);
 const m={body:material('body','#344757'),ivory:material('ivory','#e8e4d5'),metal:material('metal','#bec9ce',{metalness:.8,roughness:.24}),red:material('red','#a43b32'),black:material('black','#283239'),gold:material('gold','#b29a55',{metalness:.7}),wood:material('wood','#c7a170')};
 return {...kit,m,material};
}
function group(k,x=0,z=0){const g=new k.T.Group();g.position.set(x,0,z);k.root.add(g);return g;}
function tag(o,id,value){o.userData.workshopAction={id,value};return o;}
function label(k,g,text,x,y,z,w=1.2){const p=k.scene.print(g,text,w,.23,x,y,z);p.rotation.x=-Math.PI/2;return p;}
function post(k,g,x,y,z,id,value){const o=k.scene.cyl(g,.065,.075,.13,k.m.gold,x,y,z,16);if(id)tag(o,id,value);return o;}
function battery(k,x,z,text='6 V'){
 const g=group(k,x,z);k.scene.rounded(g,.95,.68,.6,.06,k.m.body,0,.4,0);k.scene.box(g,.98,.12,.62,k.m.black,0,.82,0);
 post(k,g,-.28,.94,0);post(k,g,.28,.94,0);k.scene.print(g,text,.68,.28,0,.51,.32);k.scene.print(g,'+     −',.7,.17,0,.76,.322);
 return g;
}
function lamp(k,x,z,name='Lampe'){
 const g=group(k,x,z);k.scene.rounded(g,1.15,.14,.8,.12,k.m.ivory,0,.12,0);k.scene.cyl(g,.19,.31,.2,k.m.ivory,0,.29,0);
 k.scene.cyl(g,.20,.20,.25,k.m.metal,0,.50,0);for(let i=0;i<4;i++)k.scene.cyl(g,.213,.213,.02,k.m.metal,0,.4+i*.055,0);
 const glass=new k.T.MeshPhysicalMaterial({color:'#eef7fa',transparent:true,opacity:.24,roughness:.12,depthWrite:false});
 const bulb=new k.T.Mesh(new k.T.SphereGeometry(.36,24,16),glass);bulb.scale.y=1.25;bulb.position.y=.99;g.add(bulb);
 const fm=new k.T.MeshStandardMaterial({color:'#79634b',emissive:'#ffad29',emissiveIntensity:0});
 const filament=k.scene.tube(g,[[-.13,.94,0],[-.08,1.08,0],[0,.94,0],[.08,1.08,0],[.13,.94,0]],.022,fm).mesh;
 k.scene.tube(g,[[-.13,.94,0],[-.08,.63,0]],.018,k.m.metal);k.scene.tube(g,[[.13,.94,0],[.08,.63,0]],.018,k.m.metal);
 const glow=new k.T.Mesh(new k.T.SphereGeometry(.28,16,12),new k.T.MeshBasicMaterial({color:'#ffd776',transparent:true,opacity:.2,depthWrite:false}));glow.position.y=1;g.add(glow);
 const light=new k.T.PointLight('#ffca6c',0,3);light.position.y=1.2;g.add(light);
 post(k,g,-.44,.29,0);post(k,g,.44,.29,0);label(k,g,name,0,.22,.58);
 return {g,bulb,filament,fm,glow,light};
}
function illuminate(l,b,intact=true){l.filament.visible=intact;l.fm.emissiveIntensity=b>0?1+4*b:0;l.glow.visible=b>0;l.glow.material.opacity=.12+.35*b;l.light.intensity=3*b;}
function wire(k,g,points,color='red'){return k.scene.tube(g,points,.028,k.m[color]).mesh;}
function cable(k,g,color='red'){
 const a=new Float32Array(25*3),geo=new k.T.BufferGeometry();geo.setAttribute('position',new k.T.BufferAttribute(a,3));
 const line=new k.T.Line(geo,new k.T.LineBasicMaterial({color:k.m[color].color}));g.add(line);
 return {line,set(start,end,lift=.08){for(let i=0;i<25;i++){const t=i/24;a[i*3]=start[0]+(end[0]-start[0])*t;a[i*3+1]=start[1]+(end[1]-start[1])*t+lift*Math.sin(Math.PI*t);a[i*3+2]=start[2]+(end[2]-start[2])*t;}geo.attributes.position.needsUpdate=true;geo.computeBoundingSphere();}};
}
function switchDevice(k,x,z){const g=group(k,x,z);k.scene.rounded(g,1.15,.12,.65,.06,k.m.wood,0,.12,0);post(k,g,-.42,.30,0);post(k,g,.42,.30,0);const pivot=new k.T.Group();pivot.position.set(-.42,.34,0);g.add(pivot);tag(k.scene.box(pivot,.84,.06,.12,k.m.gold,.42,0,0),'toggle');tag(k.scene.box(pivot,.3,.13,.24,k.m.black,.73,.08,0),'toggle');return {g,pivot};}
function commonObservation(title,lines,metrics=[],warning='',board=[]){return {title,lines,metrics,warning,board:board.length?board:[title,...lines.slice(0,2)]};}

const schema={
 id:'E02-A2',
 initial:()=>({wires:[],closed:false,view:'montage',layout:'rectangle',from:'P+',to:'L1',selectedWire:'',pending:''}),
 controls:s=>[select('view','Représentation',s.view,[['montage','Montage réel'],['schema','Schéma normalisé']]),select('layout','Disposition du dessin',s.layout,[['rectangle','Rectangle'],['croisee','Fils croisés, sans jonction']]),select('from','Borne de départ',s.from,Object.entries(terminalNames)),select('to','Borne d’arrivée',s.to,Object.entries(terminalNames)),button('connect','Relier ces deux bornes',s.from===s.to),select('selectedWire','Liaison à retirer',s.selectedWire,[['','Choisir une liaison'],...s.wires.map(([a,b])=>[pairKey(a,b),`${terminalNames[a]} ↔ ${terminalNames[b]}`])]),button('remove','Retirer la liaison',!s.selectedWire),check('closed','Interrupteur fermé',s.closed),button('example','Charger une boucle à reconstituer'),button('clear','Retirer tous les fils')],
 act(s,id,v){const n=copy(s);if(['from','to'].includes(id))n[id]=choice(v,terminals,n[id]);if(id==='view')n.view=choice(v,['montage','schema'],n.view);if(id==='layout')n.layout=choice(v,['rectangle','croisee'],n.layout);if(id==='closed')n.closed=bool(v,n.closed);if(id==='toggle')n.closed=!n.closed;
 if(id==='terminal'&&terminals.includes(v)){if(n.pending){n.from=n.pending;n.to=v;n.pending='';id='connect';}else n.pending=v;}
 if(id==='connect'&&n.from!==n.to&&!n.wires.some(w=>pairKey(...w)===pairKey(n.from,n.to)))n.wires.push([n.from,n.to]);
 if(id==='selectedWire')n.selectedWire=choice(v,['',...n.wires.map(w=>pairKey(...w))],'');if(id==='remove'){n.wires=n.wires.filter(w=>pairKey(...w)!==n.selectedWire);n.selectedWire='';}
 if(id==='example'){n.wires=[['P+','L1'],['L2','S1'],['S2','P−']];n.closed=false;n.pending='';n.selectedWire='';}
 if(id==='clear'){n.wires=[];n.selectedWire='';n.pending='';}return n;},
 observe(s){const r=circuitResult(s);return commonObservation(r.status,[`${s.wires.length} liaison(s) explicite(s). Les deux vues partagent exactement ces connexions.`,s.pending?`Borne choisie : ${terminalNames[s.pending]}. Clique une deuxième borne.`:'Relie deux bornes par clics ou avec les listes.',s.layout==='croisee'?'Les fils qui se croisent ne sont pas reliés à leur croisement.':'La forme rectangulaire est une convention de lecture.',profile],[{label:'Interrupteur',value:s.closed?'fermé':'ouvert'},{label:'Courant de pile (modèle)',value:`${r.sourceCurrent.toFixed(3)} A`}],r.short?'Un fil contourne les récepteurs : court-circuit de la pile. Retire la liaison concernée.':'');},
 build(kit){const k=kitBase(kit,'a2'),real=group(k),diagram=group(k);const kr={...k,root:real},kd={...k,root:diagram};
 const b=battery(kr,-1.5,-.9),l=lamp(kr,1.25,-.9),sw=switchDevice(kr,0,1.3);
 const symbols={};for(const [name,x,z] of [['pile',-1.5,-.9],['lampe',1.25,-.9],['switch',0,1.3]]){symbols[name]=group(kd,x,z);}
 const line=(g,pts)=>wire(k,g,pts,'black');
 line(symbols.pile,[[-.28,.15,0],[-.22,.15,0]]);line(symbols.pile,[[.20,.15,0],[.28,.15,0]]);line(symbols.pile,[[-.22,.15,-.45],[-.22,.15,.45]]);line(symbols.pile,[[.20,.15,-.25],[.20,.15,.25]]);label(k,symbols.pile,'+       −',0,.15,.72);
 line(symbols.lampe,[[-.44,.15,0],[-.34,.15,0]]);line(symbols.lampe,[[.34,.15,0],[.44,.15,0]]);const tor=new k.T.Mesh(new k.T.TorusGeometry(.34,.022,8,36),k.m.black);tor.rotation.x=Math.PI/2;tor.position.y=.15;symbols.lampe.add(tor);line(symbols.lampe,[[-.23,.15,-.23],[.23,.15,.23]]);line(symbols.lampe,[[-.23,.15,.23],[.23,.15,-.23]]);
 const symLever=line(symbols.switch,[[-.42,.15,0],[.32,.15,-.3]]);const symClosed=line(symbols.switch,[[-.42,.15,0],[.42,.15,0]]);tag(symLever,'toggle');tag(symClosed,'toggle');
 const pins={};for(const t of terminals){pins[t]=post(k,real,0,.15,0,'terminal',t);label(k,pins[t],t,0,.10,.14,.35);const p=post(k,diagram,0,.15,0,'terminal',t);label(k,p,t,0,.10,.14,.35);pins['s'+t]=p;}
 const cables=[];for(let i=0;i<terminals.length;i++)for(let j=i+1;j<terminals.length;j++)cables.push({a:terminals[i],b:terminals[j],real:cable(k,real,i%2?'black':'red'),diagram:cable(k,diagram,'black')});
 return {k,real,diagram,b,l,sw,symbols,symLever,symClosed,pins,cables};},
 update(v,s){const {k}=v,r=circuitResult(s);v.real.visible=s.view==='montage';v.diagram.visible=s.view==='schema';const crossed=s.layout==='croisee';v.b.position.x=crossed?1.5:-1.5;v.l.g.position.x=crossed?-1.25:1.25;v.symbols.pile.position.x=v.b.position.x;v.symbols.lampe.position.x=v.l.g.position.x;
 const ps={'P+':[v.b.position.x-.28,.94,-.9],'P−':[v.b.position.x+.28,.94,-.9],'L1':[v.l.g.position.x-.44,.29,-.9],'L2':[v.l.g.position.x+.44,.29,-.9],'S1':[-.42,.30,1.3],'S2':[.42,.30,1.3]};
 for(const t of terminals){v.pins[t].position.set(...ps[t]);v.pins['s'+t].position.set(ps[t][0],.15,ps[t][2]);}
 v.cables.forEach((c,i)=>{const on=s.wires.some(w=>pairKey(...w)===pairKey(c.a,c.b));c.real.line.visible=c.diagram.line.visible=on;if(on){c.real.set(ps[c.a],ps[c.b],.12+(i%3)*.09);c.diagram.set([ps[c.a][0],.16+i*.002,ps[c.a][2]],[ps[c.b][0],.16+i*.002,ps[c.b][2]],0);}});
 // Les bornes schématiques sont reliées aux symboles par de petites lignes propres.
 v.sw.pivot.rotation.z=s.closed?0:.55;v.symClosed.visible=s.closed;v.symLever.visible=!s.closed;illuminate(v.l,r.brightness);k.invalidate();}
};

const materials={
 id:'E02-A3',
 initial:()=>({sample:'cuivre',contacts:true,healthy:true,verified:false,sensitive:false,mode:'sample',records:[]}),
 controls:s=>[button('verify','Vérifier le testeur avec le pont métallique'),select('sample','Échantillon',s.sample,Object.entries(samples).map(([id,m])=>[id,m.label])),button('insert','Insérer cet échantillon'),check('contacts','Deux pinces bien serrées',s.contacts),check('healthy','Lampe du testeur intacte',s.healthy),check('sensitive','Observer dans la pénombre (seuil réduit)',s.sensitive),button('record','Consigner cet essai'),button('clearRecords','Effacer les essais',!s.records.length)],
 act(s,id,v){const n=copy(s);if(id==='sample'){n.sample=choice(v,Object.keys(samples),n.sample);n.mode='sample';}if(id==='insert')n.mode='sample';if(id==='contacts')n.contacts=bool(v,n.contacts);if(id==='healthy'){n.healthy=bool(v,n.healthy);n.verified=false;}if(id==='sensitive')n.sensitive=bool(v,n.sensitive);if(id==='verify'){n.mode='reference';n.verified=sampleResult(n).lit;}if(id==='record'){const r=sampleResult(n);n.records.push({sample:n.mode==='reference'?'Pont témoin':samples[n.sample].label,lit:r.lit,conclusive:r.conclusive,threshold:r.threshold});n.records=n.records.slice(-12);}if(id==='clearRecords')n.records=[];return n;},
 observe(s){const r=sampleResult(s),sample=s.mode==='reference'?'Pont métallique témoin':samples[s.sample].label;
 return commonObservation(r.lit?'Un éclat est visible':'Aucun éclat visible',[`${sample} ; ${s.contacts?'contacts serrés':'une pince est décollée'}.`,r.conclusive?(r.lit?'Cet échantillon permet le passage détectable du courant.':'Ce test ne détecte pas de passage : il ne prouve pas une conductivité exactement nulle.'):'Conclusion suspendue : vérifier le testeur puis assurer les deux contacts.',`Scénario construit : R de l’échantillon = ${s.mode==='reference'?'0':samples[s.sample].r.toLocaleString('fr-FR')} Ω ; seuil visible ${r.threshold} W. Ces valeurs ne caractérisent pas tous les objets de ce matériau.`,...s.records.slice(-4).map(t=>`${t.sample} : ${t.lit?'éclat':'pas d’éclat'}${t.conclusive?'':' — non concluant'}.`),profile],[{label:'Testeur vérifié',value:s.verified?'oui':'non'},{label:'Puissance de lampe calculée',value:r.power<.0001?'< 0,0001 W':`${r.power.toFixed(4)} W`}],!s.healthy?'Le filament du testeur est rompu. Rétablis-le puis vérifie le testeur.':'');},
 build(kit){const k=kitBase(kit,'a3'),b=battery(k,-1.7,-.7),l=lamp(k,1.4,-.7,'Testeur'),holder=group(k,0,1.1);
 k.scene.rounded(holder,2.2,.10,.7,.06,k.m.ivory,0,.10,0);const sample=k.scene.box(holder,1.3,.14,.27,new k.T.MeshStandardMaterial({color:'#b66c41'}),0,.35,0);
 const left=tag(k.scene.box(holder,.42,.16,.2,k.m.metal,-.73,.37,0),'contacts',true),right=tag(k.scene.box(holder,.42,.16,.2,k.m.metal,.73,.37,0),'contacts',false);
 label(k,holder,'ÉCHANTILLON',0,.17,.47,1.6);wire(k,k.root,[[-1.98,.94,-.7],[-2,.12,1.1],[-.73,.37,1.1]]);wire(k,k.root,[[.73,.37,1.1],[1.84,.29,-.7]],'black');wire(k,k.root,[[.96,.29,-.7],[-1.42,.94,-.7]],'black');return {k,b,l,holder,sample,left,right};},
 update(v,s){const r=sampleResult(s);v.sample.material.color.set(s.mode==='reference'?'#bdcbd1':samples[s.sample].color);v.sample.scale.set(1,s.sample==='carton'&&s.mode!=='reference'?.3:1,1);v.right.position.x=s.contacts?.73:1.05;v.right.userData.workshopAction={id:'contacts',value:!s.contacts};illuminate(v.l,r.lit?r.brightness:0,s.healthy);v.k.invalidate();}
};

const cutaway={
 id:'E02-A4',
 initial:()=>({cut:true,intact:true,contact:'culot',connected:true,part:'filament'}),
 controls:s=>[check('cut','Voir la coupe intérieure',s.cut),check('intact','Filament intact',s.intact),check('connected','Brancher la pile au plot',s.connected),select('contact','Relier le second fil à…',s.contact,[['culot','Culot métallique'],['plot','Plot (les deux fils au même contact)'],['verre','Enveloppe de verre']]),select('part','Repérer une partie',s.part,[['plot','Plot'],['tige1','Tige issue du plot'],['filament','Filament'],['tige2','Tige vers le culot'],['culot','Culot'],['isolant','Isolant séparateur'],['verre','Verre']])],
 act(s,id,v){const n=copy(s);if(['cut','intact','connected'].includes(id))n[id]=bool(v,n[id]);if(id==='contact')n.contact=choice(v,['culot','plot','verre'],n.contact);if(id==='part')n.part=choice(v,['plot','tige1','filament','tige2','culot','isolant','verre'],n.part);return n;},
 observe(s){const lit=s.intact&&s.connected&&s.contact==='culot',short=s.connected&&s.contact==='plot';const detail={plot:'Le plot est une borne métallique distincte du culot.',tige1:'Cette tige relie le plot au filament.',filament:'Le courant chauffe le filament ; il devient incandescent.',tige2:'Cette tige relie le filament au culot.',culot:'Le culot est la deuxième borne métallique.',isolant:'Le séparateur empêche un contact direct entre plot et culot.',verre:'Le verre de l’enveloppe ne remplace pas une borne métallique.'};return commonObservation(lit?'Trajet complet : filament lumineux':short?'Deux fils sur le plot : court-circuit de la pile':'Le filament reste éteint',[detail[s.part],'Chaîne : plot → tige → filament → tige → culot.',s.intact?'Un filament intact ne suffit pas : ses deux bornes doivent être alimentées.':'La rupture ouvre le trajet intérieur même si le verre paraît intact.','Coupe explicative virtuelle, sans démontage réel ; aucune température ni durée de destruction prédite.',profile],[],short?'La pile est court-circuitée au plot. Ce trajet contourne entièrement le filament.':'');},
 build(kit){const k=kitBase(kit,'a4'),b=battery(k,-2,-.4),g=group(k,.6,0),parts={};
 k.scene.rounded(g,1.9,.12,1.4,.1,k.m.ivory,0,.12,0);
 const pm=(name,geo,mat,x,y,z)=>{const mesh=k.scene.mesh(g,geo,mat.clone(),x,y,z);parts[name]=mesh;tag(mesh,'part',name);return mesh;};
 pm('plot',new k.T.CylinderGeometry(.14,.14,.12,24),k.m.gold,0,.38,0);
 pm('isolant',new k.T.CylinderGeometry(.33,.33,.12,32),k.m.black,0,.49,0);
 pm('culot',new k.T.CylinderGeometry(.34,.34,.48,32,1,true,0,Math.PI*1.55),k.m.metal,0,.79,0);
 const tm=k.m.metal.clone();parts.tige1=k.scene.tube(g,[[0,.40,.08],[-.16,.68,.08],[-.16,1.52,.08],[-.28,1.67,.08]],.027,tm).mesh;parts.tige2=k.scene.tube(g,[[.33,.74,.08],[.16,.85,.08],[.16,1.52,.08],[.28,1.67,.08]],.027,tm.clone()).mesh;
 const fm=new k.T.MeshStandardMaterial({color:'#8a6b4c',emissive:'#ffba49',emissiveIntensity:0});parts.filament=k.scene.tube(g,[[-.28,1.67,.08],[-.2,1.82,.08],[-.1,1.65,.08],[0,1.82,.08],[.1,1.65,.08],[.2,1.82,.08],[.28,1.67,.08]],.027,fm).mesh;
 const broken=[];for(const points of [[[-.28,1.67,.08],[-.20,1.82,.08],[-.08,1.69,.08]],[[.08,1.69,.08],[.2,1.82,.08],[.28,1.67,.08]]])broken.push(k.scene.tube(g,points,.027,fm).mesh);
 const glassMat=new k.T.MeshPhysicalMaterial({color:'#c5e0e9',transparent:true,opacity:.22,roughness:.09,depthWrite:false,side:k.T.DoubleSide});parts.verre=pm('verre',new k.T.SphereGeometry(.66,32,20),glassMat,0,1.55,0);parts.verre.scale.y=1.2;
 for(const part of ['tige1','tige2','filament'])tag(parts[part],'part',part);
 const halo=new k.T.Mesh(new k.T.SphereGeometry(.4,16,12),new k.T.MeshBasicMaterial({color:'#ffd883',transparent:true,opacity:.25,depthWrite:false}));halo.position.set(0,1.7,0);g.add(halo);
 const light=new k.T.PointLight('#ffce79',0,4);light.position.set(.6,1.8,0);k.root.add(light);
 const lead1=cable(k,k.root),lead2=cable(k,k.root,'black');label(k,g,'PLOT • TIGES • FILAMENT • CULOT',0,.18,1.1,3.3);return {k,b,g,parts,broken,halo,light,lead1,lead2};},
 update(v,s){const lit=s.intact&&s.connected&&s.contact==='culot';v.parts.verre.material.opacity=s.cut?.075:.6;v.parts.culot.rotation.y=s.cut?Math.PI*.22:Math.PI;
 for(const [name,p] of Object.entries(v.parts)){if(p.material.emissive){p.material.emissive.set(name===s.part?'#2f83a3':'#000000');p.material.emissiveIntensity=name===s.part?.65:0;}}
 v.parts.filament.visible=s.intact;v.broken.forEach(p=>p.visible=!s.intact);v.parts.filament.material.emissive.set(lit?'#ffc257':'#000000');v.parts.filament.material.emissiveIntensity=lit?4:0;v.halo.visible=lit;v.light.intensity=lit?3:0;
 v.lead1.line.visible=s.connected;v.lead1.set([-2.28,.94,-.4],[.6,.4,.08]);const dest=s.contact==='culot'?[.93,.79,.08]:s.contact==='plot'?[.6,.4,.08]:[.12,1.7,.35];v.lead2.set([-1.72,.94,-.4],dest);v.k.invalidate();}
};

const diagnostic={
 id:'E02-A5',
 initial:()=>({challenge:'two',battery:'A',lamp:'L1',tests:[],testing:false}),
 controls:s=>[select('challenge','Défi déterministe',s.challenge,[['one','Une panne parmi les quatre pièces'],['two','Deux pannes parmi les quatre pièces']]),select('battery','Pile à essayer',s.battery,[['A','Pile A, inconnue'],['B','Pile B, inconnue'],['T','Pile témoin, connue bonne']]),select('lamp','Lampe à essayer',s.lamp,[['L1','Lampe L1, inconnue'],['L2','Lampe L2, inconnue'],['T','Lampe témoin, connue bonne']]),button('test','Fermer le circuit et noter cet essai'),button('open','Ouvrir le circuit'),button('clear','Recommencer ce défi')],
 act(s,id,v){let n=copy(s);if(id==='challenge'){n=diagnostic.initial();n.challenge=choice(v,['one','two'],s.challenge);}if(id==='battery'){n.battery=choice(v,['A','B','T'],n.battery);n.testing=false;}if(id==='lamp'){n.lamp=choice(v,['L1','L2','T'],n.lamp);n.testing=false;}if(id==='test'){const h=faults[n.challenge],lit=Boolean((n.battery==='T'||h[n.battery])&&(n.lamp==='T'||h[n.lamp]));n.tests=n.tests.filter(t=>t.battery!==n.battery||t.lamp!==n.lamp);n.tests.push({battery:n.battery,lamp:n.lamp,lit});n.testing=true;}if(id==='open')n.testing=false;if(id==='clear'){n.tests=[];n.testing=false;}return n;},
 observe(s){const d=diagnose(s),last=s.tests.find(t=>t.battery===s.battery&&t.lamp===s.lamp),lit=s.testing&&last?.lit;return commonObservation(s.testing?(lit?'Essai positif : lampe allumée':'Essai négatif : lampe éteinte'):'Choisis une substitution puis ferme le circuit',[`Hypothèse du défi : exactement ${faults[s.challenge].count} panne(s) parmi A, B, L1 et L2. Contacts et fils fiables ; pièces témoins bonnes.`,...s.tests.map(t=>`Pile ${t.battery==='T'?'témoin':t.battery} + lampe ${t.lamp==='T'?'témoin':t.lamp} : ${t.lit?'allumée':'éteinte'}.`),`Il reste ${d.hypotheses.length} état(s) compatible(s) avec les essais.`,`Un résultat positif confirme les deux pièces ; un résultat négatif seul peut laisser plusieurs causes.`,profile],Object.entries(d.states).map(([label,value])=>({label,value})),'',['État déduit des preuves',...Object.entries(d.states).map(([k,v])=>`${k} : ${v}`)]);},
 build(kit){const k=kitBase(kit,'a5'),batteries={},lamps={};for(const [i,name] of ['A','B','T'].entries()){batteries[name]=battery(k,-2+i*2,-1.0,name==='T'?'TÉMOIN':`PILE ${name}`);lamps[name==='T'?'T':`L${i+1}`]=lamp(k,-2+i*2,.95,name==='T'?'TÉMOIN':`L${i+1}`);tag(batteries[name],'battery',name);tag(lamps[name==='T'?'T':`L${i+1}`].g,'lamp',name==='T'?'T':`L${i+1}`);}
 const lead1=cable(k,k.root),lead2=cable(k,k.root,'black');return {k,batteries,lamps,lead1,lead2};},
 update(v,s){const b=v.batteries[s.battery],l=v.lamps[s.lamp],last=s.tests.find(t=>t.battery===s.battery&&t.lamp===s.lamp);Object.values(v.lamps).forEach(q=>illuminate(q,0));if(s.testing&&last?.lit)illuminate(l,seriesLamp().brightness);v.lead1.set([b.position.x-.28,.94,-1],[l.g.position.x-.44,.29,.95]);v.lead2.set([b.position.x+.28,.94,-1],[l.g.position.x+.44,.29,.95]);v.lead2.line.visible=s.testing;v.k.invalidate();}
};

const ring={
 id:'E02-A6',
 initial:()=>({x:-1.4,offset:0,material:'metal',connected:true}),
 controls:s=>[range('x','Avancer l’anneau',s.x,-1.4,1.4,.05),range('offset','Décaler l’anneau dans son plan',s.offset,-.245,.245,.005),button('center','Centrer l’anneau sans contact'),button('touch','Mettre l’anneau en contact'),select('material','Serpentin',s.material,[['metal','Métal conducteur'],['plastic','Plastique isolant']]),check('connected','Boucle reliée à la pile',s.connected)],
 act(s,id,v){const n=copy(s);if(id==='x')n.x=num(v,-1.4,1.4,n.x);if(id==='offset')n.offset=num(v,-.245,.245,n.offset);if(id==='center')n.offset=0;if(id==='touch')n.offset=.245;if(id==='material')n.material=choice(v,['metal','plastic'],n.material);if(id==='connected')n.connected=bool(v,n.connected);return n;},
 observe(s){const r=ringResult(s);return commonObservation(r.lit?'Contact électrique : la lampe s’allume':r.contact?'Contact mécanique sans signal lumineux':'L’anneau entoure le serpentin sans le toucher',[r.contact?'Le bord intérieur de l’anneau touche le serpentin.':'L’espace intérieur laisse passer le serpentin sans contact.',s.material==='metal'?'Le serpentin est conducteur.':'Le serpentin isolant ne ferme pas le trajet électrique.',s.connected?'La pile, la lampe et les deux conducteurs sont reliés.':'Une liaison avec la pile est retirée.','Géométrie construite : l’anneau suit la hauteur du serpentin. Décale-le jusqu’au bord pour établir un contact ; aucun score de vitesse.',profile],[{label:'Contact mécanique',value:r.contact?'oui':'non'},{label:'Lampe',value:r.lit?'allumée':'éteinte'}]);},
 build(kit){const k=kitBase(kit,'a6'),b=battery(k,-2.1,1.15),l=lamp(k,2.1,1.15),support=group(k);
 for(const x of [-1.65,1.65]){k.scene.rounded(support,.5,.12,.65,.07,k.m.ivory,x,.12,0);k.scene.cyl(support,.07,.09,1.03,k.m.wood,x,.65,0);}
 const sm=new k.T.MeshStandardMaterial({color:'#b8c5cf',metalness:.8,roughness:.25});const points=Array.from({length:57},(_,i)=>{const x=-1.4+i*2.8/56;return [x,ringHeight(x),0];});points.unshift([-1.65,1.1,0]);points.push([1.65,1.1,0]);const serpent=k.scene.tube(support,points,.04,sm,'',100).mesh;
 const rg=group(k);const torus=new k.T.Mesh(new k.T.TorusGeometry(.32,.035,12,48),k.m.metal);torus.rotation.y=Math.PI/2;rg.add(torus);tag(torus,'touch');
 const handle=k.scene.cyl(rg,.075,.075,.65,k.m.black,0,0,.65);handle.rotation.x=Math.PI/2;tag(handle,'center');
 const lead=cable(k,k.root,'black');wire(k,k.root,[[-2.38,.94,1.15],[-2,.11,-.5],[-1.65,1.1,0]]);wire(k,k.root,[[1.66,.29,1.15],[-1.82,.94,1.15]],'red');label(k,support,'ANNEAU • CONTACT • SIGNAL',0,.13,1.95,3);return {k,b,l,serpent,rg,lead};},
 update(v,s){const r=ringResult(s);v.serpent.material.color.set(s.material==='metal'?'#b8c5cf':'#ba6850');v.serpent.material.metalness=s.material==='metal'?.8:0;v.rg.position.set(s.x,ringHeight(s.x)+s.offset,0);v.lead.line.visible=s.connected;v.lead.set([s.x,ringHeight(s.x)+s.offset-.32,0],[2.54,.29,1.15],.08);illuminate(v.l,r.brightness);v.k.invalidate();}
};
export const workshops=[schema,materials,cutaway,diagnostic,ring];

// Reprise : refuser un brouillon incohérent sans le réparer silencieusement.
const object=s=>s!==null&&typeof s==='object'&&!Array.isArray(s);
const enums=(v,values)=>typeof v==='string'&&values.includes(v);
const flags=(s,keys)=>keys.every(k=>typeof s[k]==='boolean');
schema.valid=s=>object(s)&&flags(s,['closed'])&&enums(s.view,['montage','schema'])&&enums(s.layout,['rectangle','croisee'])&&enums(s.from,terminals)&&enums(s.to,terminals)&&enums(s.pending,['',...terminals])&&Array.isArray(s.wires)&&s.wires.length<=15&&s.wires.every(w=>Array.isArray(w)&&w.length===2&&w.every(t=>terminals.includes(t))&&w[0]!==w[1])&&new Set(s.wires.map(w=>pairKey(...w))).size===s.wires.length&&enums(s.selectedWire,['',...s.wires.map(w=>pairKey(...w))]);
materials.valid=s=>object(s)&&enums(s.sample,Object.keys(samples))&&enums(s.mode,['reference','sample'])&&flags(s,['contacts','healthy','verified','sensitive'])&&(!s.verified||s.healthy)&&Array.isArray(s.records)&&s.records.length<=12&&s.records.every(r=>object(r)&&enums(r.sample,['Pont témoin',...Object.values(samples).map(m=>m.label)])&&flags(r,['lit','conclusive'])&&[.001,.01].includes(r.threshold));
cutaway.valid=s=>object(s)&&flags(s,['cut','intact','connected'])&&enums(s.contact,['culot','plot','verre'])&&enums(s.part,['plot','tige1','filament','tige2','culot','isolant','verre']);
diagnostic.valid=s=>{
 if(!object(s)||!enums(s.challenge,['one','two'])||!enums(s.battery,['A','B','T'])||!enums(s.lamp,['L1','L2','T'])||!flags(s,['testing'])||!Array.isArray(s.tests)||s.tests.length>9)return false;
 const h=faults[s.challenge],seen=new Set();
 for(const t of s.tests){if(!object(t)||!enums(t.battery,['A','B','T'])||!enums(t.lamp,['L1','L2','T'])||typeof t.lit!=='boolean')return false;const key=t.battery+'|'+t.lamp;if(seen.has(key)||t.lit!==Boolean((t.battery==='T'||h[t.battery])&&(t.lamp==='T'||h[t.lamp])))return false;seen.add(key);}
 return !s.testing||seen.has(s.battery+'|'+s.lamp);
};
ring.valid=s=>object(s)&&Number.isFinite(s.x)&&s.x>=-1.4&&s.x<=1.4&&Number.isFinite(s.offset)&&s.offset>=-.245&&s.offset<=.245&&enums(s.material,['metal','plastic'])&&flags(s,['connected']);
