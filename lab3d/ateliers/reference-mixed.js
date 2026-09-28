import {buildCircuit,updateCircuit,validLayout} from './reference-models.js';
import {terminals,validWires,solveCircuit,lampRemoved} from './reference-circuit.js';
import {fmt} from './modules/electricite-common.js';

const copy=s=>JSON.parse(JSON.stringify(s));
const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
const types=['serie','derivation','mixte'];
const titles={serie:'Montage en série',derivation:'Montage en dérivation',mixte:'Montage mixte'};
const positions={pile:[-4.2,-1.35],interrupteur:[-3.5,2.3],L0:[-.8,-1.3],L1:[3,-1.2],L2:[1.1,1.9]};
const value=(n,unit)=>n===null?'—':`${fmt(n,3)} ${unit}`;
export const branches=type=>type==='serie'?[[0,1,2]]:type==='derivation'?[[0],[1],[2]]:[[0,1],[2]];
export function topologyWires(type){
  const wires=[{a:'pile:p',b:'interrupteur:a'}];
  for(const branch of branches(type)){
    let previous='interrupteur:b';
    for(const i of branch){wires.push({a:previous,b:`L${i}:a`});previous=`L${i}:b`;}
    wires.push({a:previous,b:'pile:m'});
  }
  return wires;
}
// Keep the old draft's boolean `layout` and single removed lamp readable.
// The engine receives a separate view of the state; stored trials stay intact.
export function circuitState(s){
  const layout=s.placements??(s.layout?{L0:positions.L1,L1:positions.L0}:{});
  return {...s,n:3,main:s.closed??true,branchSwitches:false,layout,
    unscrewed:s.unscrewed??(s.removed==='none'?[]:[Number(s.removed)]),
    connections:s.connections??topologyWires(s.topology)};
}
const edge=w=>[w.a,w.b].sort().join('|');
export function activeTopology(s){
  const actual=circuitState(s).connections.map(edge).sort().join(';');
  return types.find(t=>topologyWires(t).map(edge).sort().join(';')===actual)??null;
}
export function refineMixed(base){return {...base,reference:'circuit',directCircuit:true,circuitState,
  build:kit=>buildCircuit(kit,true,{branchSwitches:false,positions:()=>positions}),
  update:(v,s)=>updateCircuit(v,circuitState(s)),
  boardTitle:'TROIS LAMPES · SUIVRE LES CONNEXIONS',
  boardRule:'Suivre les fils : la position ne définit pas le montage.',
  materialIntro:'Trois lampes identiques et une alimentation de 6 V. Prépare un montage, puis modifie ses fils sur la table. Déplacer une lampe conserve ses connexions.',
  presets:types.map(value=>({value,label:titles[value].replace('Montage ','')})),
  activePreset:activeTopology,schema:mixedSchema,
  valid(s){return base.valid(s.trace==='branche3'?{...s,trace:'branche2'}:s)&&(s.closed===undefined||typeof s.closed==='boolean')&&validWires(circuitState(s))&&validLayout({layout:s.placements},positions)&&(s.unscrewed===undefined||Array.isArray(s.unscrewed)&&new Set(s.unscrewed).size===s.unscrewed.length&&s.unscrewed.every(i=>Number.isInteger(i)&&i>=0&&i<3));},
  goal(s){const r=solveCircuit(circuitState(s)),type=activeTopology(s);
    if(r.fault)return 'Retire la liaison directe entre les deux bornes de l’alimentation.';
    if(!(s.closed??true)&&r.lit===0)return 'Referme le levier pour alimenter le montage.';
    if(circuitState(s).unscrewed.length)return 'Observe quelles lampes restent allumées, puis revisse l’ampoule.';
    if(!type)return 'Construis tes trajets. Une lampe s’allume quand un trajet fermé l’alimente.';
    return 'Dévisse l’ampoule L1. Que deviennent L2 et L3 ? Compare ensuite les trois montages.';
  },
  controls:s=>[
    ...types.map(t=>({type:'button',id:`prepare-${t}`,label:`Préparer le ${titles[t].toLowerCase()}`})),
    {type:'button',id:'closed',label:(s.closed??true)?'Ouvrir l’interrupteur':'Fermer l’interrupteur'},
    ...[0,1,2].map(i=>({type:'button',id:`bulb-${i}`,label:`${lampRemoved(circuitState(s),i)?'Revisser':'Dévisser'} L${i+1}`})),
    {type:'button',id:'unwire',label:'Enlever les fils pour construire mon montage'},
    {type:'button',id:'layout',label:'Échanger les places de L1 et L2, en gardant leurs fils'},
    {type:'button',id:'arrange',label:'Ranger les objets sur la table'}
  ],
  act(state,id,v){const s=copy(state),c=circuitState(s);
    if(id.startsWith('prepare-')){v=id.slice(8);id='topology';}
    if(id.startsWith('bulb-')){v=id.slice(5);id='removeLamp';}
    if(id==='trace'&&['aucun','branche1','branche2','branche3','noeuds'].includes(v)){s.trace=v;return s;}
    if(id==='topology'&&types.includes(v)){s.topology=v;s.connections=topologyWires(v);s.closed=true;s.unscrewed=[];s.removed='none';s.trace='aucun';return s;}
    if(id==='move'&&v&&Object.hasOwn(positions,v.id)&&Number.isFinite(v.x)&&Number.isFinite(v.z)){s.placements={...c.layout,[v.id]:[bound(v.x,-5.5,5.5),bound(v.z,-2.5,3.3)]};return s;}
    if(id==='closed'){s.closed=typeof v==='boolean'?v:!c.main;return s;}
    if(id==='removeLamp'){const i=Number(v);if(Number.isInteger(i)&&i>=0&&i<3){s.unscrewed=c.unscrewed.includes(i)?c.unscrewed.filter(n=>n!==i):[...c.unscrewed,i];s.removed=s.unscrewed.length===1?String(s.unscrewed[0]):'none';}return s;}
    if(id==='removed'){if(['none','0','1','2'].includes(v)){s.removed=v;s.unscrewed=v==='none'?[]:[Number(v)];}return s;}
    if(id==='connect'&&v){const ports=terminals(c);s.connections=copy(c.connections);if(ports.includes(v.a)&&ports.includes(v.b)&&v.a!==v.b&&s.connections.length<24&&!s.connections.some(w=>edge(w)===edge(v)))s.connections.push({a:v.a,b:v.b});s.trace='aucun';return s;}
    if(id==='unplug'){s.connections=copy(c.connections);if(Number.isInteger(v)&&v>=0&&v<s.connections.length)s.connections.splice(v,1);s.trace='aucun';return s;}
    if(id==='unwire'){s.connections=[];s.trace='aucun';return s;}
    if(id==='layout'){const a=c.layout.L0??positions.L0,b=c.layout.L1??positions.L1;s.placements={...c.layout,L0:[...b],L1:[...a]};s.layout=!s.layout;return s;}
    if(id==='arrange'){delete s.placements;s.layout=false;return s;}
    return base.act(s,id,v);
  },
  observe(s){const c=circuitState(s),r=solveCircuit(c),type=activeTopology(s),mode=type?titles[type]:'Montage libre';
    const title=r.fault?'Alimentation en défaut · court-circuit':`${mode} · ${r.lit} lampe${r.lit>1?'s':''} allumée${r.lit>1?'s':''}`;
    const metrics=[{label:'Tension de la source',value:value(r.voltage,'V')},{label:'Courant total',value:value(r.current,'A')},...r.lamps.flatMap((l,i)=>[{label:`Tension L${i+1}`,value:value(l.u===null?null:Math.abs(l.u),'V')},{label:`Courant L${i+1}`,value:value(l.i===null?null:Math.abs(l.i),'A')},{label:`Puissance L${i+1}`,value:value(l.p,'W')}])];
    return {title,metrics,boardMetrics:r.lamps.map((l,i)=>({label:`Lampe L${i+1}`,value:r.fault?'—':c.unscrewed.includes(i)?'Dévissée':l.p>1e-8?'Allumée':'Éteinte'})),lines:[
      type==='mixte'?'L1 et L2 se suivent dans une même branche. Cette branche est en dérivation avec L3. Dévisser L1 coupe L1 et L2 ; L3 possède encore son trajet.':type==='serie'?'Les trois lampes se suivent dans un seul trajet. Dévisser l’une d’elles ouvre ce trajet et éteint les trois.':type==='derivation'?'Chaque lampe possède sa branche entre les mêmes deux nœuds. Dévisser l’une laisse les deux autres alimentées.':'Les mesures suivent les fils que tu as réellement branchés. Consulte le schéma pour examiner chaque trajet.',
      'Prévois le résultat avant de dévisser une ampoule. Observe les autres, revisse-la, puis essaie un autre montage.',
      'Déplace les socles : la disposition peut changer sans modifier les connexions. Un croisement de fils ne crée pas de contact.',
      'Dans Schéma, suis les branches ou repère les deux nœuds communs. Un nœud regroupe des bornes reliées idéalement ; il ne se réduit pas à un point de croisement dessiné.',
      'Manuel p. 171–172 et 175–178, adaptation interactive. Alimentation régulée idéale de 6 V, domaine 2 A ; lampes L6 identiques : U = 10 I + (100/3) I |I|. Régime continu établi, fils idéaux, sans échauffement ni destruction simulés.'
    ],warning:r.fault?'Court-circuit : retire la liaison qui contourne les lampes. Les mesures ne sont pas définies dans ce cas.':''};
  }
};}

