/* E01/E07 — original educational models with physical gestures and documentary cards.
 * No changes to source resistance, filament law, fuse threshold or fault inventory.
 */
import {group,base as makeKit,fmt,digital} from './modules/electricite-common.js';
import {chains,chainCorrect,networkState} from './modules/e01.js';
import {diagnosticState,diagnosis,shortState,fuseState,openVoltage} from './modules/e07.js';
import {enhanceElectricalView,updateElectricalDetails,placeElectricalProbe,updateProbeLeads} from './natural-electricite.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=(id,label,object,controls=[],extra={})=>({id,label,object,controls,...extra});
const fixed=(id,label,object,controls=[],extra={})=>e(id,label,object,controls,{movable:false,...extra});
const click=(id,value)=>({click:{id,value}});
const drop=(target,action,value)=>({target,action,value});
const op=(id,value)=>({id,value});
const seq=(...steps)=>({id:'naturalContextSteps',value:steps});
const seqDrop=(target,...steps)=>drop(target,'naturalContextSteps',steps);
function card(k,x,z,color=k.m.light){const g=group(k,x,z);k.scene.rounded(g,1.1,.08,.72,.055,color,0,.08,0);k.scene.box(g,.24,.03,.12,k.m.metal,0,.15,-.27);for(let i=0;i<3;i++)k.scene.box(g,.69-i*.1,.008,.015,k.m.body,0,.13,-.12+i*.15);return g;}
function cord(k,x,z){const g=group(k,x,z);k.scene.tube(g,[[-.55,.14,.24],[-.6,.12,-.3],[0,.12,-.5],[.6,.12,-.25],[.55,.14,.24]],.035,k.m.black);for(const a of [-.55,.55]){k.scene.cyl(g,.07,.07,.22,k.m.red,a,.18,.24);k.scene.cyl(g,.035,.035,.18,k.m.metal,a,.37,.24);}return g;}
function probe(k,x,z,color){const g=group(k,x,z);g.userData.probeCableY=.11;k.scene.cyl(g,.07,.07,.65,color,0,.43,0);k.scene.cyl(g,.095,.095,.065,k.m.black,0,.72,0);k.scene.cyl(g,.022,.028,.36,k.m.metal,0,.94,0);k.scene.mesh(g,new k.T.ConeGeometry(.023,.08,12),k.m.metal,0,1.16,0);g.rotation.z=-.65;return g;}
function twinProbes(k,x,z){const g=group(k,x,z);for(const [dx,color]of [[-.19,k.m.red],[.19,k.m.black]]){const p=probe({...k,root:g},dx,0,color);p.rotation.x=Math.PI/2;p.rotation.z=0;p.position.y=.17;}return g;}
function fuse(k,x,z){const g=group(k,x,z);k.scene.cyl(g,.14,.14,.95,new k.T.MeshPhysicalMaterial({color:'#e0edf0',transparent:true,opacity:.2,depthWrite:false,roughness:.1}),0,.23,0).rotation.z=Math.PI/2;for(const a of [-.46,.46])k.scene.cyl(g,.145,.145,.16,k.m.metal,a,.23,0).rotation.z=Math.PI/2;k.scene.box(g,.83,.022,.022,k.m.gold,0,.23,0);return g;}
function terminal(k,xyz){const g=group(k,xyz[0],xyz[2]);g.position.y=xyz[1];k.scene.cyl(g,.085,.095,.05,k.m.gold,0,.005,0);const ring=k.scene.mesh(g,new k.T.TorusGeometry(.105,.018,10,36),k.m.blue,0,.055,0);ring.rotation.x=Math.PI/2;return g;}
function loupe(k,x,z){const g=group(k,x,z);const ring=k.scene.mesh(g,new k.T.TorusGeometry(.38,.045,12,40),k.m.metal,0,.14,0);ring.rotation.x=Math.PI/2;k.scene.cyl(g,.34,.34,.02,new k.T.MeshPhysicalMaterial({color:'#eef8ff',transparent:true,opacity:.15,depthWrite:false}),0,.14,0);const h=k.scene.cyl(g,.06,.06,.58,k.m.black,0,.12,.58);h.rotation.x=Math.PI/2;return g;}
function knob(k,x,z){const g=group(k,x,z);k.scene.rounded(g,.65,.13,.52,.07,k.m.light,0,.12,0);k.scene.cyl(g,.2,.2,.12,k.m.black,0,.25,0);k.scene.box(g,.03,.02,.16,k.m.light,0,.32,-.04);return g;}
const names={lampe:'Lampe à filament',chauffage:'Radiateur',ventilateur:'Ventilateur',tramway:'Tramway',telephone:'Téléphone',sechecheveux:'Sèche-cheveux'};
const stageNames={eau:'Eau en mouvement',turbine:'Turbine',alternateur:'Alternateur',vent:'Vent',rotor:'Rotor d’éolienne',combustible:'Combustible',chaudiere:'Chaudière',vapeur:'Vapeur',fission:'Chaleur nucléaire',soleil:'Rayonnement solaire',panneau:'Panneau photovoltaïque'};
const effects=['lumiere','chaleur','mouvement','communication'];
const effectNames={lumiere:'Lumière',chaleur:'Chaleur',mouvement:'Mouvement',communication:'Communication'};
const points=['A','B','C','D','E','F'];
const partNames={AB:'Fil AB',BC:'Filament BC',CD:'Fil CD',DE:'Contact DE',EF:'Fil EF',FA:'Source FA'};
function pool(s){return [...new Set([...chains[s.type],s.type==='photovoltaique'?'turbine':'panneau'])];}
const configs={
'E01-A1':{
 goal:s=>!s.power?'Allume l’appareil, puis observe ses effets.':'Associe les cartes des effets observés à cet appareil.',
 hint:'Maquette documentaire : interrupteur au toucher, cartes à déposer sur l’appareil. Une étape montre son fonctionnement.',
 build(v,k){v.tools.power=knob(k,-2.8,0);v.tools.next=card(k,2.8,0);effects.forEach((id,i)=>v.tools[id]=card(k,-3.3+i*2.2,1.9));v.tools.compare=card(k,0,-1.7);},
 entities(s,v){return [fixed('device',names[s.device],v.gs[s.device],['device','step']),fixed('power',s.power?'Interrupteur · marche':'Interrupteur · arrêt',v.tools.power,['power'],click('power',!s.power)),fixed('step','Observer une étape',v.tools.next,['step'],click('step')),fixed('compare','Comparer les associations',v.tools.compare,['compare'],click('compare')),...effects.map(id=>e(id,(s[id]?'✓ ':'')+effectNames[id],v.tools[id],[id],{drop:[drop('device',id,!s[id])],...click(id,!s[id])}))];}},
'E01-A2':{
 goal:s=>!s.chain.length?'Pose la première étape de la chaîne de conversion.':chainCorrect(s)?'Suis le transfert et compare lorsque la source devient indisponible.':'Dépose les étapes dans l’ordre source → conversion → énergie électrique.',
 hint:'Les cartes composent une maquette documentaire. Choisis l’installation, puis dépose les étapes sur le plan.',
 build(v,k){v.tools.cards={};Object.keys(stageNames).forEach(id=>v.tools.cards[id]=card(k,0,0));v.tools.plan=card(k,3.1,-.1);v.tools.source=knob(k,-3.2,-1.1);},
 update(v,s){const ids=pool(s);Object.entries(v.tools.cards).forEach(([id,g])=>{const i=ids.indexOf(id);g.visible=i>=0&&!s.chain.includes(id);if(i>=0)g.position.set(-2.8+(i%3)*2.1,0,i<3?1.3:2.45);});Object.values(v.models).forEach(g=>{if(g.visible)g.position.z=-.75;});v.marker.position.z=-.75;v.wires.set(s.chain.slice(1).map((_,i)=>[[-1.95+i*1.2,.25,-.75],[-1.65+i*1.2,.25,-.75]]));},
 entities(s,v){return [fixed('plan','Plan de la chaîne',v.tools.plan,['type','remove','clear','example','step'],click('step')),fixed('available',s.available?'Source disponible':'Source indisponible',v.tools.source,['available'],click('available',!s.available)),fixed('output','Énergie électrique',v.output.g,[],{readout:chainCorrect(s)&&s.available?'Fournie dans ce scénario':'Non fournie'}),...pool(s).filter(id=>!s.chain.includes(id)).map(id=>e('card-'+id,stageNames[id],v.tools.cards[id],[],{drop:[seqDrop('plan',op('card',id),op('add'))],click:seq(op('card',id),op('add'))})),...s.chain.map((id,i)=>fixed('stage-'+id,`${i+1} · ${stageNames[id]}`,v.models[id],['remove','step'],click('step')))];}},
'E01-A3':{
 goal:s=>networkState(s).complete?'Suis le trajet de l’énergie, puis retire un maillon pour comparer.':'Repère le maillon interrompu et rétablis la continuité du trajet documentaire.',
 hint:'Touche les transformateurs, le transport ou le disjoncteur pour les comparer présents / interrompus ; le connecteur rétablit le trajet.',
 build(v,k){v.tools.connector=cord(k,-1.8,1.6);v.tools.trace=card(k,.2,1.9);},
 update(v,s){v.up.visible=true;v.down.visible=networkState(s).household;},
 entities(s,v){return [fixed('plant','Production',v.plant.g,['missing'],click('missing',s.missing==='production'?'none':'production')),fixed('raise',s.raise?'Transformateur avant transport':'Transformateur déconnecté',v.up,['raise'],click('raise',!s.raise)),fixed('transport',s.missing==='transport'?'Transport interrompu':'Transport',v.tower,['missing'],click('missing',s.missing==='transport'?'none':'transport')),fixed('post','Poste du réseau',v.post,['missing'],click('missing',s.missing==='poste'?'none':'poste')),fixed('user','Usager · '+s.user,v.users[s.user].g,['user','missing']),...(networkState(s).household?[fixed('lower',s.lower?'Transformation locale':'Transformation locale déconnectée',v.down,['lower'],click('lower',!s.lower)),fixed('breaker',s.breaker?'Disjoncteur fermé':'Disjoncteur ouvert',v.breaker,['breaker'],click('breaker',!s.breaker))]:[]),e('connector','Rétablir le trajet',v.tools.connector,['repair'],{drop:['plant','raise','transport','post','user',...(networkState(s).household?['lower','breaker']:[])].map(id=>seqDrop(id,op('repair'),op('raise',true),op('lower',true),op('breaker',true)))}),fixed('trace','Suivre le trajet',v.tools.trace,['step'],click('step'))];}},
'E07-A1':{
 goal:s=>!s.verified?'Vérifie d’abord la lampe témoin sur la pile de référence.':s.naturalProbes?.a&&s.naturalProbes?.b&&s.a===s.b?'Les pointes touchent le même contact. Déplace-en une vers un autre contact.':s.mode==='probe'?'Compare l’essai aux hypothèses, puis déplace une pointe pour les départager.':'Pose les deux pointes du témoin sur deux contacts du circuit.',
 hint:'Chaque pointe se dépose sur A…F. Le témoin est branché après pose des deux pointes. Les essais vérifiés alimentent le diagnostic.',
 build(v,k){v.tools.ports=Object.fromEntries(points.map(p=>[p,terminal(k,v.positions[p])]));v.tools.red=probe(k,-1.25,1.5,k.m.red);v.tools.black=probe(k,.95,1.7,k.m.black);v.tools.spare=card(k,3,-1.5);v.tools.remove=card(k,-3.1,1.8);},
 update(v,s){
  const probeTargets=[];
  for(const [i,id,key]of [[0,'red','a'],[1,'black','b']]){
   const p=v.tools[id],attached=s.mode==='probe'||s.naturalProbes?.[key];
   const xyz=s.mode==='reference'?[i?2.61:1.99,.9,1]:attached?v.positions[s[key]]:[id==='red'?-1.25:.95,.13,id==='red'?1.5:1.7];
   placeElectricalProbe(v,p,xyz,1.2,[Math.PI,0,i?.43:-.43]);probeTargets.push(xyz);
  }
  // Leads remain connected to the witness while only one tip has been placed.
  const p=v.positions,routes=[[p.A,p.B],[p.C,p.D],[p.E,[2.3,.12,.2],[-1.9,.12,.2],p.F],
   [[-.36,.25,1.4],probeTargets[0]],[[.36,.25,1.4],probeTargets[1]]];
  v.wires.set(routes);v.naturalProbeBindings=v.wires.out.slice(3,5).map((w,i)=>({line:w.mesh,handle:v.tools[i?'black':'red'],end:1}));updateProbeLeads(v);
 },
 entities(s,v){const r=diagnosticState(s);return [fixed('battery','Source du circuit',v.b,['challenge']),fixed('main','Lampe du montage',v.main.g,[],{readout:r.mainP>0?'Allumée':'Éteinte'}),e('witness','Lampe témoin',v.witness.g,['healthy','verify','off'],{movable:false,drop:[drop('reference','verify')],readout:s.mode==='off'?'Retirée':r.probeP>0?'Allumée':'Éteinte'}),fixed('reference','Pile de référence',v.reference,['verify'],click('verify')),...points.map(p=>fixed('contact-'+p,'Contact '+p,v.tools.ports[p],[])),...['red','black'].map((id,i)=>e(id,i?'Pointe noire · 2':'Pointe rouge · 1',v.tools[id],[],{movable:false,drop:points.map(p=>drop('contact-'+p,i?'naturalProbeB':'naturalProbeA',p)),pose:'dip'})),fixed('spare','Pièce connue bonne',v.tools.spare,['replacePart','replace']),fixed('remove','Retirer les deux pointes',v.tools.remove,['off','clear'],click('off'))];}},
'E07-A2':{
 goal:s=>s.shunt==='none'?'Ajoute le pont aux bornes de L1, puis compare avec les bornes de la source.':'Observe les lampes et le courant, puis retire le pont sur son support.',
 hint:'Dépose le fil sur L1 ou sur la source pour poser le pont. Dépose le pont sur son support pour le retirer. Défauts uniquement virtuels.',
 build(v,k){v.tools.bridge=cord(k,2.7,1.5);v.tools.rest=card(k,2.8,-1.3);},
 update(v,s){v.tools.bridge.visible=s.shunt==='none';},
 entities(s,v){const r=shortState(s),routes=v.wires.out.filter(w=>w.mesh.visible),line=routes.at(-2)?.mesh,bridge=s.shunt==='none'?v.tools.bridge:(v.naturalTubes?.get(line)?.tube??line);return [fixed('source','Source · '+(s.source==='pile'?'pile réelle modélisée':'idéale'),v.b,['source']),fixed('L1','Lampe L1',v.lamps[0].g,['topology'],{readout:r.ps[0]>0?'Allumée':'Éteinte'}),fixed('L2','Lampe L2',v.lamps[1].g,['topology'],{readout:r.ps[1]>0?'Allumée':'Éteinte'}),fixed('meter','Courant de la source',v.device.g,[],{readout:r.out?'Hors modèle':`${fmt(r.total)} A`}),e('bridge',s.shunt==='none'?'Fil de contournement':'Pont posé · à retirer',bridge,['shunt'],{movable:false,drop:[drop('L1','shunt','L1'),drop('source','shunt','source'),drop('rest','shunt','none')]}),fixed('rest','Support du fil',v.tools.rest)];}},
'E07-A3':{
 goal:s=>!s.fuse?(s.power?'Coupe la source avant de remplacer le fusible.':'Remplace le fusible, puis réduis la charge avant de remettre sous tension.'):'Allume la source et ajoute des charges pour tester la protection.',
 hint:'La source se commande au toucher. Le fusible de rechange se pose dans le porte-fusible hors alimentation.',
 build(v,k){v.tools.spare=fuse(k,-2.4,1.6);v.tools.power=knob(k,-3,-.1);v.tools.load=card(k,3,1.5);},
 entities(s,v){const r=fuseState(s);return [fixed('source','Source réglable',v.b,['u'],{adjust:{id:'u',axis:'y',min:0,max:6,step:.5,value:s.u,sensitivity:200}}),fixed('power',s.power?'Alimentation active':'Alimentation coupée',v.tools.power,['power'],click('power',!s.power)),fixed('fuse',s.fuse?'Fusible · intact':'Fusible · ouvert',v.fg,['placement']),e('spare','Fusible F05 de rechange',v.tools.spare,['replace'],{movable:false,drop:[{...drop('fuse','replace'),constraint:s=>!s.power}]}),...v.loads.filter((l,i)=>i<s.n).map((l,i)=>fixed('load'+i,`Charge ${i+1} · ${s.resistance} Ω`,l.g,['resistance','n'])),fixed('loads',`${s.n} branches`,v.tools.load,['n','resistance'],{adjust:{id:'n',axis:'x',min:1,max:3,step:1,value:s.n,sensitivity:170}}),fixed('meter','Courant après protection',v.device.g,[],{readout:`${fmt(r.total)} A`})];}},
'E07-A4':{
 goal:s=>s.closed?'Pose les pointes sur un dipôle et relève sa tension.':'Compare les tensions avec la lampe éteinte : elles ne sont pas toutes nulles.',
 hint:'Dépose la paire de pointes sur la source, la lampe, l’interrupteur ou le fil. Le levier ouvre le circuit.',
 build(v,k){v.tools.probes=twinProbes(k,2.6,1.55);v.tools.rest=card(k,2.5,-1.1);v.tools.wire=terminal(k,[-1.65,.14,-.4]);},
 update(v,s){
  const p=[-2.55,.9,-.8],m=[-1.95,.9,-.8],a=[-1.01,.25,0],b=[-.29,.25,0],c=[.88,.31,0],d=[1.52,.31,0];
  const targets=s.pair==='source'?[p,m]:s.pair==='lampe'?[a,b]:s.pair==='contact'?[c,d]:s.pair==='fil'?[p,a]:[p,[2.5,.13,-1.1]];
  if(s.reverse)targets.reverse();v.tools.probes.position.set(0,0,0);v.tools.probes.rotation.set(0,0,0);
  targets.forEach((target,i)=>placeElectricalProbe(v,v.tools.probes.children[i],target,1.2,[Math.PI,0,i?.43:-.43]));
  v.naturalProbeBindings=v.wires.out.filter(w=>w.mesh.visible).slice(-2).map((w,i)=>({line:w.mesh,handle:v.tools.probes.children[i],end:1}));updateProbeLeads(v);
 },
 entities(s,v){const r=openVoltage(s);return [fixed('source','Bornes de la source',v.b),fixed('lamp','Bornes de la lampe',v.lamps[0].g),fixed('switch',s.closed?'Interrupteur fermé':'Interrupteur ouvert',v.sw.g,['closed'],click('closed',!s.closed)),fixed('wire','Deux points du fil idéal',v.tools.wire),e('probes','Pointes rouge et noire',v.tools.probes,['pair','reverse'],{movable:false,drop:[drop('source','pair','source'),drop('lamp','pair','lampe'),drop('switch','pair','contact'),drop('wire','pair','fil'),drop('rest','pair','libre')]}),fixed('meter','Voltmètre · toucher pour relever',v.device.g,['record','reverse','clear'],{readout:digital(r.value,20,'V').text,...click('record')}),fixed('rest','Retirer les pointes',v.tools.rest,['pair'],click('pair','libre'))];}},
'E07-A5':{
 goal:s=>!s.inspected?'Observe la scène avec la loupe et repère les contacts concernés.':'Associe la carte qui explique le risque, puis lis le résultat documentaire.',
 hint:'Scènes documentaires : loupe vers scène, puis carte de risque vers scène. Aucun geste sur une installation réelle.',
 build(v,k){v.tools.loupe=loupe(k,-2.7,-.8);v.tools.risks={};['isolant','surcharge','eau','potentiels'].forEach((id,i)=>v.tools.risks[id]=card(k,-3.3+i*2.2,1.8));},
 entities(s,v){return [fixed('scene',({cable:'Gaine endommagée',multiprise:'Multiprise',eau:'Eau et appareil',oiseau:'Oiseau · contacts'})[s.scene],v.groups[s.scene],['scene','inspect',...(s.scene==='oiseau'?['twoContacts']:[])],click('inspect')),e('loupe','Observer les contacts',v.tools.loupe,['inspect'],{drop:[drop('scene','inspect')]}),...(s.scene==='oiseau'?[fixed('contact','Comparer les deux contacts',v.legs[1],['twoContacts'],click('twoContacts',!s.twoContacts))]:[]),...Object.entries({isolant:'Isolation abîmée',surcharge:'Surcharge possible',eau:'Humidité',potentiels:'Potentiels différents'}).map(([id,label])=>e('risk-'+id,label,v.tools.risks[id],[],{drop:[seqDrop('scene',op('risk',id),op('answer'))],click:seq(op('risk',id),op('answer'))}))];}}
};
export const electricityContextIds=Object.keys(configs);
export function refineElectricityContexts(original){
 const cfg=configs[original.id];if(!cfg)return original;
 return {...original,
  valid:s=>original.valid(s)&&(s.naturalProbes===undefined||s.naturalProbes&&typeof s.naturalProbes==='object'&&typeof s.naturalProbes.a==='boolean'&&typeof s.naturalProbes.b==='boolean'),
  controls(s){return original.controls(s).map(c=>original.id==='E01-A3'&&c.id==='repair'?{...c,label:'Rétablir le trajet'}:c);},
  act(s,id,value){
   if(id==='reset')return original.initial();
   if(original.id==='E01-A3'&&id==='repair'){let n=original.act(s,'repair');for(const key of ['raise','lower','breaker'])n=original.act(n,key,true);return n;}
   if(id==='naturalContextSteps'){let n=s;for(const o of Array.isArray(value)?value.slice(0,4):[])if(o&&typeof o.id==='string'&&!o.id.startsWith('natural'))n=original.act(n,o.id,o.value);return n;}
   if(original.id==='E07-A1'&&['naturalProbeA','naturalProbeB'].includes(id)&&points.includes(value)){
    const key=id==='naturalProbeA'?'a':'b';let n=original.act(s,key,value);n.naturalProbes={a:s.mode==='probe',b:s.mode==='probe',...s.naturalProbes,[key]:true};
    if(n.naturalProbes.a&&n.naturalProbes.b&&n.a!==n.b)n=original.act(n,'test');return n;
   }
   const n=original.act(s,id,value);if(original.id==='E07-A1'&&['off','verify','healthy','replace','clear','challenge','a','b'].includes(id))delete n.naturalProbes;return n;
  },
  build(kit){const assembly=new kit.T.Group();kit.root.add(assembly);const sub={...kit,root:assembly};const v=original.build(sub);v.naturalAssembly=assembly;v.tools={};assembly.traverse(o=>{delete o.userData.workshopAction;if(o.material?.map)o.visible=false;});if(v.reference)v.batteries={reference:v.reference};enhanceElectricalView(v,sub);const k=makeKit({...sub,root:v.naturalContent},'context-'+original.id);cfg.build?.(v,k);return v;},
  update(v,s,kit){original.update(v,s,kit);cfg.update?.(v,s,kit);updateElectricalDetails(v);},
  natural:{goal:cfg.goal,hint:cfg.hint,entities:(s,v)=>cfg.entities(s,v).filter(x=>x.object?.visible!==false).map(x=>['red','black','probes'].includes(x.id)?{...x,onMove:()=>{updateProbeLeads(v);updateElectricalDetails(v);v.naturalKit.invalidate();}}:x),
   readings(s){if(original.id==='E07-A1'){const r=diagnosticState(s),d=diagnosis(s);return [{label:'Témoin',value:s.mode==='off'?'Retiré':r.probeP>0?'Allumé':'Éteint'},{label:'Vérification',value:s.verified?'Source de référence vérifiée':'À vérifier'},{label:'Hypothèses restantes',value:String(d.candidates.length)}];}return original.observe(s).metrics.slice(0,3);},
   instrument(s,id){if(!['meter','witness','plan','trace','device','scene','fuse'].includes(id))return '';const o=original.observe(s);return `<section><strong>${esc(o.title)}</strong>${o.metrics.map(m=>`<p>${esc(m.label)} <b>${esc(m.value)}</b></p>`).join('')}${o.warning?`<p>${esc(o.warning)}</p>`:''}<details><summary>Comprendre et vérifier</summary>${o.lines.map(l=>`<p>${esc(l)}</p>`).join('')}</details></section>`;}
  }
 };
}
