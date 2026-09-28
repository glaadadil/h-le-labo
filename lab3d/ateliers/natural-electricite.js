import {samples,ringResult,circuitResult,sampleResult} from './modules/electricite.js';
import {currentState,voltageState,analogState,adaptationState,diodeState} from './modules/e04.js';
import {digital,fmt} from './modules/electricite-common.js';
const ids=['E02-A2','E02-A3','E02-A4','E02-A5','E02-A6','E04-A1','E04-A2','E04-A3','E04-A4','E04-A5','E04-A6'];
const names={'E02-A2':'Relie deux bornes pour construire le circuit, puis compare montage et schéma.','E02-A3':'Vérifie le testeur, puis glisse un échantillon entre les deux pinces.','E02-A4':'Glisse la pointe sur le plot, le culot ou le verre et observe le filament.','E02-A5':'Essaie une pile et une lampe avec les pièces témoins pour trouver les pannes.','E02-A6':'Fais avancer l’anneau et décale-le : le contact allume la lampe.','E04-A1':'Actionne le contact puis inverse les bornes de la source pour comparer le moteur.','E04-A2':'Retourne la diode pour comparer le sens passant et le sens bloqué.','E04-A3':'Insère l’ampèremètre dans la boucle avant d’alimenter, puis règle son calibre.','E04-A4':'Pose les pointes sur un dipôle et règle la tension de la source.','E04-A5':'Règle le banc étalon et lis la position de l’aiguille selon le calibre.','E04-A6':'Règle la tension de la source et compare-la à la tension nominale de la lampe.'};
const e=(id,label,object,controls=[],extra={})=>({id,label,object,controls,movable:false,hint:'Touche cet objet pour le manipuler.',...extra});
const click=(id,value)=>({id,value});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function adjust(id,value,min,max,step=1,axis='x'){return {id,value,min,max,step,axis,sensitivity:210};}
function entities(base,s,v,kit){
 const source=(controls=[],extra={})=>e('source','Source électrique',v.b,controls,extra);
 const lamp=(i=0,controls=[],extra={})=>e('lampe'+i,'Lampe',v.lamps?.[i]?.g??v.l?.g,controls,extra);
 const instrument=(controls=[],extra={})=>e('mesure','Multimètre',v.device?.g,controls,extra);
 switch(base.id){
 case 'E02-A2':{const ts=['P+','P−','L1','L2','S1','S2'];return [e('source','Pile',s.view==='schema'?v.symbols.pile:v.b,['view','layout','clear','example']),e('lampe0','Lampe',s.view==='schema'?v.symbols.lampe:v.l.g,[]),e('interrupteur','Interrupteur',s.view==='schema'?v.symbols.switch:v.sw.g,['closed'],{click:click('closed',!s.closed)}),...ts.map((t,i)=>e('borne'+i,t,v.pins[(s.view==='schema'?'s':'')+t],[],{connection:true,shortHint:'Relier cette borne',click:click('terminal',t),drop:ts.filter(x=>x!==t).map(x=>({target:'borne'+ts.indexOf(x),action:'connectPair',value:[t,x]})),hint:'Glisse vers une autre borne, ou touche deux bornes successivement.'})),...v.cables.flatMap((c,i)=>{const key=[c.a,c.b].sort().join('|');if(!s.wires.some(w=>[...w].sort().join('|')===key))return [];const line=(s.view==='schema'?c.diagram:c.real).line,tube=v.naturalTubes.get(line)?.tube,points=line.geometry.attributes.position.array;return tube?[e('fil-'+i,`Fil ${s.wires.findIndex(w=>[...w].sort().join('|')===key)+1}`,tube,['remove'],{click:click('selectedWire',key),hint:`${c.a} vers ${c.b}. Sélectionne ce fil, puis retire-le.`,anchor:new kit.T.Vector3(points[36],points[37]+.06,points[38])})]:[];})];}
 case 'E02-A3':return [source(['verify']),lamp(0,['healthy','sensitive']),e('pinces','Pinces du testeur',v.holder,['contacts','record','clearRecords'],{click:click('contacts',!s.contacts)}),...Object.entries(v.naturalSamples||{}).map(([id,o])=>e('echantillon-'+id,samples[id]?.label??'Pont métallique témoin',o,[],{click:click(id==='reference'?'verify':'sample',id),drop:[{target:'pinces',action:id==='reference'?'verify':'insertSample',value:id}],hint:'Glisse entre les pinces pour tester ce matériau.'}))];
 case 'E02-A4':return [source(['connected']),e('ampoule','Ampoule en coupe',v.g,['cut','intact']),...Object.entries(v.parts).map(([id,o])=>e('part-'+id,({plot:'Plot',culot:'Culot',verre:'Verre',filament:'Filament',tige1:'Tige du plot',tige2:'Tige du culot',isolant:'Isolant'})[id],o,['part'],{click:click('part',id)})),e('sonde','Pointe du second fil',v.naturalProbe,['contact'],{drop:['plot','culot','verre'].map(id=>({target:'part-'+id,action:'contact',value:id})),hint:'Pose la pointe sur le contact à examiner.'})];
 case 'E02-A5':return [...Object.entries(v.batteries).map(([id,o])=>e('pile-'+id,id==='T'?'Pile témoin':'Pile '+id,o,['battery'],{click:click('battery',id),drop:[{target:'essai',action:'tryBattery',value:id}]})),...Object.entries(v.lamps).map(([id,l])=>e('lampe-'+id,id==='T'?'Lampe témoin':id,l.g,['lamp'],{click:click('lamp',id),drop:[{target:'essai',action:'tryLamp',value:id}]})),e('essai','Fermer le circuit d’essai',v.naturalSwitch,['test','open','challenge','clear'],{click:click(s.testing?'open':'test'),hint:'Choisis les pièces, puis touche ce contact pour tester.'})];
 case 'E02-A6':return [source(['connected']),lamp(),e('serpentin','Serpentin',v.serpent,['material']),e('anneau','Anneau à poignée',v.rg,['x','offset','center','touch'],{adjust:{...adjust('x',s.x,-1.4,1.4,.05),secondary:adjust('offset',s.offset,-.245,.245,.005,'y')},hint:'Glisse de gauche à droite pour avancer ; vers le haut ou le bas pour toucher le fil.',readout:ringResult(s).lit?'Contact : lampe allumée':'Sans signal lumineux'})];
 case 'E04-A1':return [source(['source','reverse'],{click:click('reverse',!s.reverse)}),e('recepteur',s.receiver==='moteur'?'Moteur à hélice':'Lampe',s.receiver==='moteur'?v.motor:v.lamps[0].g,['receiver','step'],{click:click('step'),hint:'Touche l’hélice pour observer un pas de rotation.'}),e('contact','Contact',v.naturalSwitch,['closed'],{click:click('closed',!s.closed)})];
 case 'E04-A2':return [source(['reverse','closed'],{click:click('reverse',!s.reverse)}),...v.diodes.filter((_,i)=>i===0||s.two).map((d,i)=>e('diode'+i,'Diode D'+(i+1),d.g,['two','led'],{click:click('d'+(i+1),!s['d'+(i+1)]),hint:'Touche la diode pour la retourner.'})),lamp(0,['led']),e('resistance','Protection de la DEL',v.limit.g,['led'])];
 case 'E04-A3':return [source(['power'],{click:click('power',!s.power)}),...v.lamps.slice(0,s.n).map((l,i)=>e('lampe'+i,'Lampe '+(i+1),l.g,['n'])),instrument(['placement','jack','range','reverse','replace'],{readout:currentState(s).reading}),e('selecteur','Sélecteur de calibre',v.device.knob,['range'],{adjust:adjust('rangeIndex',['2','0.2','0.02','0.002'].indexOf(s.range),0,3)}),e('pointes','Pointes A / COM',v.naturalProbe,['placement','reverse'],{drop:[{target:'source',action:'placement',value:'parallele'},{target:'lampe0',action:'placement',value:'serie'}],hint:'Pose les pointes sur la lampe pour insérer A dans la boucle préparée.'})];
 case 'E04-A4':return [source(['source','u'],{adjust:adjust('u',s.u,0,9,.5),readout:fmt(s.source==='pile'?6:s.u)+' V'}),lamp(),e('contact','Interrupteur',v.sw.g,['closed'],{click:click('closed',!s.closed)}),instrument(['range','reverse','points'],{readout:digital(voltageState(s).value,Number(s.range),'V').text}),e('pointes','Pointes V / COM',v.naturalProbe,['points','reverse'],{drop:[['source','source'],['lampe0','lampe'],['contact','interrupteur']].map(([target,value])=>({target,action:'points',value})),hint:'Glisse la paire de pointes sur le dipôle dont tu veux lire la tension.'})];
 case 'E04-A5':{const r=analogState(s);return [source(['quantity','current','voltage'],{adjust:s.quantity==='A'?adjust('current',s.current,0,.4,.0005):adjust('voltage',s.voltage,0,12,.1),readout:fmt(r.value,4)+' '+s.quantity}),e('aiguille','Appareil à aiguille',s.N==='50'?v.d50.g:v.d100.g,['rangeA','rangeV','N','reverse'],{readout:fmt(r.n)+' / '+s.N})];}
 case 'E04-A6':return [source(['u'],{adjust:adjust('u',s.u,0,12,.5),readout:fmt(s.u)+' V'}),lamp(0,['nominal','break','replace'],{readout:s.nominal+' V nominal'}),instrument([],{readout:adaptationState(s).out?'Hors modèle':fmt(adaptationState(s).i)+' A'})];
 default:return [];
 }
}