export function mixedSchema(raw){
  const s=circuitState(raw),type=activeTopology(raw),display=type??raw.topology;
  const coords={pile:[90,240],interrupteur:[235,75]};
  if(display==='mixte')Object.assign(coords,{L0:[390,170],L1:[390,330],L2:[665,245]});
  else if(display==='serie')Object.assign(coords,{L0:[545,145],L1:[545,270],L2:[545,395]});
  else Object.assign(coords,{L0:[360,265],L1:[535,265],L2:[710,265]});
  const point=t=>{const [id,p]=t.split(':'),[x,y]=coords[id],offset=p==='a'||p==='p'?-35:35;return id==='interrupteur'?[x+offset,y]:[x,y+offset];};
  const selected=raw.trace==='branche1'?0:raw.trace==='branche2'?1:raw.trace==='branche3'?2:-1;
  const pathLamps=type?branches(type)[selected]??[]:[];
  const highlighted=new Set();
  if(pathLamps.length){let previous='interrupteur:b';for(const i of pathLamps){highlighted.add(edge({a:previous,b:`L${i}:a`}));previous=`L${i}:b`;}highlighted.add(edge({a:previous,b:'pile:m'}));}
  // Equipotential node membership includes the actual closed main contact.
  const ports=terminals(s),parent=Object.fromEntries(ports.map(t=>[t,t]));
  const find=t=>parent[t]===t?t:(parent[t]=find(parent[t]));
  const join=(a,b)=>parent[find(a)]=find(b);
  s.connections.forEach(w=>join(w.a,w.b));if(s.main)join('interrupteur:a','interrupteur:b');
  const nodeColor=t=>find(t)===find('pile:p')?'#a0322d':find(t)===find('pile:m')?'#286b99':'#536270';
  let art='';
  s.connections.forEach((w,i)=>{
    const ends=[w.a,w.b],input=ends.find(t=>/^L\d:a$/.test(t)),output=ends.find(t=>/^L\d:b$/.test(t));let route=[point(w.a),point(w.b)];
    if(ends.includes('pile:p')&&ends.includes('interrupteur:a'))route=[point('pile:p'),[90,75],point('interrupteur:a')];
    else if(ends.includes('interrupteur:b')&&input){const p=point(input);route=[point('interrupteur:b'),[p[0],75],p];}
    else if(ends.includes('pile:m')&&output){const p=point(output);route=[p,[p[0],460],[90,460],point('pile:m')];}
    const color=raw.trace==='noeuds'?nodeColor(w.a):highlighted.has(edge(w))?'#b47620':'#405668';
    art+=`<path d="M${route.map(p=>p.join(' ')).join(' L')}" fill="none" stroke="${color}" stroke-width="${highlighted.has(edge(w))?5:3}" stroke-linejoin="round"><title>Fil F${i+1}</title></path>`;
  });
  for(const [id,[x,y]]of Object.entries(coords)){
    const bulb=id.startsWith('L'),i=Number(id.slice(1)),removed=bulb&&lampRemoved(s,i);
    art+=`<g transform="translate(${x} ${y}) rotate(${id==='interrupteur'?0:90})" stroke="${pathLamps.includes(i)?'#b47620':'#263f4b'}" stroke-width="3" fill="#fffdf6">`;
    if(id==='pile')art+='<path d="M-35 0H-22 M22 0H35"/><circle r="22"/><path d="M-13 0h10 M-8 -5v10 M7 0h9"/>';
    else if(id==='interrupteur')art+=`<path d="M-35 0H-20 L20 ${s.main?0:-24} M20 0H35"/><circle cx="-20" r="4"/><circle cx="20" r="4"/>`;
    else if(removed)art+='<path d="M-35 0H-28 M28 0H35"/><circle r="22" stroke-dasharray="4 5" opacity=".4"/>';
    else art+='<path d="M-35 0H-22 M22 0H35"/><circle r="22"/><path d="M-15 -15L15 15 M-15 15L15 -15"/>';
    art+=`</g><text x="${id==='interrupteur'?x:x+40}" y="${id==='interrupteur'?y-37:y+5}" text-anchor="${id==='interrupteur'?'middle':'start'}" fill="#263f4b" font-size="18">${id==='pile'?'6 V':id==='interrupteur'?'Interrupteur':`L${i+1}${removed?' dévissée':''}`}</text>`;
  }
  if(raw.trace==='noeuds')for(const t of ports){const [x,y]=point(t);art+=`<circle cx="${x}" cy="${y}" r="5" fill="${nodeColor(t)}" stroke="white"/>`;}
  const commands=[['aucun','Sans surlignage'],...(type?[['branche1',display==='serie'?'Le trajet':'Branche de L1'],...(display!=='serie'?[['branche2',display==='mixte'?'Branche de L3':'Branche de L2'],...(display==='derivation'?[['branche3','Branche de L3']]:[])]:[])]:[]),['noeuds','Nœuds de la source']];
  return `<p><strong>${type?titles[type]:'Mes connexions libres'}</strong>. Les contacts et ampoules représentent l’état de ta table. Un croisement seul ne crée pas de connexion.</p><div class="reference-schema-controls">${commands.map(([v,label])=>`<button data-reference="trace" data-value="${v}" aria-pressed="${raw.trace===v}">${label}</button>`).join('')}</div><svg viewBox="0 20 875 490" role="img" aria-label="Schéma des connexions réelles des trois lampes">${art}</svg><p>${raw.trace==='noeuds'?'Rouge : nœud de la borne + ; bleu : nœud de la borne −. Les bornes reliées idéalement appartiennent au même nœud. En court-circuit, les deux nœuds se confondent.':selected>=0?'Le surlignage suit les fils de la branche choisie, même si une ampoule est dévissée. Un trajet ouvert ne conduit pas le courant.':'Déplace les lampes sur la table, puis reviens au schéma : déplacer un objet ne change pas ses connexions.'}</p>`;
}
