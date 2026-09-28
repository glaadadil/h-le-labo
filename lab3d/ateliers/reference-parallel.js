import {buildCircuit,updateCircuit,parallelPositions,validLayout} from './reference-models.js';
import {parallelWires,wiresFor,terminals,validWires,solveCircuit,lampRemoved} from './reference-circuit.js';
import {fmt} from './modules/electricite-common.js';

const copy=s=>JSON.parse(JSON.stringify(s));
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
const value=(n,unit)=>n===null?'—':`${fmt(n,3)} ${unit}`;
export function refineParallel(base){return {...base,reference:'circuit',parallel:true,
  build:kit=>buildCircuit(kit,true),update:updateCircuit,
  valid:s=>base.valid(s)&&validWires(s)&&validLayout(s,parallelPositions(s))&&(s.unscrewed===undefined||Array.isArray(s.unscrewed)&&s.unscrewed.length<=s.n&&new Set(s.unscrewed).size===s.unscrewed.length&&s.unscrewed.every(i=>Number.isInteger(i)&&i>=0&&i<s.n)),
  goal(s){const r=solveCircuit(s);return r.fault?'Retire le fil qui relie directement les deux bornes de l’alimentation.':(s.unscrewed??[]).length?'Observe les autres lampes, puis revisse celle que tu as retirée.':!s.main&&r.lit===0?'Referme l’interrupteur principal. Quelles lampes se rallument ?':!s.b0&&r.lit?'L1 est coupée. Observe L2, puis referme la branche de L1.':r.lit===s.n&&s.n>1?'Ouvre l’interrupteur de L1. Que devient la lampe L2 ?':'Construis un trajet pour chaque lampe, entre les deux bornes de l’alimentation.';},
  boardRule:'En dérivation : les branches sont indépendantes.',
  controls:s=>[
    {type:'button',id:'add',label:'Ajouter une branche montée',disabled:s.n>=3},
    {type:'button',id:'subtract',label:'Retirer la dernière branche',disabled:s.n<=1},
    {type:'button',id:'main',label:s.main?'Ouvrir l’interrupteur principal':'Fermer l’interrupteur principal'},
    ...Array.from({length:s.n},(_,i)=>({type:'button',id:`b${i}`,label:`${s[`b${i}`]?'Ouvrir':'Fermer'} la branche de L${i+1}`})),
    {type:'button',id:'unwire',label:'Enlever les fils pour monter moi-même le circuit'},
    {type:'button',id:'parallel',label:'Préparer le montage en dérivation'},
    {type:'button',id:'permute',label:'Échanger les places de L1 et L2 en gardant les fils',disabled:s.n<2},
    {type:'button',id:'arrange',label:'Ranger le matériel sur la table'}
  ],
  act(state,id,v){let s=copy(state);
    if(id==='move'&&v&&Object.hasOwn(parallelPositions(s),v.id)&&Number.isFinite(v.x)&&Number.isFinite(v.z)){s.layout={...s.layout,[v.id]:[bound(v.x,-5.5,5.5),bound(v.z,-2.5,3.3)]};return s;}
    if(id==='closed'||id==='main'){s.main=typeof v==='boolean'?v:!s.main;return s;}
    if(/^b[012]$/.test(id)){s[id]=typeof v==='boolean'?v:!s[id];return s;}
    if(id==='removeLamp'){const i=Number(v);if(Number.isInteger(i)&&i>=0&&i<s.n)s.unscrewed=lampRemoved(s,i)?s.unscrewed.filter(n=>n!==i):[...(s.unscrewed??[]),i];return s;}
    if(id==='unplug'){s.connections=copy(wiresFor(s));if(Number.isInteger(v)&&v>=0&&v<s.connections.length)s.connections.splice(v,1);return s;}
    if(id==='connect'&&v){s.connections=copy(wiresFor(s));const ports=terminals(s);if(ports.includes(v.a)&&ports.includes(v.b)&&v.a!==v.b&&s.connections.length<24&&!s.connections.some(w=>[w.a,w.b].includes(v.a)&&[w.a,w.b].includes(v.b)))s.connections.push({a:v.a,b:v.b});return s;}
    if(id==='unwire'){s.connections=[];return s;}
    if(id==='parallel'){s.connections=parallelWires(s);s.main=s.b0=s.b1=s.b2=true;s.unscrewed=[];return s;}
    if(id==='add'){if(s.n>=3)return s;const previous=s.n;s.n++;s[`b${previous}`]=true;s.connections=[...wiresFor(state),...parallelWires(s).filter(w=>[w.a,w.b].some(t=>t.startsWith(`B${previous}:`)||t.startsWith(`L${previous}:`)))];return s;}
    if(id==='subtract'){if(s.n<=1)return s;const removed=s.n-1;s.connections=wiresFor(s).filter(w=>![w.a,w.b].some(t=>t.startsWith(`B${removed}:`)||t.startsWith(`L${removed}:`)));s.n--;s.unscrewed=(s.unscrewed??[]).filter(i=>i<s.n);return s;}
    if(id==='n'){s=base.act(s,id,v);s.connections=parallelWires(s);s.unscrewed=(s.unscrewed??[]).filter(i=>i<s.n);return s;}
    if(id==='permute'||id==='swap'){if(s.n<2)return s;const positions=parallelPositions(s),a=s.layout?.L0??positions.L0,b=s.layout?.L1??positions.L1;s.layout={...s.layout,L0:[...b],L1:[...a]};s.swap=!s.swap;return s;}
    if(id==='arrange'){delete s.layout;s.swap=false;return s;}
    return base.act(s,id,v);
  },
  observe(s){const r=solveCircuit(s),title=r.fault?'Alimentation en défaut · court-circuit':r.lit===0?'Les lampes sont éteintes':r.lit===1?`L${r.lamps.findIndex(l=>l.p>1e-8)+1} est allumée`:`Les ${r.lit} lampes sont allumées`;
    const metrics=[{label:'Alimentation régulée',value:value(r.voltage,'V')},{label:'Courant total',value:value(r.current,'A')},...r.lamps.map((l,i)=>({label:`Courant L${i+1}`,value:value(l.i===null?null:Math.abs(l.i),'A')}))];
    return {title,metrics,boardMetrics:[...metrics.slice(0,2),{label:'Lampes allumées',value:r.fault?'—':`${r.lit} / ${s.n}`}],lines:[
      r.fault?'Un fil relie les deux bornes de l’alimentation sans récepteur. Retire ce fil : le modèle ne donne pas de mesure en court-circuit.':r.inParallel?'Chaque branche alimentée est reliée aux mêmes deux nœuds. Ouvrir une branche ou dévisser sa lampe laisse les autres fonctionner.':'Suis les fils pour vérifier les trajets. Les mesures suivent tes connexions, même si tu modifies le montage préparé.',
      'Touche un levier pour ouvrir ou fermer son contact. Touche une ampoule pour la dévisser ou la revisser. Saisis le socle ou l’étiquette pour déplacer la lampe.',
      'Sous la même tension de 6 V, chaque lampe L6 intacte reçoit 0,30 A et 1,80 W. Ajouter une branche augmente le courant total ; les autres lampes gardent ici leur éclat.',
      'Un croisement de fils ne crée aucun contact. Déplacer le matériel ne change pas le branchement. L’interrupteur principal coupe toutes les branches du montage préparé.',
      'Manuel p. 169–172 et 175–176. Alimentation régulée idéale 6 V, domaine 2 A ; lampes L6 identiques. Régime continu établi, fils idéaux, sans calcul thermique ni délai de destruction. Cette indépendance ne décrit pas une pile réelle à tension variable.'
    ],board:[],warning:r.fault?'Retire le court-circuit pour reprendre les mesures.':''};
  }
};}
