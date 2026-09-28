import {buildCircuit,updateCircuit,validLayout} from './reference-models.js';
import {solveCircuit,terminals,validWires} from './reference-circuit.js';
import {fmt} from './modules/electricite-common.js';

const copy=s=>JSON.parse(JSON.stringify(s));
const bounds=(n,a,b)=>Math.max(a,Math.min(b,n));
export const LONG_PRESS_MS=600;
export const examples={S:'...',O:'---',SOS:'...---...'};
const positions={pile:[-3.7,.5],L0:[3,-.6],interrupteur:[-.8,2.1]};
export const signalWires=()=>[{a:'pile:p',b:'interrupteur:a'},{a:'interrupteur:b',b:'L0:a'},{a:'L0:b',b:'pile:m'}];
export function signalCircuit(s){return {n:1,closed:s.pressed,removed:s.unscrewed?'0':'none',connections:s.connections??signalWires(),layout:s.layout,
  deviceNames:{pile:'Pile · 6 V',interrupteur:'Poussoir',L0:'Lampe témoin'},deviceStatus:{pile:'Pile pédagogique · 6 V',interrupteur:s.pressed?'Appuyé · relâcher pour ouvrir':'Maintenir le bouton pour allumer'}};}
export const canSignal=s=>solveCircuit(signalCircuit({...s,pressed:false})).lamps[0].p<1e-8&&solveCircuit(signalCircuit({...s,pressed:true})).lamps[0].p>1e-8;
export const classifyPulse=ms=>ms>=LONG_PRESS_MS?'-':'.';
const glyphs=pattern=>pattern.map(x=>x==='.'?'·':'−').join(' ');

function build(kit){
  const {T,scene}=kit;
  return buildCircuit(kit,false,{lampCount:1,removableBulbs:true,positions:()=>positions,
    wireLabelT:(i,v,s)=>{const w=s.connections[i];return w.a==='pile:p'||w.a==='L0:b'&&w.b==='pile:m'?.74:w.b==='pile:p'||w.b==='L0:b'&&w.a==='pile:m'?.26:.48;},
    labelAnchor:id=>new T.Vector3(0,.01,id==='interrupteur'?.82:id==='L0'?1.15:.8),
    addDevices(devices){
      const old=devices.interrupteur;old.g.traverse(o=>o.geometry?.dispose());old.g.removeFromParent();
      const g=new T.Group();g.scale.setScalar(1.17);kit.root.add(g);
      const helper=Object.create(Object.getPrototypeOf(scene));Object.assign(helper,{pins:{},materials:scene.materials,textures:scene.textures});
      scene.rounded(g,2.15,.25,1.25,.12,scene.mat('wood','#d3b083'),0,.14,0);
      for(const [t,x]of [['a',-.83],['b',.83]])helper.post(g,`interrupteur:${t}`,x,.32,-.2);
      const brass=scene.mat('brass','#b9a36c',{metalness:.85,roughness:.24});
      scene.box(g,1.35,.045,.12,brass,0,.3,-.2);
      scene.cyl(g,.32,.39,.12,scene.mat('silver','#c5d1d9'),0,.32,.13);
      const springRoot=new T.Group();springRoot.position.set(0,.38,.13);g.add(springRoot);
      const points=Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*12;return [Math.cos(a)*.17,i/96*.29,Math.sin(a)*.17];});
      scene.tube(springRoot,points,.018,scene.mat('silver','#c5d1d9'));
      const cap=new T.Group();cap.position.set(0,.78,.13);g.add(cap);
      scene.cyl(cap,.12,.12,.35,brass,0,-.19,0);
      scene.cyl(cap,.42,.44,.17,new T.MeshStandardMaterial({color:'#293e4d',roughness:.29,metalness:.15}),0,0,0);
      scene.cyl(cap,.31,.31,.012,new T.MeshStandardMaterial({color:'#3f6072',roughness:.43}),0,.092,0);
      cap.traverse(o=>{if(o.isMesh)o.userData.referencePress=true;});
      devices.interrupteur={g,s:{pressTarget:cap,springRoot},pins:helper.pins};
    }
  });
}
function update(v,s){updateCircuit(v,signalCircuit(s));const p=v.devices.interrupteur.s;p.pressTarget.position.y=s.pressed?.58:.78;p.springRoot.scale.y=s.pressed?.4:1;v.kit.invalidate();}