// The approved room and camera are untouched; apparatus fills the same table.
// Details use the same warm ceramic, knurled brass posts and blown-glass profile.
export function enhanceElectricalView(v,kit){
 v.naturalKit=kit;const {T,scene,root}=kit;
 const content=new T.Group();content.name='electrical-apparatus';
 for(const child of [...root.children])content.add(child);root.add(content);
 content.scale.setScalar(1.46);content.position.z=-.55;v.naturalContent=content;
 const mat=(name,color,opts={})=>scene.mat('natural-electric-'+name,color,opts);
 const brass=mat('brass','#b9a36c',{metalness:.85,roughness:.24}),silver=mat('silver','#c5d1d9',{metalness:.85,roughness:.19}),rubber=mat('rubber','#26353f',{roughness:.45}),ceramic=mat('ceramic','#ebe9de',{roughness:.23,metalness:.04});
 const post=(g,x,y,z,r=.065)=>{scene.cyl(g,r*1.4,r*1.45,.035,silver,x,y+.075,z);const slit=scene.box(g,r*1.4,.006,.016,rubber,x,y+.096,z);slit.rotation.y=.3;};
 const batteries=new Set([v.b,...Object.values(v.batteries||{})].filter(Boolean));
 for(const b of batteries){for(const x of [-.29,.29]){post(b,x,.9,0);scene.cyl(b,.088,.10,.032,brass,x,.84,0);}for(const x of [-.32,.32])for(const z of [-.23,.23])scene.cyl(b,.07,.085,.08,rubber,x,.06,z);const h=new T.Group();b.add(h);scene.tube(h,[[-.27,.80,-.30],[-.27,.96,-.30],[.27,.96,-.30],[.27,.80,-.30]],.026,rubber);}
 const lampSet=new Set([v.l,...(Array.isArray(v.lamps)?v.lamps:Object.values(v.lamps||{})),v.main,v.witness,v.output,v.loadlamp].filter(l=>l?.g&&l.fm));
 for(const l of lampSet){const tall=l.g.children.some(o=>o.isPointLight),base=tall?.62:.53;
  if(l.bulb){l.bulb.geometry.dispose();const profile=[[0,0],[.13,0],[.13,.11],[.19,.22],[.30,.34],[.32,.49],[.31,.63],[.25,.77],[.13,.85],[0,.88]].map(p=>new T.Vector2(...p));l.bulb.geometry=new T.LatheGeometry(new T.SplineCurve(profile).getPoints(36),32);l.bulb.position.y=base;l.bulb.scale.set(1,1,1);l.bulb.material.dispose();l.bulb.material=new T.MeshPhysicalMaterial({color:'#fcfdff',roughness:.045,transmission:.90,thickness:.035,ior:1.46,transparent:true,opacity:1,depthWrite:false,clearcoat:1});}
  for(let i=0;i<5;i++)scene.cyl(l.g,tall?.212:.178,tall?.212:.178,.018,silver,0,(tall?.41:.39)+i*.033,0);
  const half=tall?.44:.36;for(const x of [-half,half]){scene.cyl(l.g,.083,.095,.045,brass,x,.22,0);post(l.g,x,.24,0,.053);}
  if(!tall){scene.tube(l.g,[[-.13,.82,0],[-.07,.61,0]],.012,silver);scene.tube(l.g,[[.13,.82,0],[.07,.61,0]],.012,silver);}
  for(const o of l.g.children)if(o.material?.color&&o.geometry?.type==='ExtrudeGeometry')o.material=ceramic;
 }
 const meters=new Set([v.device,v.am,v.vm,...(v.ms||[]),...(v.vs||[])].filter(m=>m?.g&&m.knob));
 for(const m of meters){for(const x of [-.69,.69])scene.rounded(m.g,.11,.26,1.36,.05,rubber,x,.18,0);for(let i=0;i<16;i++){const a=i*Math.PI/8;scene.cyl(m.g,.01,.01,.055,silver,.239*Math.sin(a),.375,.25+.239*Math.cos(a),8);}for(const x of [-.45,0,.45]){scene.cyl(m.g,.10,.10,.045,x===.45?rubber:mat('jack-red','#a7312e'),x,.365,.58);scene.cyl(m.g,.052,.052,.05,rubber,x,.38,.58);}for(const x of [-.65,.65])for(const z of [-.63,.62])post(m.g,x,.24,z,.024);}
 v.naturalMaterials={brass,silver,rubber,ceramic};v.naturalTubes=new Map();return v;
}
function addAccessories(base,v,kit){
 const {T,scene}=kit,root=v.naturalContent,m=v.naturalMaterials;
 const group=(x=0,z=0)=>{const g=new T.Group();root.add(g);g.position.set(x,0,z);return g;};
 if(['E04-A1','E04-A4','E04-A5','E04-A6'].includes(base.id)){
  v.naturalBatteryParts=[...v.b.children];const supply=new T.Group();v.b.add(supply);v.naturalSupply=supply;
  scene.rounded(supply,1.24,.77,.89,.075,scene.mat('natural-supply','#c4cacf',{metalness:.26,roughness:.33}),0,.43,0);
  scene.rounded(supply,1.20,.045,.88,.035,m.rubber,0,.035,0);
  scene.box(supply,1.06,.43,.045,m.rubber,0,.46,.46);
  const face=scene.print(supply,'V  ·  A',.58,.20,-.19,.55,.49,{background:'#dce5d2',color:'#17282f'});face.material.toneMapped=false;
  const knob=new T.Group();knob.position.set(.33,.38,.49);supply.add(knob);v.naturalSourceDial=knob;
  const disc=scene.cyl(knob,.12,.12,.10,m.rubber,0,0,0);disc.rotation.x=Math.PI/2;
  scene.box(knob,.02,.065,.015,m.ceramic,0,.055,.057);
  for(const x of [-.30,.30]){scene.cyl(supply,.074,.085,.12,m.brass,x,.90,0);scene.cyl(supply,.10,.10,.025,x<0?scene.mat('natural-supply-red','#a33530'):m.rubber,x,.83,0);}
  for(let i=0;i<5;i++)scene.box(supply,.012,.35,.02,m.rubber,-.48+i*.055,.43,-.455);
 }
 if(['E02-A4','E04-A3','E04-A4'].includes(base.id)){
  const g=group(base.id==='E02-A4'?2.1:2.5,base.id==='E02-A4'?1.25:1.5);v.naturalProbe=g;
  v.naturalProbeHandles=[];for(const [i,x] of (base.id==='E02-A4'?[[1,.13]]:[[0,-.13],[1,.13]])){const h=new T.Group();g.add(h);h.position.x=x;scene.cyl(h,.062,.085,.48,i===0?scene.mat('natural-probe-red','#ac3832'):m.rubber,0,.31,0);scene.cyl(h,.017,.034,.23,m.silver,0,.65,0);scene.cyl(h,.105,.105,.025,m.rubber,0,.51,0);v.naturalProbeHandles.push(h);}g.rotation.z=-.55;
 }
 if(base.id==='E02-A5'){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));
  v.naturalReturn=new T.Line(geometry,new T.LineBasicMaterial({color:'#283239'}));root.add(v.naturalReturn);
 }
 if(['E02-A5','E04-A1'].includes(base.id)){
  const g=group(base.id==='E02-A5'?0:-.5,base.id==='E02-A5'?2.3:1.5);v.naturalSwitch=g;
  scene.rounded(g,.9,.12,.54,.06,scene.mat('natural-switchwood','#cba774',{roughness:.48}),0,.12,0);
  for(const x of [-.33,.33])scene.cyl(g,.072,.085,.14,m.brass,x,.30,0);
  const pivot=new T.Group();pivot.position.set(-.33,.38,0);g.add(pivot);scene.box(pivot,.65,.055,.10,m.brass,.325,0,0);scene.rounded(pivot,.22,.12,.22,.04,m.rubber,.58,.05,0);v.naturalLever=pivot;
 }
 if(base.id==='E02-A3'){
  v.naturalSamples={};const entries=[['reference',{color:'#becbd0',label:'Pont témoin'}],...Object.entries(samples)];
  const tray=group(0,2.27);scene.rounded(tray,5.8,.075,.94,.10,scene.mat('natural-tray','#c4a57b',{roughness:.48}),0,.065,0);
  entries.forEach(([id,sample],i)=>{const g=group(-2.5+(i%6),2.0+Math.floor(i/6)*.52);scene.rounded(g,.72,.10,.26,.03,new T.MeshStandardMaterial({color:sample.color,roughness:['cuivre','acier','aluminium','reference'].includes(id)?.24:.68,metalness:['cuivre','acier','aluminium','reference'].includes(id)?.65:0,transparent:id==='verre',opacity:id==='verre'?.48:1}),0,.18,0);v.naturalSamples[id]=g;});
 }
}
function positionProbes(base,v,s){
 if(!v.naturalProbe)return;const {T}=v.naturalKit;
 const p=[-2.55,.9,-.8],m=[-1.95,.9,-.8];let targets=[];
 if(base.id==='E02-A4')targets=[s.contact==='culot'?[.93,.79,.08]:s.contact==='plot'?[.6,.4,.08]:[.12,1.7,.35]];
 if(base.id==='E04-A4'){targets=s.points==='source'?[p,m]:s.points==='lampe'?[[.84,.25,0],[1.56,.25,0]]:s.points==='interrupteur'?[[-.82,.31,0],[-.18,.31,0]]:s.points==='serie'?[[1.56,.25,0],[-.82,.31,0]]:[p,[1.2,.12,2]];if(s.reverse)targets.reverse();}
 if(base.id==='E04-A3'){const last=v.lamps[s.n-1].g.position;targets=s.placement==='parallele'?[p,m]:[[last.x+.36,.25,last.z],m];if(s.reverse)targets.reverse();}
 if(!targets.length)return;
 v.naturalProbe.position.set(0,0,0);v.naturalProbe.rotation.set(0,0,0);
 targets.forEach((target,i)=>{const h=v.naturalProbeHandles[i];h.rotation.set(Math.PI,0,(i===0?-1:1)*.43);const tip=new T.Vector3(0,.765,0).applyEuler(h.rotation);h.position.set(...target).sub(tip);});
 const lines=base.id==='E02-A4'?[v.lead2.line]:v.wires.out.filter(w=>w.mesh.visible).slice(-2).map(w=>w.mesh);v.naturalProbeBindings=[];
 for(const line of lines){const a=line.geometry.attributes.position,array=a.array,start=Array.from(array.slice(0,3)),end=Array.from(array.slice(-3));for(let j=0;j<targets.length;j++){const same=q=>q.every((c,k)=>Math.abs(c-targets[j][k])<1e-5);if(same(start))v.naturalProbeBindings.push({line,handle:v.naturalProbeHandles[j],end:0});if(same(end))v.naturalProbeBindings.push({line,handle:v.naturalProbeHandles[j],end:1});}}
 updateProbeLeads(v);
}
export function placeElectricalProbe(v,handle,target,tipY=.765,rotation=[Math.PI,0,-.43]){
 const {T}=v.naturalKit;handle.rotation.set(...rotation);
 handle.position.set(...target).sub(new T.Vector3(0,tipY,0).applyEuler(handle.rotation));
}
export function updateProbeLeads(v){
 const {T,root}=v.naturalKit;root.updateMatrixWorld(true);
 for(const {line,handle,end:which} of v.naturalProbeBindings||[]){const a=line.geometry.attributes.position,array=a.array,n=a.count,start=Array.from(array.slice(0,3)),end=Array.from(array.slice(-3));const back=line.parent.worldToLocal(handle.localToWorld(new T.Vector3(0,handle.userData.probeCableY??.07,0))).toArray();(which?end:start).splice(0,3,...back);for(let i=0;i<n;i++)for(let d=0;d<3;d++)array[i*3+d]=start[d]+(end[d]-start[d])*i/(n-1);a.needsUpdate=true;line.geometry.computeBoundingSphere();}

}
export function updateElectricalDetails(v){
 const {T}=v.naturalKit;
 const lines=[];v.naturalContent.traverse(o=>{if(o.isLine&&o.geometry?.attributes.position)lines.push(o);});
 for(const line of lines){const data=line.geometry.attributes.position.array;let entry=v.naturalTubes.get(line);if(!entry){const tube=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({color:line.material.color??'#27363d',roughness:.34}));tube.castShadow=true;tube.receiveShadow=true;line.parent.add(tube);entry={tube,key:''};v.naturalTubes.set(line,entry);}line.material.visible=false;entry.tube.visible=line.visible;
  if(!line.visible)continue;const key=Array.from(data).join(',');if(entry.key===key)continue;entry.key=key;
  const points=[];for(let i=0;i<data.length;i+=3){const p=new T.Vector3(data[i],Math.max(.065,data[i+1]),data[i+2]);if(!points.length||p.distanceToSquared(points.at(-1))>1e-10)points.push(p);}if(points.length<2){entry.tube.visible=false;continue;}
  const curve=new T.CatmullRomCurve3(points);entry.tube.geometry.dispose();entry.tube.geometry=new T.TubeGeometry(curve,Math.min(64,points.length*3),.022,8,false);
 }
}

