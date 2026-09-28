/* H le Labo — gestes M09..M15.
 * Les actions réutilisent les modèles documentés du manuel. Les échanges thermiques
 * restent des étapes explicites, pas une prétendue dynamique en temps réel.
 * Les supports sont des modèles explicatifs lorsqu'un montage réel serait trompeur.
 */
import {materials,group,cup,fill,grains,waterState,f,g} from './modules/transformations-common.js';
import {potableStages,wasteStages} from './modules/m15.js';
import {qualitativeCurves} from './modules/m14.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const supported=/^M(?:09|10|11|12|13|14|15)-A0[1-6]$/;
const step=(id,value)=>({id,value});
const spoonLoad=s=>s.naturalSpoonG??s.doseG;
const small=1e-10;
const sequence=(...steps)=>({id:'naturalSteps',value:steps});
const drop=(target,action,value,constraint)=>({target,action,value,...(constraint?{constraint}:{})});
const seqDrop=(target,...steps)=>drop(target,'naturalSteps',steps);
const e=(id,label,object,controls=[],extra={})=>({id,label,object,controls,...extra});
const fixed=(id,label,object,controls=[],extra={})=>e(id,label,object,controls,{movable:false,...extra});
const click=(id,value)=>({click:{id,value}});
function collectVessels(v){const out=[],seen=new Set();const visit=o=>{if(!o||typeof o!=='object'||o.isObject3D||o.isMaterial||seen.has(o))return;seen.add(o);if(o.g?.isObject3D&&o.rod?.isObject3D&&(o.liquid||o.shell)){out.push(o);return;}if(Array.isArray(o))o.forEach(visit);else Object.values(o).forEach(visit);};visit(v);return out;}
function bottle(k,m,x,z,color='#97bfc8'){
 const a=group(k,x,.05,z),s=k.scene,T=k.T;
 const profile=[[0,0],[.42,0],[.46,.1],[.46,.85],[.24,1.08],[.19,1.12],[.19,1.4],[.16,1.4],[.16,1.12],[.21,1.05],[.41,.82],[.41,.08],[0,.08]].map(p=>new T.Vector2(...p));
 s.mesh(a,new T.LatheGeometry(profile,48),m.glass);const liquid=s.cyl(a,.405,.405,.65,m.water.clone(),0,.39,0);liquid.material.color.set(color);a.userData.naturalLiquidIndex=a.children.indexOf(liquid);
 s.cyl(a,.205,.205,.16,m.dark,0,1.45,0);for(let i=0;i<3;i++)s.cyl(a,.21,.21,.012,m.edge,0,1.4+i*.04,0);
 s.rounded(a,.56,.37,.022,.04,m.white,0,.62,.461);return a;
}
function tubing(k,m,x,z){const a=group(k,x,.08,z);k.scene.tube(a,[[-.7,.06,.2],[-.55,.10,-.3],[.2,.08,-.35],[.6,.06,.3]],.055,m.dark);for(const [px,pz] of [[-.7,.2],[.6,.3]])k.scene.cyl(a,.075,.075,.16,m.metal,px,.12,pz);return a;}
function pissette(k,m,x,z){const a=bottle(k,m,x,z);k.scene.tube(a,[[0,1.52,0],[0,1.95,0],[.65,1.95,0],[.8,1.68,0]],.035,m.white);return a;}
function neckedVessel(c,k,m){const r=c.r??c.radius,h=c.h??c.height;c.shell.geometry.dispose();c.shell.geometry=new k.T.LatheGeometry([[0,0],[r*.95,.05],[r,.15],[r,h*.63],[r*.55,h*.8],[r*.37,h*.86],[r*.37,h],[r*.3,h],[r*.3,h*.85],[r*.49,h*.79],[r*.91,h*.61],[r*.91,.1],[0,.1]].map(p=>new k.T.Vector2(...p)),48);if(c.rim){c.rim.scale.setScalar(.37);c.rim.position.y=h;}return c;}
function spoon(k,m,x,z,{rod=false}={}){
 const a=group(k,x,.1,z),s=k.scene;const shaft=s.cyl(a,rod?.035:.045,rod?.035:.045,rod?1.6:1.28,m.edge,0,.06,0);shaft.rotation.x=Math.PI/2;
 if(!rod){const bowl=s.mesh(a,new k.T.SphereGeometry(.19,24,12),m.metal,0,.09,-.7);bowl.scale.set(1,.28,1.5);}
 const handle=s.cyl(a,.06,.06,.28,rod?m.edge:m.dark,0,.07,.67);handle.rotation.x=Math.PI/2;return a;
}
function card(k,m,x,z,color=m.white){const a=group(k,x,.07,z),s=k.scene;s.rounded(a,1.15,.07,.85,.045,color,0,.04,0);s.box(a,.28,.04,.15,m.metal,0,.10,-.35);for(let i=0;i<3;i++)s.box(a,.72-i*.10,.005,.012,m.edge,0,.08,-.13+i*.16);return a;}
function clock(k,m,x,z){const a=group(k,x,.1,z),s=k.scene,T=k.T;s.cyl(a,.38,.40,.15,m.dark,0,.07,0);s.cyl(a,.34,.34,.02,m.white,0,.155,0);const needle=s.box(a,.025,.02,.26,m.dark,0,.18,-.06);for(let i=0;i<12;i++)s.box(a,.023,.016,.055,m.dark,Math.sin(i*Math.PI/6)*.29,.18,Math.cos(i*Math.PI/6)*.29).rotation.y=i*Math.PI/6;s.cyl(a,.08,.08,.13,m.metal,0,.23,-.37);return a;}
function hotplate(k,m,x,z){const a=group(k,x,.06,z),s=k.scene;s.rounded(a,1.75,.28,1.45,.13,m.white,0,.14,0);s.cyl(a,.62,.62,.05,m.dark,0,.31,-.08);const knob=s.cyl(a,.115,.115,.1,m.dark,.5,.16,.75);knob.rotation.x=Math.PI/2;s.box(a,.03,.045,.02,m.white,.5,.21,.81);s.mesh(a,new k.T.SphereGeometry(.04,12,8),m.red,-.5,.18,.74);return a;}
function tray(k,m,x,z,w=1.45){const a=group(k,x,.045,z),s=k.scene;s.rounded(a,w,.10,1.1,.12,m.white,0,.06,0);return a;}
function clampStand(k,m,x,z,y=2.6){const a=group(k,x,.04,z),s=k.scene;s.rounded(a,.95,.12,.8,.08,m.dark,0,.06,0);s.cyl(a,.045,.045,y,m.metal,0,y/2+.13,0);s.box(a,.7,.06,.08,m.metal,.3,y*.68,0);s.cyl(a,.095,.095,.2,m.dark,0,y*.68,0);return a;}
function thermometer(k,m,x,z){const a=group(k,x,.05,z),s=k.scene;s.rounded(a,.25,2.05,.11,.03,m.white,0,1.15,0);s.cyl(a,.026,.026,1.6,m.red,0,1.1,.075);s.mesh(a,new k.T.SphereGeometry(.075,14,10),m.red,0,.3,.075);for(let i=0;i<11;i++)s.box(a,i%2?.045:.08,.012,.013,m.dark,.07,.4+i*.14,.07);return a;}
function addTool(v,k,key,type,x,z,opts){const m=v.nm;v.tools[key]=type==='bottle'?bottle(k,m,x,z,opts):type==='pissette'?pissette(k,m,x,z):type==='tube'?tubing(k,m,x,z):type==='rod'?spoon(k,m,x,z,{rod:true}):type==='spoon'?spoon(k,m,x,z):type==='clock'?clock(k,m,x,z):type==='heat'?hotplate(k,m,x,z):type==='thermometer'?thermometer(k,m,x,z):type==='tray'?tray(k,m,x,z):card(k,m,x,z);return v.tools[key];}
function rodEntity(v,id,target,action,label='Agitateur'){return e(id,label,v.tools[id],[],{hint:'Prends la baguette et dépose-la dans le liquide pour agiter.',drop:[drop(target,action)]});}
function timerEntity(v,id,action,label='Repos accéléré'){return fixed(id,label,v.tools[id],[action],{hint:'Touche le minuteur pour observer une étape. Aucune durée réelle déduite.',...click(action)});}
function diagram(s,title,lines){return `<section class="natural-science"><strong>${esc(title)}</strong>${lines.map(x=>`<p>${esc(x)}</p>`).join('')}</section>`;}
const configs={
'M09-A01':{
 goal:s=>s.bath==='warm'&&s.q>=41772?'L’échantillon atteint 20 °C : déplace-le dans le bain froid pour le solidifier.':s.bath==='cold'&&s.q<=-2090?'L’échantillon atteint −10 °C : replace-le dans le bain tiède pour comparer.':s.bath==='none'?'Dépose le tube dans le bain tiède ou le bain glace–sel.':`Le tube est dans le ${s.bath==='warm'?'bain tiède':'bain froid'}. Touche le minuteur et observe le thermomètre.`,
 hint:'Saisis le tube par son étiquette, puis dépose-le au-dessus d’un bain. Le minuteur fait avancer l’échange thermique.',
 build(v,k){addTool(v,k,'timer','clock',0,1.8);addTool(v,k,'rest','tray',0,-1.6);},
 update(v,s){if(s.bath==='none'){v.sample.g.position.x=v.tools.rest.position.x;v.sample.g.position.z=v.tools.rest.position.z;}},
 entities(s,v){return [e('sample','Tube · eau pure',v.sample.g,['bath','exchange'],{movable:false,drop:[drop('warm','bath','warm'),drop('cold','bath','cold'),drop('rest','bath','none')],readout:`${f(waterState(s.q).t)} °C`}),fixed('warm','Bain tiède',v.baths[0].g,[],{}),fixed('cold','Bain glace–sel',v.baths[1].g),fixed('rest','Support · hors des bains',v.tools.rest),timerEntity(v,'timer','exchange','Échange thermique · étape')];}},
'M09-A02':{
 goal:s=>s.water<=small?'Le bécher est vide. Compare l’eau condensée et l’eau partie dans l’air, puis recommence.':!s.heater?'Touche la molette de la plaque pour activer le chauffage.':!s.cold?'Chauffe par étapes puis place la soucoupe froide au-dessus de l’eau.':'Observe les gouttes sous la soucoupe et l’eau recueillie.',hint:'La plaque s’allume au toucher. Déplace la soucoupe vers le bécher ; les étapes thermiques sont accélérées.',
 build(v,k){addTool(v,k,'timer','clock',-.2,1.9);addTool(v,k,'shelf','tray',3,-.3);},
 update(v,s){v.plate.position.set(s.cold?-1:v.tools.shelf.position.x,s.cold?2.55:.2,s.cold?0:v.tools.shelf.position.z);},
 entities(s,v){return [fixed('vessel','Bécher · eau à chauffer',v.c.g,['evaporate'],{readout:s.water>small?`${f(s.t)} °C`:'Bécher vide'}),fixed('heater',s.heater?'Chauffage allumé':'Chauffage éteint',v.heater,['heater'],{...click('heater',!s.heater)}),e('plate','Soucoupe froide',v.plate,['cold','condense'],{movable:false,drop:[drop('vessel','cold',true),drop('shelf','cold',false)]}),e('condensate','Eau condensée',v.out.g,[],{readout:g(s.condensed)}),fixed('shelf','Reposer la soucoupe',v.tools.shelf),timerEntity(v,'timer','heat','Apport thermique · 5 kJ')];}},
'M09-A03':{
 goal:s=>s.reference===null?'Pose un repère au niveau de l’eau avant de la solidifier.':s.phase==='water'?'Solidifie l’échantillon et compare masse et volume.':'Essuie l’extérieur, puis compare la pesée avant et après fusion.',hint:'Le repère se pose sur le récipient ; le chiffon sert à retirer l’eau déposée à l’extérieur.',
 build(v,k){addTool(v,k,'mark','card',-1.7,1.1);addTool(v,k,'cloth','tray',1.8,1.2);v.tools.cloth.children[0].material=v.nm.blue;addTool(v,k,'cold','card',-1.7,-.5);addTool(v,k,'warm','card',1.7,-.5);addTool(v,k,'water','bottle',-3.3,.3);},
 entities(s,v){return [fixed('sample','Échantillon sur la balance',v.c.g,['tare','wet'],{readout:g(.2+(s.wet?.002:0)-s.tare)}),e('mark','Repère de volume',v.tools.mark,['mark'],{drop:[drop('sample','mark')],...click('mark')}),e('cloth','Chiffon absorbant',v.tools.cloth,['wipe'],{drop:[drop('sample','wipe')]}),fixed('cold','Solidification · étape virtuelle',v.tools.cold,['freeze'],click('freeze')),fixed('warm','Fusion · étape virtuelle',v.tools.warm,['melt'],click('melt')),e('water','Eau pour mouiller l’extérieur',v.tools.water,['wet'],{drop:[drop('sample','wet')]})];}},
'M09-A04':{
 goal:()=> 'Choisis une carte de situation, puis compare avec et sans la condition proposée.',hint:'Atelier documentaire : dépose une carte près de la coupe pour afficher la situation correspondante.',
 build(v,k){['pressure','salt','bottle','drink','gas'].forEach((id,i)=>addTool(v,k,id,'card',-3.6+i*1.8,1.6));},
 entities(s,v){const names=['Autocuiseur','Glace et sel','Bouteille au gel','Boisson et glaçons','Gaz liquéfié'];return [fixed('case','Coupe explicative',v.c.g,['condition'],click('condition',!s.condition)),...['pressure','salt','bottle','drink','gas'].map((id,i)=>e(id,names[i],v.tools[id],[],{drop:[drop('case','case',id)],...click('case',id)}))];}},
'M10-A01':{
 goal:()=> 'Associe un état à la matière, puis compare son organisation particulaire.',hint:'Ces sphères sont un modèle, pas des molécules filmées. Dépose une carte d’état sur le récipient.',
 build(v,k){['solid','liquid','gas'].forEach((id,i)=>addTool(v,k,id,'card',-2+i*2,1.9));},
 entities(s,v){return [fixed('sample','Échantillon visible',v.c.g,['phase']),fixed('model','Modèle · 24 symboles',v.model.g,['model','move'],click('move')),...['solid','liquid','gas'].map((id,i)=>e(id,['Solide','Liquide','Gaz'][i],v.tools[id],[],{drop:[drop('sample','phase',id)],...click('phase',id)}))];}},
'M10-A02':{
 goal:()=> 'Apporte ou retire de l’énergie au modèle, puis vérifie le nombre de symboles.',hint:'Dépose une carte d’énergie sur le modèle. Les phases évoluent, les 24 constituants restent conservés.',
 build(v,k){addTool(v,k,'warm','card',-2.4,1.1);addTool(v,k,'cold','card',2.4,1.1);},
 entities(s,v){return [fixed('model','Même échantillon · 24 symboles',v.box.g,['move'],click('move')),e('warm','Apport · jusqu’à 20 kJ',v.tools.warm,['heat'],{drop:[drop('model','heat')],...click('heat')}),e('cold','Retrait · jusqu’à 20 kJ',v.tools.cold,['cool'],{drop:[drop('model','cool')],...click('cool')})];}},
'M10-A03':{
 goal:s=>s.checked?'Compare les deux critères dans les observations.':'Répare le nombre de symboles et leur répartition dans le gaz.',hint:'Glisse le compteur pour changer le nombre, puis touche le modèle final pour répartir le gaz.',
 build(v,k){addTool(v,k,'count','card',-.2,1.6);addTool(v,k,'check','card',2.6,1.6);},
 entities(s,v){return [fixed('before','Avant · 24 symboles',v.first.g),fixed('after','Après · modèle à réparer',v.last.g,['spread'],click('spread',!s.spread)),fixed('count',`${s.count} symboles`,v.tools.count,['count'],{adjust:{id:'count',axis:'x',min:12,max:30,step:1,value:s.count,sensitivity:180}}),fixed('check','Comparer les deux critères',v.tools.check,['check'],click('check'))];}},
'M11-A01':{
 goal:s=>!s.added?'Verse la dose préparée dans le bécher d’eau.':!s.mixed?'Prends la baguette et agite le mélange.':'Verse un prélèvement dans le tube témoin, puis compare.',hint:'Dépose la dose sur le bécher, puis la baguette dans le liquide. Le bécher peut ensuite verser dans le témoin.',
 build(v,k){addTool(v,k,'dose','bottle',-3.5,.2,'#6d9777');addTool(v,k,'rod','rod',-.5,1.8);addTool(v,k,'timer','clock',2.8,1.6);},
 entities(s,v){return [e('source','Bécher de mélange',v.a.g,['kind','rest'],{drop:[drop('receiver','pour')]}),e('receiver','Tube témoin',v.c.g),e('dose','Dose de sirop / pulpe',v.tools.dose,['kind'],{drop:[drop('source','add',undefined,s=>!s.added)]}),rodEntity(v,'rod','source','mix'),timerEntity(v,'timer','rest')];}},
'M11-A02':{
 goal:s=>!s.added?'Verse le second liquide dans le bécher.':!s.agitated?'Agite le mélange avec la baguette.':'Observe après le repos : les couches se reforment-elles ?',hint:'Verse, agite avec la baguette, puis touche le minuteur pour comparer après repos.',
 build(v,k){addTool(v,k,'dose','bottle',-2.1,.2,'#dcbd6a');addTool(v,k,'rod','rod',1.5,1.4);addTool(v,k,'timer','clock',2.6,.1);},
 entities(s,v){return [e('sample','Bécher des liquides',v.c.g,['pair','micro']),e('dose','Second liquide',v.tools.dose,['pair'],{drop:[drop('sample','add',undefined,s=>!s.added)]}),rodEntity(v,'rod','sample','shake'),timerEntity(v,'timer','rest')];}},
'M11-A03':{
 goal:s=>!s.open?'Observe la masse, puis ouvre le bouchon.':'Agite la bouteille puis laisse le gaz s’échapper par étapes.',hint:'Touche le bouchon pour l’ouvrir. Il reste sur la balance afin de comparer le même système pesé.',
 build(v,k){addTool(v,k,'timer','clock',2.1,1);neckedVessel(v.c,k,v.nm);v.cap.scale.set(.44,1,.44);},
 entities(s,v){return [fixed('bottle','Bouteille sur la balance',v.c.g,['shake'],click('shake')),e('cap',s.open?'Bouchon · ouvert':'Bouchon · fermé',v.cap,['open'],{movable:false,...click('open',!s.open)}),timerEntity(v,'timer','rest','Dégazage · une étape')];}},
'M11-A04':{
 goal:s=>s.sample==='milk'?(s.micro?'Le modèle révèle des gouttelettes dispersées ; compare avec l’aspect à l’œil nu.':'Observe le lait, puis affiche son modèle grossi.'):'Tire ou pousse le piston ; compte les deux familles de particules.',hint:'La vue grossie est un modèle explicatif. Le piston se déplace horizontalement.',
 build(v,k){addTool(v,k,'milk','card',-1.4,1.7);addTool(v,k,'air','card',1.4,1.7);},
 entities(s,v){return [fixed('sample',s.sample==='milk'?'Lait · changer d’échelle':'Air · changer d’échelle',s.sample==='milk'?v.c.g:v.air,['micro','step'],click('micro',!s.micro)),...(s.sample==='air'?[fixed('piston','Piston · tirer / pousser',v.plunger,['compression'],{adjust:{id:'compression',axis:'x',min:.5,max:1.5,step:.1,value:s.compression,sensitivity:180}})]:[]),e('milk','Étudier le lait',v.tools.milk,[],click('sample','milk')),e('air','Étudier l’air',v.tools.air,[],click('sample','air'))];}},
'M12-A01':{
 goal:s=>!s.added?'Choisis une matière et dépose sa dose dans l’eau.':s.stage==='added'?'Agite avec la baguette, puis observe ce qui reste visible.':'Compare le mélange agité avec le mélange au repos.',hint:'Dépose le pot de matière au-dessus du bécher, puis la baguette dans le liquide.',
 build(v,k){addTool(v,k,'rod','rod',.9,1.7);addTool(v,k,'timer','clock',2.1,.5);},
 entities(s,v){return [e('sample','Bécher · eau',v.cup.g,['substance']),e('dose',s.added?'Dose déjà versée':'Dose de matière',v.stock.g,['substance'],{drop:[drop('sample','add',undefined,s=>!s.added)]}),rodEntity(v,'rod','sample','stir'),timerEntity(v,'timer','rest')];}},
'M12-A02':{
 goal:s=>s.salt===0?'Verse la cuillère de sel préparée dans l’eau.':s.dissolved<s.salt?'Agite, puis compare à l’équilibre avant de conclure.':spoonLoad(s)<=small?'Reprends du sel dans la réserve, ou ajoute de l’eau.':'Ajoute du sel ou de l’eau et cherche la limite de dissolution.',hint:'Une cuillère versée est vide : dépose-la dans la réserve de NaCl pour la recharger. La pissette ajoute 50 g d’eau.',
 build(v,k){v.water.g.visible=false;v.tools.water=pissette(k,v.nm,2,0);addTool(v,k,'spoon','spoon',-1.2,1.8);v.spoonSalt=k.scene.mesh(v.tools.spoon,new k.T.SphereGeometry(.14,16,8),v.nm.solid,0,.14,-.7);v.spoonSalt.scale.set(1,.3,1.4);addTool(v,k,'rod','rod',1.1,1.8);addTool(v,k,'timer','clock',-2.7,1.4);addTool(v,k,'heat','heat',3.4,-.6);},
 update(v,s){v.spoonSalt.visible=spoonLoad(s)>small;v.loss.g.visible=false;},
 entities(s,v){return [e('sample','Bécher · solution à 20 °C',v.cup.g,['equilibrium','threshold']),fixed('salt','Réserve de NaCl',v.salt.g,['dose','naturalScoop']),e('spoon',spoonLoad(s)>small?`Cuillère · ${f(spoonLoad(s))} g`:'Cuillère vide · reprendre du sel',v.tools.spoon,['dose','naturalScoop'],{drop:[drop('salt','naturalScoop'),drop('sample','naturalSpoonPour',undefined,s=>spoonLoad(s)>small&&s.salt<.15-small)]}),e('water','Pissette · 50 g d’eau',v.tools.water,['water'],{drop:[drop('sample','water')]}),rodEntity(v,'rod','sample','stir'),timerEntity(v,'timer','equilibrium','Attendre l’équilibre · étape'),fixed('heat','Évaporation · 25 g',v.tools.heat,['evaporate'],click('evaporate'))];}},
'M12-A03':{
 goal:s=>!s.prepared?'Plonge le collecteur dans la cuve pour le remplir et le retourner.':!s.connected?'Relie le tuyau de la boisson au collecteur.':s.collected?'Transfère le gaz recueilli vers l’eau de chaux.':'Touche la bouteille pour observer un dégazage.',hint:'Collecteur vers cuve, tuyau vers collecteur, puis gaz vers eau de chaux. Les quantités de gaz sont représentatives.',
 build(v,k){addTool(v,k,'hose','tube',-.8,1.8);neckedVessel(v.bottle,k,v.nm);},
 entities(s,v){return [fixed('bottle','Boisson gazeuse',v.bottle.g,['warm','release'],click('release')),fixed('basin','Cuve d’eau',v.basin.g),e('collector','Collecteur retourné',v.collector.g,['prepare','submerged'],{movable:false,drop:[seqDrop('basin',step('prepare'),step('submerged',true)),drop('lime','test')]}),e('hose',s.connected?'Tuyau relié':'Tuyau à raccorder',v.tools.hose,['connected'],{drop:[drop('collector','connected',true)]}),fixed('lime','Eau de chaux',v.lime.g,['test'],{readout:s.cloudy?'Trouble':'Limpide'})];}},
'M12-A04':{
 goal:s=>!s.loaded?'Tare la balance, puis dépose les matières préparées sur le plateau.':!s.before?'Mémorise la pesée avant de mélanger.':s.saltDish?'Verse le sel de la soucoupe dans le bécher.':'Agite et compare la masse en gardant les accessoires sur le plateau.',hint:'Prends la soucoupe pour verser le sel. L’agitateur et la soucoupe restent suivis dans le bilan de pesée.',
 build(v,k){addTool(v,k,'load','tray',-2.6,1.3);const supply=bottle(k,v.nm,0,0);supply.scale.setScalar(.46);v.tools.load.add(supply);supply.position.set(-.32,.13,0);const salt=k.scene.cyl(v.tools.load,.2,.24,.08,v.nm.solid,.36,.15,0);v.loadedParts=[supply,salt];addTool(v,k,'rod','rod',-1.9,.2);addTool(v,k,'memory','card',1.9,1.6);},
 update(v,s){v.extraRod.visible=false;v.tools.rod.position.set(s.rodOn?.45:-1.9,s.rodOn?.54:.10,s.rodOn?.24:.2);v.loadedParts.forEach(p=>p.visible=!s.loaded);},
 entities(s,v){return [fixed('scale','Balance · toucher pour tarer',v.scale.g,['tare','before'],click('tare')),fixed('sample','Bécher sur le plateau',v.cup.g,['spill']),e('dish','Soucoupe · sel',v.dish,['dishOn'],{movable:false,drop:[drop('sample','pour'),drop('scale','dishOn',true),drop('catch','dishOn',false)]}),e('rod','Agitateur',v.tools.rod,['rodOn'],{movable:false,drop:[seqDrop('sample',step('rodOn',true),step('stir')),drop('catch','rodOn',false)]}),e('load','Eau et sel préparés',v.tools.load,['load'],{drop:[drop('scale','load')],...click('load')}),fixed('memory','Mémoriser la pesée',v.tools.memory,['before'],click('before')),e('catch','Récupération hors plateau',v.catch.g)];}},
'M12-A05':{
 goal:s=>!s.sugarOpen?'Compare les deux glaçons et les deux sucres ; ouvre ensuite le sachet de sucre.':'Agite de nouveau : le sucre libéré peut maintenant toucher l’eau.',hint:'Touche les sachets pour les ouvrir. La baguette agite l’eau ; le minuteur fait avancer l’échange thermique.',
 build(v,k){addTool(v,k,'rod','rod',-.6,1.9);addTool(v,k,'timer','clock',1.5,1.9);},
 entities(s,v){return [...v.cups.map((c,i)=>fixed('cup'+i,['Glace libre','Glace en sachet','Sucre libre','Sucre en sachet'][i],c.g,i<2?['warm','heat']:[i===2?'naturalStirFree':'naturalStirBag'],i===1?click('openIce'):i===3?click('openSugar'):{})),e('rod','Agitateur · un bécher à la fois',v.tools.rod,['naturalStirFree','naturalStirBag'],{drop:[drop('cup2','naturalStirFree'),drop('cup3','naturalStirBag')]}),timerEntity(v,'timer','heat','Échange thermique · étape')];}},
'M12-A06':{
 goal:s=>s.stage==='weigh'?'Règle la masse pesée, puis verse-la dans la portion d’eau.':s.stage==='dissolved'?'Transfère le bécher dans la fiole.':s.stage==='transferred'&&s.beakerSalt>0?'Rince le bécher vers la fiole pour récupérer tout le sel.':s.finalVolume===null?'Complète avec la pissette jusqu’au trait de jauge.':!s.mixed?'Pose le bouchon et homogénéise la solution.':'Compare la concentration obtenue avec la cible.',hint:'Soucoupe vers bécher, bécher vers fiole, rinçage, puis ajustement au trait. Chaque geste correspond à une étape de préparation.',
 build(v,k){addTool(v,k,'water','pissette',3.2,.1);v.tools.cap=group(k,2.8,.05,1.5);k.scene.cyl(v.tools.cap,.16,.13,.27,v.nm.blue,0,.14,0);k.scene.cyl(v.tools.cap,.23,.23,.09,v.nm.blue,0,.33,0);addTool(v,k,'dose','tray',-3.6,1.4);v.weighed.visible=false;v.doseSalt=k.scene.cyl(v.tools.dose,.28,.32,.09,v.nm.solid,0,.18,0);},
 update(v,s){v.weighed.visible=false;v.doseSalt.visible=s.stage==='weigh';v.tools.cap.visible=!s.mixed;const portion=s.stage==='weigh'?.45:.45*s.beakerSalt/s.mass,h=Math.max(.001,(v.cup.height-.16)*portion);v.cup.liquid.visible=portion>small;v.cup.liquid.scale.y=h;v.cup.liquid.position.y=.075+h/2;},
 entities(s,v){return [fixed('scale','Balance · masse à préparer',v.scale.g,['mass','target','volume'],{readout:`${f(s.mass*1000)} g`}),e('dose','Soucoupe · sel pesé',v.tools.dose,['mass'],{drop:[drop('beaker','dissolve')]}),e('beaker','Bécher · dissoudre puis rincer',v.cup.g,['dissolve','lose'],{drop:[drop('flask','transfer')]}),fixed('flask','Fiole jaugée',v.flask,['volume','overfill','compare'],{readout:s.finalVolume?`${f(s.finalVolume*1e6)} mL`:'Volume à ajuster'}),e('water','Pissette · rincer / ajuster',v.tools.water,['rinse','mark'],{drop:[drop('beaker','rinse'),drop('flask','mark')]}),e('cap','Bouchon · homogénéiser',v.tools.cap,['mix'],{drop:[drop('flask','mix')]})];}},
'M13-A01':{
 goal:s=>s.source.water<=small?'Le bécher de départ est vide. Compare les matières recueillies ; recommence pour essayer une autre séparation.':!s.settled?'Laisse déposer le sable avec le minuteur, ou agite avec la baguette.':!s.paper?'Installe le papier filtre dans l’entonnoir.':'Verse le mélange dans le filtre, puis observe le filtrat et le résidu.',hint:'Papier vers entonnoir ; mélange vers filtre pour filtrer, ou vers récepteur pour décanter.',
 build(v,k){addTool(v,k,'rod','rod',-3.1,1.5);addTool(v,k,'timer','clock',-.4,1.8);v.tools.paperTool=group(k,2.9,.05,1.2);const paper=k.scene.mesh(v.tools.paperTool,new k.T.ConeGeometry(.48,.6,40,1,true),new k.T.MeshStandardMaterial({color:'#f0e9d7',roughness:.95,side:k.T.DoubleSide}),0,.35,0);paper.rotation.z=Math.PI;clampStand(k,v.nm,2,-.35,2.65);},
 update(v,s){v.tools.paperTool.visible=!s.paper&&s.filter.sand<=1e-10;},
 entities(s,v){return [e('source','Eau salée + sable',v.src.g,['settle','shake'],{drop:[drop('funnel','filter'),drop('receiver','decant')]}),fixed('funnel',s.paper?'Entonnoir · filtre installé':'Entonnoir · sans papier',v.funnel,['paper']),e('paper','Papier filtre plié',s.paper||s.filter.sand>1e-10?v.paper:v.tools.paperTool,['paper'],{movable:false,drop:[drop('funnel','paper',true)]}),fixed('receiver','Filtrat / liquide recueilli',v.dst.g,[],{readout:`${g(s.out.water)} d’eau`}),rodEntity(v,'rod','source','shake'),timerEntity(v,'timer','settle')];}},
'M13-A02':{
 goal:s=>s.loaded&&s.water+s.other<=small?'L’ampoule est vide. Compare le contenu des deux béchers, puis choisis un nouveau mélange.':!s.loaded?'Verse le mélange préparé dans l’ampoule.':s.pair==='ethanol'?(s.open?'Prélève dans les deux béchers : l’eau et l’éthanol sortent ensemble.':'Une seule phase : ouvre le robinet pour comparer les prélèvements, sans séparation eau/éthanol.'):!s.rested?'Laisse les deux phases se séparer au repos.':!s.open?'Place le bécher A sous le robinet, puis ouvre-le.':'Laisse sortir une fraction puis change de bécher à l’interface.',hint:s=>s.pair==='ethanol'?'Le robinet ne sépare pas ces liquides miscibles. Place A ou B sous le bec et compare leurs compositions.':'Le robinet s’ouvre au toucher. Dépose le bécher choisi sous le bec ; chaque étape écoule 20 g.',
 build(v,k){addTool(v,k,'dose','bottle',-2.7,.2,'#c7ad69');addTool(v,k,'timer','clock',2.7,.3);addTool(v,k,'flow','clock',2.3,1.8);},
 update(v,s){v.amp.grains.forEach((p,i)=>p.position.set(Math.sin(i*2.4)*.28,.55+(i%7)*.06,Math.cos(i*2.4)*.28));},
 entities(s,v){return [fixed('ampoule','Ampoule à décanter',v.amp.g,['pair','shake','rest']),e('dose','Mélange à séparer',v.tools.dose,['pair'],{drop:[drop('ampoule','load')]}),fixed('valve',s.open?'Robinet ouvert':'Robinet fermé',v.valve,['open'],click('open',!s.open)),...v.cups.map((c,i)=>e('cup'+i,'Bécher '+(i?'B':'A'),c.g,['receiver'],{movable:false,drop:[drop('valve','receiver',String(i))],...click('receiver',String(i))})),timerEntity(v,'timer','rest'),timerEntity(v,'flow','flow','Écouler une fraction · 20 g')];}},
'M13-A03':{
 goal:s=>s.water<=small?'Toute l’eau du ballon a été transférée. Compare le distillat, la vapeur sortie et le sel resté dans le ballon.':s.path!=='correct'?'Raccorde la conduite de vapeur au réfrigérant.':!s.cooling?'Active la circulation d’eau froide autour du conduit de vapeur.':!s.heater?'Allume le chauffe-ballon.':'Observe le distillat par étapes ; le sel reste dans le ballon.',hint:'Raccorde les deux circuits séparément, puis touche le chauffe-ballon. Le minuteur vaporise une fraction de 10 g.',
 build(v,k){addTool(v,k,'vapor','tube',-1,1.8);addTool(v,k,'water','bottle',2.8,1.6);addTool(v,k,'timer','clock',.6,1.8);v.tools.condenser=group(k,0,.05,0);const jacket=k.scene.tube(v.tools.condenser,[[-1.2,2.38,0],[1.1,1.72,0]],.19,v.nm.glass).mesh;clampStand(k,v.nm,.7,-.5,2.25);},
 entities(s,v){return [fixed('source','Ballon · eau salée',v.src.g),fixed('condenser','Réfrigérant · deux circuits',v.tools.condenser,['path','cooling']),e('vapor','Raccord de vapeur',v.tools.vapor,['path'],{drop:[drop('condenser','path','correct')]}),e('water','Circuit d’eau froide',v.tools.water,['cooling'],{drop:[drop('condenser','cooling',true)]}),fixed('heat',s.heater?'Chauffe-ballon allumé':'Chauffe-ballon éteint',v.heat,['heater'],click('heater',!s.heater)),fixed('receiver','Distillat',v.out.g,[],{readout:g(s.distillate)}),timerEntity(v,'timer','step','Vaporiser · étape de 10 g')];}},
'M13-A04':{
 goal:s=>s.mode==='oil'?'Observe les fractions de la tour : elles ne sont pas toutes des corps purs.':`Choisis l’ordre des opérations pour récupérer ${s.target==='water'?'l’eau':s.target==='salt'?'le sel':'le sable'}.`,hint:s=>s.mode==='oil'?'La tour présente des fractions de mélanges. Ouvre ses commandes pour revenir au mélange eau, sel et sable.':'Atelier documentaire : dépose les cartes d’opérations sur le mélange pour suivre la destination des constituants.',
 build(v,k){['filter','evaporate','distill'].forEach((id,i)=>addTool(v,k,id,'card',-2.4+i*2.4,1.7));},
 update(v,s){['filter','evaporate','distill'].forEach(id=>v.tools[id].visible=s.mode==='school');},
 entities(s,v){return [fixed('source',s.mode==='oil'?'Tour de fractionnement · document':'Mélange de départ',s.mode==='oil'?v.tower:v.c.g,s.mode==='oil'?['mode']:['mode','target']),...['filter','evaporate','distill'].map((id,i)=>e(id,['Filtration','Évaporation sans recueil','Distillation avec recueil'][i],v.tools[id],[],{drop:[drop('source',id)],...click(id)})),...(s.mode==='school'?[fixed('water','Eau recueillie',v.water.g),fixed('sand','Sable retenu',v.residue.g)]:[])];}},
'M14-A01':{
 goal:s=>!s.tested?'Relie le tuyau à l’eau de chaux pour y faire passer le gaz du prélèvement.':!s.evaporated?'Évapore le second prélèvement pour chercher un résidu.':'Ouvre la carte d’identité et confronte-la aux observations.',hint:'Le tuyau conduit le gaz vers l’eau de chaux : on ne verse pas l’échantillon dedans. Le second prélèvement sert à l’évaporation.',
 build(v,k){addTool(v,k,'card','card',-.4,1.7);addTool(v,k,'heat','heat',2,0);v.cups[2].g.position.y=.4;addTool(v,k,'hose','tube',-2,1.7);neckedVessel(v.cups[0],k,v.nm);k.scene.cyl(v.cups[0].g,.22,.19,.12,v.nm.dark,0,1.66,0);v.testTube=k.scene.tube(k.root,[[-2,1.76,0],[-2,2.08,0],[-.45,2.08,0],[0,1.35,0],[0,.32,0]],.035,v.nm.edge).mesh;},
 update(v,s){v.testTube.visible=s.tested;v.tools.hose.visible=!s.tested;},
 entities(s,v){return [fixed('sample','Prélèvement · dégagement du gaz',v.cups[0].g,['sample']),e('hose','Tuyau · gaz vers eau de chaux',v.tools.hose,['test'],{movable:false,drop:[drop('lime','test',undefined,s=>!s.tested)]}),fixed('lime',s.tested?'Eau de chaux · test effectué':'Eau de chaux · raccorder le tuyau',v.cups[1].g,[],{}),fixed('dish','Second prélèvement',v.cups[2].g),fixed('heat','Évaporer le second prélèvement',v.tools.heat,['evaporate'],click('evaporate')),e('card',s.revealed?'Composition connue':'Carte de composition',v.tools.card,['reveal'],click('reveal',!s.revealed))];}},
'M14-A02':{
 goal:s=>!s.heater&&s.seconds===0?'Relève la température initiale, puis allume la plaque.':'Avance le temps du modèle et relève le thermomètre pour tracer la courbe.',hint:'Touche le thermomètre pour relever. Le minuteur avance de 50 s simulées, sans attendre réellement.',
 build(v,k){addTool(v,k,'heat','heat',-2,0);v.c.g.position.y=.4;addTool(v,k,'thermometer','thermometer',-2.2,0);v.tools.thermometer.position.y=.35;addTool(v,k,'timer','clock',-2,1.8);clampStand(k,v.nm,-3,-.3,2.5);},
 entities(s,v){return [fixed('sample','Eau pure · 100 g',v.c.g),fixed('heat',s.heater?'Plaque · 100 W nets':'Plaque arrêtée',v.tools.heat,['heater'],click('heater',!s.heater)),fixed('thermometer','Thermomètre · relever',v.tools.thermometer,['record'],{readout:`${f(waterState(-2090+s.seconds*100).t)} °C`,...click('record')}),fixed('chart','Courbe des mesures',v.chart.g,['record']),timerEntity(v,'timer','advance','Avancer · 50 s du modèle')];}},
'M14-A03':{
 goal:()=> 'Compare les courbes qualitatives à chaque étape, en chauffage puis en refroidissement.',hint:'Le curseur fait parcourir les étapes du document. Aucune échelle de degrés ou de secondes n’est inventée.',
 build(v,k){addTool(v,k,'step','card',-2,1.7);addTool(v,k,'direction','card',.2,1.7);},
 entities(s,v){return [fixed('pure','Eau pure · courbe bleue',v.cups[0].g),fixed('salt','Eau salée · courbe rouge',v.cups[1].g),fixed('chart','Comparaison qualitative',v.chart.g,['direction']),fixed('step','Étape '+s.step+' / 6',v.tools.step,['next','back'],{adjust:{id:'naturalCurveStep',axis:'x',min:0,max:6,step:1,value:s.step,sensitivity:180}}),fixed('direction',s.direction==='heat'?'Chauffage':'Refroidissement',v.tools.direction,['direction'],click('direction',s.direction==='heat'?'cool':'heat'))];}},
'M14-A04':{
 goal:()=> 'Choisis une étiquette, règle le prélèvement et compare le résidu prévu.',hint:'Les deux eaux et leurs étiquettes sont fictives. Dépose leur carte près du prélèvement.',
 build(v,k){addTool(v,k,'A','card',-2.4,-.3);addTool(v,k,'B','card',-2.4,1.2);addTool(v,k,'heat','heat',1,0);v.c.g.position.y=.4;},
 entities(s,v){return [fixed('sample','Prélèvement · '+f(s.volume*1e6)+' mL',v.c.g,['volume'],{adjust:{id:'volume',axis:'y',min:100,max:2000,step:100,value:s.volume*1e6,sensitivity:200}}),e('A','Eau A · 200 mg/L',v.tools.A,[],{drop:[drop('sample','sample','A')],...click('sample','A')}),e('B','Eau B · 800 mg/L',v.tools.B,[],{drop:[drop('sample','sample','B')],...click('sample','B')}),fixed('heat','Évaporer · étape du modèle',v.tools.heat,['evaporate'],click('evaporate'))];}},
'M15-A01':{
 goal:s=>s.runoff?'Suis le ruissellement vers la rivière.':s.origin===0?'Les six jetons ont été suivis. Choisis une nouvelle source pour comparer la prévention.':'Place la prévention adaptée avant de suivre le prochain rejet.',hint:'Maquette documentaire : les six jetons suivent les destinations, ils ne mesurent pas un rendement réel.',
 build(v,k){['collection','buffer','pretreat'].forEach((id,i)=>addTool(v,k,id,'card',-2.5+i*2.5,2));addTool(v,k,'rain','clock',-3.6,1.7);addTool(v,k,'release','clock',-2.3,.3);},
 update(v,s){v.tools.release.position.x=s.source==='home'?-2.3:s.source==='farm'?0:2.3;},
 entities(s,v){return [fixed('home','Rejets domestiques',v.home,['source'],click('source','home')),fixed('farm','Ruissellement agricole',v.farm,['source'],click('source','farm')),fixed('factory','Rejets industriels',v.factory,['source'],click('source','factory')),fixed('origin',s.origin?`Source · ${s.origin} jetons restants`:'Source · trajet terminé',v.tools.release,['release'],click('release')),...['collection','buffer','pretreat'].map((id,i)=>e(id,['Collecte des rejets','Interception agricole','Prétraitement'][i],v.tools[id],['prevention'],{drop:[drop('home','prevention',id),drop('farm','prevention',id),drop('factory','prevention',id)],...click('prevention',id)})),timerEntity(v,'rain','rain','Suivre le ruissellement')];}},
'M15-A02':{
 goal:s=>s.chain.length===0?'Dépose la première opération sur le plan de la chaîne.':s.chain.length<6?'Ajoute l’opération suivante et observe le trajet des constituants.':'Compare la chaîne et essaie d’omettre une étape.',hint:'Atelier documentaire : les stations deviennent des cartes d’opérations que tu ajoutes dans ton ordre.',
 build(v,k){addTool(v,k,'chain','tray',3.5,1.6);},
 entities(s,v){return [...v.stations.map((c,i)=>e('station'+i,potableStages[i][1],c.g,[],{movable:false,drop:[seqDrop('chain',step('selected',potableStages[i][0]),step('append'))],click:sequence(step('selected',potableStages[i][0]),step('append'))})),fixed('chain',`${s.chain.length} étapes · plan de chaîne`,v.tools.chain,['remove','omitted'])];}},
'M15-A03':{
 goal:s=>s.stage===5?'Suis aussi la filière des boues et les matières non traitées.':`Choisis la prochaine opération : ${wasteStages[s.stage][1]}.`,hint:'Maquette documentaire : chaque station applique son étape au trajet courant ; le bassin biologique nécessite son aération.',
 build(v,k){addTool(v,k,'air','card',1.3,1.7);},
 entities(s,v){return [...v.tanks.map((c,i)=>fixed('tank'+i,wasteStages[i][1],c.g,[],{click:sequence(step('selected',wasteStages[i][0]),step('apply'))})),fixed('sludge','Boues · filière séparée',v.sludge.g),fixed('air',s.air?'Aération active':'Aération coupée',v.tools.air,['air'],click('air',!s.air))];}},
'M15-A04':{
 goal:()=> 'Suis une matière vers une destination et examine ce qui reste à contrôler.',hint:'Document : dépose la matière sur une destination. Changer d’emplacement ne suffit pas à la traiter.',
 entities(s,v){const options=s.topic==='water'?[['river','Rejet au milieu'],['reuse','Réutilisation'],['tap','Robinet direct']]:s.topic==='sludge'?[['store','Stockage'],['recover','Valorisation'],['dump','Abandon']]:[['store','Bassin de stockage'],['soil','Surfaces perméables'],['direct','Écoulement direct']];return [e('source','Matière à suivre',v.source.g,['topic'],{movable:false,drop:options.map(([id],i)=>seqDrop('target'+i,step('choice',id),step('apply')))}),...v.targets.map((c,i)=>fixed('target'+i,options[i][1],c.g,[],{click:sequence(step('choice',options[i][0]),step('apply'))}))];}}
};
export const transformationIds=Object.keys(configs);
export function refineTransformations(base){
 const cfg=configs[base.id];if(!cfg||!supported.test(base.id))return base;
 return {...base,
  controls(s){const controls=base.controls(s);if(base.id==='M12-A02')return controls.map(c=>c.id==='dose'?{...c,label:'Prochaine dose de NaCl'}:c).concat({id:'naturalScoop',type:'button',label:'Reprendre une cuillère dans la réserve',disabled:s.salt>=.15-small||s.doseG<=small});if(base.id==='M12-A05')return controls.concat({id:'naturalStirFree',type:'button',label:'Agiter le sucre libre',disabled:s.sugarFree===1},{id:'naturalStirBag',type:'button',label:'Agiter le bécher du sucre en sachet',disabled:s.sugarBag===1});return controls;},
  valid(s){return base.valid(s)&&(base.id!=='M12-A02'||s.naturalSpoonG===undefined||Number.isFinite(s.naturalSpoonG)&&s.naturalSpoonG>=0&&s.naturalSpoonG<=50);},
  act(s,id,value){
   if(base.id==='M12-A02'&&id==='naturalScoop')return {...s,naturalSpoonG:Math.min(s.doseG,Math.max(0,.15-s.salt)*1000)};
   if(base.id==='M12-A02'&&id==='naturalSpoonPour'){const n=base.act.call(base,{...s,doseG:spoonLoad(s)},'add');n.doseG=s.doseG;n.naturalSpoonG=0;return n;}
   if(base.id==='M12-A05'&&['naturalStirFree','naturalStirBag'].includes(id)){const n=base.act.call(base,s,'stir');if(id==='naturalStirFree')n.sugarBag=s.sugarBag;else n.sugarFree=s.sugarFree;return n;}
   if(id==='naturalSteps'){let n=s;for(const op of Array.isArray(value)?value.slice(0,4):[]){if(!op||typeof op.id!=='string'||op.id.startsWith('natural'))continue;if(!base.controls(n).find(c=>c.id===op.id)?.disabled)n=base.act.call(base,n,op.id,op.value);}return n;}
   if(id==='naturalCurveStep'&&base.id==='M14-A03'){const n=Math.max(0,Math.min(6,Math.round(Number(value)||0)));let next=s;for(let i=0;i<6&&next.step!==n;i++)next=base.act.call(base,next,next.step<n?'next':'back');return next;}
   if(base.controls(s).find(c=>c.id===id)?.disabled)return {...s};
   return base.act.call(base,s,id,value);
  },
  build(k){const assembly=new k.T.Group();assembly.name='Transformation apparatus';k.root.add(assembly);const buildKit={...k,root:assembly};const v=base.build(buildKit);v.assembly=assembly;v.tools={};v.nm=materials(k);v.vessels=collectVessels(v);
   k.root.traverse(o=>{if(base.id==='M12-A06'&&o.userData.workshopAction?.id==='rinse')o.parent.visible=false;if(o.userData.naturalObsolete||o.material?.map)o.visible=false;delete o.userData.workshopAction;});
   v.vessels.forEach(c=>{if(c.rod)c.rod.visible=false;});
   cfg.build?.(v,buildKit);assembly.scale.setScalar(1.35);return v;
  },
  update(v,s,k){base.update(v,s,k);if(v.tools.dose?.userData.naturalLiquidIndex!==undefined)v.tools.dose.children[v.tools.dose.userData.naturalLiquidIndex].visible=!(s.added||s.loaded);if(base.id==='M12-A01')v.stock.body.scale.y=1;if(base.id==='M13-A02'&&v.amp.meniscus)v.amp.meniscus.visible=false;if(base.id==='M11-A03')fill(v.c,.62);v.vessels.forEach(c=>{if(c.rod)c.rod.visible=false;if(c.tag)c.tag.visible=false;});
   cfg.update?.(v,s,k);
  },
  natural:{
   goal:cfg.goal,hint:cfg.hint,
   entities:(s,v,k)=>cfg.entities(s,v,k).filter(x=>x.object?.visible!==false).map(x=>{const blocked=id=>base.controls(s).find(c=>c.id===id)?.disabled;if(x.click&&blocked(x.click.id))delete x.click;if(x.drop)x.drop=x.drop.filter(d=>!blocked(d.action));if(x.drop?.length){if(['rod','collector'].includes(x.id)||base.id==='M09-A01'&&x.id==='sample')x.pose='dip';else if(['dose','spoon','water','source','beaker','dish'].includes(x.id)||base.id==='M14-A01'&&x.id==='sample')x.pose='pour';}return x;}),
   readings:s=>(base.observe(s).metrics||[]).slice(0,3),
   instrument(s,entityId){if(!['thermometer','chart','model','case','scale','chain','source','card','sample','after','piston'].includes(entityId))return '';const o=base.observe(s);let chart='';
    if(base.id==='M14-A02'){
     const pts=s.records.map(p=>`${42+p.seconds/3050*292},${150-(p.temperature+20)/140*120}`).join(' ');
     chart=`<svg viewBox="0 0 360 184" role="img" aria-label="Température relevée en fonction du temps simulé"><rect width="360" height="184" fill="#fffdf7"/><path d="M42 24V150H334" fill="none" stroke="#243b48"/>${[-20,0,100].map(t=>`<text x="5" y="${154-(t+20)/140*120}" font-size="12">${t} °C</text>`).join('')}<polyline points="${pts}" fill="none" stroke="#275d78" stroke-width="2.5"/>${s.records.map(p=>`<circle cx="${42+p.seconds/3050*292}" cy="${150-(p.temperature+20)/140*120}" r="3.5" fill="#275d78"/>`).join('')}<text x="42" y="173" font-size="12">0 s</text><text x="218" y="173" font-size="12">Temps simulé →</text></svg>`;
    }
    if(base.id==='M14-A03'){
     const c=qualitativeCurves[s.direction],points=ys=>ys.slice(0,s.step+1).map((y,i)=>`${42+i/6*272},${142-y/4.2*104}`).join(' ');
     chart=`<svg viewBox="0 0 360 205" role="img" aria-label="Courbes qualitatives de l’eau pure et de l’eau salée"><rect width="360" height="205" fill="#fffdf7"/><path d="M42 25V142H324" fill="none" stroke="#243b48"/><text x="8" y="18" font-size="12">Tendance de température</text><polyline points="${points(c.pure)}" fill="none" stroke="#2875a0" stroke-width="3"/><polyline points="${points(c.salt)}" fill="none" stroke="#b95c43" stroke-width="3"/>${c.pure.slice(0,s.step+1).map((y,i)=>`<circle cx="${42+i/6*272}" cy="${142-y/4.2*104}" r="3" fill="#2875a0"/>`).join('')}${c.salt.slice(0,s.step+1).map((y,i)=>`<circle cx="${42+i/6*272}" cy="${142-y/4.2*104}" r="3" fill="#b95c43"/>`).join('')}<text x="42" y="163" font-size="12">0</text><text x="306" y="163" font-size="12">6</text><text x="97" y="164" font-size="12">Étapes · sans durée</text><text x="42" y="190" font-size="13" fill="#2875a0">Eau pure</text><text x="207" y="190" font-size="13" fill="#b95c43">Eau salée</text></svg>`;
    }
    return `<section class="natural-science"><h3>${esc(o.title)}</h3>${chart}<p>${esc(cfg.goal(s))}</p>${(o.metrics||[]).slice(0,3).map(m=>`<p><span>${esc(m.label)}</span> <strong>${esc(m.value)}</strong></p>`).join('')}${o.warning?`<p>${esc(o.warning)}</p>`:''}<details><summary>Modèle et limites</summary>${o.lines.map(l=>`<p>${esc(l)}</p>`).join('')}</details></section>`;
   }
  }
 };
}