export function refineSignal(base){return {...base,reference:'circuit',directCircuit:true,momentary:true,circuitState:signalCircuit,build,update,
  restore:s=>({...s,pressed:false}),
  instruction:'Maintiens le bouton du poussoir, puis relâche. Saisis son socle ou son étiquette pour le déplacer.',
  boardTitle:'TRANSMETTRE PAR LA LUMIÈRE',boardRule:'Appuyer ferme le contact ; relâcher l’ouvre.',
  materialIntro:'La pile, la lampe et le poussoir forment un circuit. Maintiens le bouton sur la table pour allumer la lampe ; au relâchement, le ressort rouvre le contact. Tu peux déplacer les socles et refaire les fils.',
  schema:signalSchema,panelHTML:signalPanel,
  valid:s=>base.valid(s)&&validWires(signalCircuit(s))&&validLayout(s,positions)&&(s.unscrewed===undefined||typeof s.unscrewed==='boolean')&&(s.target===undefined||['libre',...Object.keys(examples)].includes(s.target))&&(s.checked===undefined||typeof s.checked==='boolean'),
  goal(s){const r=solveCircuit(signalCircuit(s));return r.short?'Un fil court-circuite la pile. Retire cette liaison avant d’émettre.':!s.pressed&&r.lit?'La lampe reste allumée : un fil contourne le poussoir. Revois le trajet.':!canSignal(s)?'Vérifie la lampe et les fils : le poussoir doit pouvoir fermer puis ouvrir le trajet.':'Appuie brièvement, puis plus longtemps. Quelle information la lumière peut-elle transmettre ?';},
  controls:s=>[{type:'button',id:'prepare',label:'Rebrancher le circuit de départ'},{type:'button',id:'unwire',label:'Enlever les fils pour construire mon montage'},{type:'button',id:'arrange',label:'Ranger les objets sur la table'},{type:'button',id:'removeLamp',label:s.unscrewed?'Revisser la lampe':'Dévisser la lampe'},{type:'button',id:'clear',label:'Effacer mon motif lumineux'}],
  act(state,id,v){const s=copy(state);
    if(id==='press'){s.pressed=true;return s;}
    if(id==='release'){
      const emitted=s.pressed&&canSignal(s);s.pressed=false;
      if(emitted&&s.pattern.length<16){const symbol=['.','-'].includes(v?.symbol)?v.symbol:Number.isFinite(v?.ms)&&v.ms>=0?classifyPulse(v.ms):s.duration==='long'?'-':'.';s.pattern.push(symbol);s.duration=symbol==='-'?'long':'court';s.checked=false;}
      return s;
    }
    if(id==='cancelPress'){s.pressed=false;return s;}
    if(id==='clear'){s.pattern=[];s.pressed=false;s.checked=false;return s;}
    if(id==='check'){s.checked=true;return s;}
    if(id.startsWith('target-')){const target=id.slice(7);if(['libre',...Object.keys(examples)].includes(target)){s.target=target;s.checked=false;}return s;}
    if(id==='sos'){s.target='SOS';s.checked=false;s.pressed=false;return s;}
    if(id==='removeLamp'){s.unscrewed=!s.unscrewed;return s;}
    if(id==='prepare'){s.connections=signalWires();s.unscrewed=false;s.pressed=false;return s;}
    if(id==='unwire'){s.connections=[];return s;}
    if(id==='arrange'){delete s.layout;return s;}
    if(id==='move'&&v&&Object.hasOwn(positions,v.id)&&Number.isFinite(v.x)&&Number.isFinite(v.z)){s.layout={...s.layout,[v.id]:[bounds(v.x,-5.5,5.5),bounds(v.z,-2.5,3.3)]};return s;}
    if(id==='unplug'){s.connections=copy(signalCircuit(s).connections);if(Number.isInteger(v)&&v>=0&&v<s.connections.length)s.connections.splice(v,1);return s;}
    if(id==='connect'&&v){const c=signalCircuit(s),ports=terminals(c);s.connections=copy(c.connections);if(ports.includes(v.a)&&ports.includes(v.b)&&v.a!==v.b&&s.connections.length<24&&!s.connections.some(w=>[w.a,w.b].includes(v.a)&&[w.a,w.b].includes(v.b)))s.connections.push({a:v.a,b:v.b});return s;}
    return base.act(s,id,v);
  },
  observe(s){const r=solveCircuit(signalCircuit(s));return {title:r.short?'Court-circuit de la pile':r.lit?(s.pressed?'Poussoir appuyé · lampe allumée':'Lampe allumée · poussoir contourné'):(s.pressed?'Poussoir appuyé · lampe éteinte':'Poussoir relâché · lampe éteinte'),
    metrics:[{label:'Tension de la pile',value:`${fmt(r.voltage,2)} V`},{label:'Courant',value:`${fmt(r.current,3)} A`},{label:'Puissance de la lampe',value:`${fmt(r.lamps[0].p,3)} W`},{label:'Motif lumineux',value:glyphs(s.pattern)||'Aucun signal'}],
    boardMetrics:[{label:'Contact',value:s.pressed?'Fermé':'Ouvert'},{label:'Lampe',value:r.lit?'Allumée':'Éteinte'},{label:'Signaux gardés',value:`${s.pattern.length} / 16`}],
    lines:['Un poussoir maintient son contact fermé pendant l’appui. Relâcher le bouton rouvre le trajet dans le circuit préparé.',
      'Un appui bref produit un point ; un appui prolongé, un trait. Le seuil de 0,6 seconde est un repère pédagogique de cette application, pas une vitesse Morse imposée. Les boutons « signal court » et « signal long » permettent de composer sans contrainte de geste.',
      'Références : S = · · · ; O = − − − ; SOS = · · · − − − · · ·. La comparaison porte sur la suite des signaux, sans noter les pauses entre lettres. Aucun score de rapidité ni compte à rebours.',
      'Le motif conserve jusqu’à 16 signaux réellement commandés par le poussoir. Si la lampe est débranchée ou si le poussoir est contourné, aucun nouveau signal n’est enregistré. Une interruption de l’appui par Échap, une perte de focus ou un changement d’atelier relâche le contact sans ajouter de symbole.',
      'Manuel p. 173–174 : contact et transmission d’information. Adaptation avec une lampe compatible. Pile pédagogique 6 V, résistance interne 1 Ω ; lampe L6, U = 10 I + (100/3) I |I|. Régime continu établi, fils idéaux, sans simulation thermique. La rémanence d’une lampe réelle n’est pas représentée.'
    ],warning:r.short?'Retire la liaison qui contourne les récepteurs.':''};}
};}