function analogInstrument(s){
 const r=analogState(s),N=Number(s.N),cx=160,cy=155,R=114;
 let ticks='';for(let i=0;i<=N;i++){const a=Math.PI-i/N*Math.PI,long=i%(N/10)===0,rad=R-(long?14:6);const x=cx+Math.cos(a)*R,y=cy-Math.sin(a)*R,x2=cx+Math.cos(a)*rad,y2=cy-Math.sin(a)*rad;ticks+=`<path d="M${x} ${y}L${x2} ${y2}" stroke="#25363d" stroke-width="${long?1.5:.7}"/>`;if(i%(N/5)===0)ticks+=`<text x="${cx+Math.cos(a)*(R+14)}" y="${cy-Math.sin(a)*(R+14)+4}" text-anchor="middle" fill="#152d36" font-size="13">${i}</text>`;}
 const a=Math.PI-Math.max(0,Math.min(1,r.fraction))*Math.PI;
 return `<svg viewBox="0 0 320 210" role="img" aria-label="Aiguille : ${esc(fmt(r.n))} divisions sur ${N}"><rect width="320" height="210" rx="14" fill="#fffdf5"/>${ticks}<path d="M160 155L${cx+Math.cos(a)*(R-12)} ${cy-Math.sin(a)*(R-12)}" stroke="#b03e32" stroke-width="3"/><circle cx="160" cy="155" r="7" fill="#263b44"/><text x="160" y="190" text-anchor="middle" fill="#172f39" font-size="16">Calibre : ${r.calibre} ${esc(s.quantity)}</text></svg><p>${r.valid?`n = ${esc(fmt(r.n))} ; C × n / N = ${esc(fmt(r.value,5))} ${esc(s.quantity)}`:r.fraction<0?'Aiguille en butée basse : inverse les pointes.':'Aiguille en butée haute : augmente le calibre.'}</p>`;
}
function instrumentReading(base,s){
 if(base.id==='E04-A5')return analogInstrument(s);
 const o=base.observe(s);return `<p><strong>${esc(o.title)}</strong></p>${o.warning?`<p>${esc(o.warning)}</p>`:''}<dl>${(o.metrics||[]).map(m=>`<dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd>`).join('')}</dl>`;
}
export function refineElectricity(base){if(!ids.includes(base.id))return base;return {...base,natural:{goal:names[base.id],hint:base.id==='E02-A2'?'Construis le câblage en reliant les bornes.':'Montage préparé : manipule directement ses contacts, composants et instruments.',entities:(s,v,k)=>{const controls=new Set(base.controls(s).map(c=>c.id));const list=entities(base,s,v,k).filter(e=>e.object).map(e=>({...e,controls:e.controls.filter(id=>controls.has(id))}));for(const entity of list)if(['sonde','pointes'].includes(entity.id)&&v.naturalProbe)entity.onMove=()=>{updateProbeLeads(v);updateElectricalDetails(v);v.naturalKit.invalidate();};const source=list.find(e=>e.id==='source');if(source?.adjust&&v.naturalSourceDial&&v.naturalSupply.visible){list.push(e('reglage-source','Molette de la source',v.naturalSourceDial,source.controls,{adjust:source.adjust,readout:source.readout,hint:'Glisse horizontalement la molette pour régler la source.'}));delete source.adjust;}return list;},readings:s=>(base.observe(s).metrics||[]).slice(0,3),instrument:s=>instrumentReading(base,s)},build(kit){const v=base.build(kit);v.naturalKit=kit;enhanceElectricalView(v,kit);addAccessories(base,v,kit);if(base.id==='E02-A2')for(const pin of Object.values(v.pins))for(const child of pin.children)child.visible=false;return v;},update(v,s,kit){base.update(v,s,kit);if(v.naturalSupply){const supply=base.id==='E04-A1'?s.source==='generateur':base.id==='E04-A4'?s.source==='regule':true;v.naturalSupply.visible=supply;v.naturalBatteryParts.forEach(o=>o.visible=supply?false:true);v.naturalSourceDial.rotation.z=-Math.PI*.8+(base.id==='E04-A5'?(s.quantity==='A'?s.current/.4:s.voltage/12):(s.u??6)/12)*Math.PI*1.6;}if(v.naturalLever)v.naturalLever.rotation.z=(base.id==='E02-A5'?s.testing:s.closed)?0:.6;
if(base.id==='E02-A5'){
 const b=v.batteries[s.battery],l=v.lamps[s.lamp];
 v.lead2.set([l.g.position.x+.44,.29,.95],[-.33,.38,2.3]);v.lead2.line.visible=true;
 const a=v.naturalReturn.geometry.attributes.position;a.array.set([.33,.38,2.3,b.position.x+.28,.94,-1]);a.needsUpdate=true;v.naturalReturn.geometry.computeBoundingSphere();
}
if(base.id==='E04-A1'){
 const y=s.receiver==='moteur'?.6:.25;
 v.wires.set([[[-2.55,.9,-.8],[.44,y,0]],[[1.16,y,0],[-.83,.38,1.5]],[[-.17,.38,1.5],[-1.95,.9,-.8]]]);
}
positionProbes(base,v,s);updateElectricalDetails(v);if(base.id==='E02-A2')for(const c of v.cables){const selected=[c.a,c.b].sort().join('|')===s.selectedWire;for(const side of ['real','diagram']){const m=v.naturalTubes.get(c[side].line)?.tube.material;if(m){m.emissive.set(selected?'#3d80b4':'#000000');m.emissiveIntensity=selected?.5:0;}}}},act(s,id,value){if(id==='connectPair'&&Array.isArray(value)&&value.length===2&&value.every(t=>['P+','P−','L1','L2','S1','S2'].includes(t))){let n=base.act(s,'from',value[0]);n=base.act(n,'to',value[1]);n=base.act(n,'connect');n.pending='';return n;}if(id==='insertSample'){return base.act(base.act(s,'sample',value),'insert');}if(id==='tryBattery')return base.act(base.act(s,'battery',value),'test');if(id==='tryLamp')return base.act(base.act(s,'lamp',value),'test');if(id==='rangeIndex')return base.act(s,'range',['2','0.2','0.02','0.002'][Math.max(0,Math.min(3,Math.round(value)))]);return base.act(s,id,value);}};}