export function signalPanel(s){const target=s.target??'libre',expected=examples[target],correct=expected===s.pattern.join('');
  const option=(value,label)=>`<button data-reference="lesson" data-value="target-${value}" aria-pressed="${target===value}">${label}</button>`;
  return `<section class="signal-panel" aria-label="Mon motif lumineux"><div class="signal-examples"><span>Exemple :</span>${option('libre','Libre')}${option('S','S')}${option('O','O')}${option('SOS','SOS')}${expected?`<span class="signal-target"><strong>${glyphs([...expected])}</strong></span>`:''}</div><div class="signal-pattern" aria-label="${s.pattern.length?glyphs(s.pattern):'Aucun signal enregistré'}">${s.pattern.length?s.pattern.map((x,i)=>`<span class="signal-mark ${x==='-'?'long':''}" aria-label="Signal ${i+1} : ${x==='-'?'long':'court'}"></span>`).join(''):'<span>Mon motif apparaîtra ici</span>'}${s.pressed?'<span class="signal-live">Appui en cours</span>':''}</div><div class="signal-actions"><button data-reference="emit" data-value=".">· Signal court</button><button data-reference="emit" data-value="-">− Signal long</button><button data-reference="lesson" data-value="clear" ${!s.pattern.length?'disabled':''}>Effacer</button>${expected?'<button data-reference="lesson" data-value="check">Comparer</button>':''}</div>${s.pattern.length===16?'<p>Mémoire pleine : conserve cet essai ou efface le motif.</p>':''}${s.checked&&expected?`<p class="signal-feedback" role="status">${correct?`Le motif correspond à ${target}.`:'Compare les points et les traits avec l’exemple, puis réessaie à ton rythme.'}</p>`:''}</section>`;
}
function signalSchema(s){const c=signalCircuit(s),points={'pile:p':[85,130],'pile:m':[85,220],'interrupteur:a':[300,100],'interrupteur:b':[380,100],'L0:a':[580,170],'L0:b':[580,250]};let art='';
  for(const [i,w]of c.connections.entries()){const a=points[w.a],b=points[w.b];art+=`<path d="M${a} L${b}" stroke="#405668" stroke-width="3" fill="none"><title>Fil F${i+1}</title></path>`;}
  art+='<g fill="#fffdf6" stroke="#263f4b" stroke-width="3"><path d="M85 130V164 M85 187V220 M60 164H110 M70 187H100"/>';
  art+=`<path d="M300 100H315 M365 100H380 M315 ${s.pressed?100:78}H365 M340 ${s.pressed?100:78}V55 M325 55H355"/><circle cx="315" cy="100" r="4"/><circle cx="365" cy="100" r="4"/>`;
  art+=`<path d="M580 170V187 M580 233V250"/><circle cx="580" cy="210" r="23" ${s.unscrewed?'stroke-dasharray="4 5"':''}/>${s.unscrewed?'':'<path d="M564 194L596 226 M564 226L596 194"/>'}</g>`;
  art+='<g fill="#263f4b" font-size="18"><text x="120" y="183">Pile · 6 V</text><text x="280" y="40">Poussoir</text><text x="620" y="218">Lampe</text></g>';
  return `<p>Le poussoir ferme le contact seulement pendant l’appui. Les fils représentent les connexions actuelles de ta table ; leurs croisements ne créent aucun contact.</p><svg viewBox="0 0 740 300" role="img" aria-label="Circuit à poussoir et lampe témoin">${art}</svg>`;
}
