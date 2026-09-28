import * as T from '../vendor/three.module.min.js';
import '../scene.js';
import {workshops} from './registry.js';
import {refineCircuit,refineWater} from './reference-models.js';
import {refineParallel} from './reference-parallel.js';
import {refineMixed} from './reference-mixed.js';
import {refineGroups} from './reference-groups.js';
import {refineSignal} from './reference-signal.js';
import {refineDisplacement} from './reference-displacement.js';
import {ReferenceUI} from './reference-ui.js';
import {NaturalUI} from './natural-ui.js';
import {wrapNatural} from './natural-workbench.js';
import {refineElectricity} from './natural-electricite.js';
import {refineElectricityMeasures} from './natural-electricite-mesures.js';
import {refineElectricityContexts} from './natural-electricite-contextes.js';
import {refineMeasurements} from './natural-mesures.js';
import {refineTransformations} from './natural-transformations.js';
import {STORE,MAX_TRIALS,clone,blank,readStore,matchesState,finiteJSON} from './store.js';

const definitions=new Map(workshops.map(w=>[w.id,w.id==='E03-A1'?refineCircuit(w):w.id==='E03-A2'?refineParallel(w):w.id==='E03-A3'?refineMixed(w):w.id==='E03-A4'?refineGroups(w):w.id==='E03-A5'?refineSignal(w):w.id==='M03-A02'?refineWater(w):w.id==='M03-A03'?refineDisplacement(w):wrapNatural(refineTransformations(refineMeasurements(refineElectricity(refineElectricityMeasures(refineElectricityContexts(w))))))]));
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kindLabel=kind=>({experience_interactive:'Expérience interactive',modele_explicatif:'Modèle explicatif',exploration_documentaire:'Exploration documentaire'}[kind]||'Atelier');
const list=items=>'<ul>'+items.map(i=>`<li>${esc(i)}</li>`).join('')+'</ul>';
let catalogue,activities,room,root,kit,view,current,state,undo=[],redo=[],data=blank(),blocked=false,drawerType='',returnFocus=null,noticeTimer,ready=false;
let moduleTextures=[];
let referenceUI,naturalUI;
function say(message){const inside=$('drawer').open;$('feedback').textContent=message;$('feedback').classList.toggle('visible',!inside);$('dialog-feedback').textContent=inside?message:'';$('dialog-feedback').hidden=!inside;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('feedback').classList.remove('visible');$('dialog-feedback').hidden=true;},6000);}
function persist(){
  if(blocked)return false;
  try{localStorage.setItem(STORE,JSON.stringify(data));$('storage-status').textContent='Enregistré sur cet appareil';return true;}
  catch{$('storage-status').textContent='Session seulement · stockage indisponible';say('L’enregistrement local a échoué. Garde cette page ouverte : tes essais restent disponibles pendant cette session.');return false;}
}
function storeDraft(){if(!current)return;data.drafts[current.id]=clone(state);data.lastWorkshop=current.id;persist();}
function pages(p){return p.length?`${Math.min(...p)}–${Math.max(...p)}`:'à consulter';}
function disposeView(){
  if(!root)return;
  const preserved=new Set(Object.values(room.materials)),textures=new Set(moduleTextures),materials=new Set(),geometries=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!preserved.has(m)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture&&!room.textures.includes(v))textures.add(v);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());room.textures=room.textures.filter(t=>!textures.has(t));room.scene.remove(root);root=null;view=null;moduleTextures=[];
}
function canRestore(value,definition){try{return matchesState(value,definition.initial())&&(!definition.valid||definition.valid(value))&&(definition.observe(value),definition.controls(value),true);}catch{return false;}}
function openWorkshop(id,{trial=null,history=true}={}){
  referenceUI?.finishGesture();naturalUI?.finish(true);
  if(id==='E02-A1'){location.href='../';return;}
  const next=definitions.get(id);if(!next){say('Cet atelier figure au programme et reste à construire.');openDrawer('catalogue');return;}
  if(trial&&!canRestore(trial.state,next)){say('Cet essai ne peut pas être repris : ses réglages sont incomplets ou incohérents. L’original reste conservé dans le carnet.');return false;}
  if(current)storeDraft();
  disposeView();current=next;undo=[];redo=[];
  const draft=trial?trial.state:data.drafts[id];
  state=canRestore(draft,next)?clone(draft):next.initial();
  if(next.restore)state=next.restore(state);
  if(draft!==undefined&&!canRestore(draft,next))say('Ce brouillon ne peut pas être repris ; un nouvel essai est ouvert. Les essais du carnet sont conservés.');
  if(trial)data.notes[id]=trial.note;
  root=new T.Group();root.name=id;room.scene.add(root);
  kit={T,root,scene:room,invalidate:()=>room.invalidate(),act:act};
  const before=new Set(room.textures);
  try{view=current.build(kit);moduleTextures=room.textures.filter(t=>!before.has(t));refresh();}
  catch(error){console.error(error);say('Le matériel de cet atelier n’a pas pu être affiché.');throw error;}
  const meta=activities.get(id);
  $('heading').innerHTML=`${esc(meta.title)}<small>${esc(meta.lesson.title)} · ${esc(id)}</small>`;
  $('source').textContent=`${id} · Manuel p. ${pages(meta.manual_pages)} · ${kindLabel(meta.kind)}`;
  document.title=`${meta.title} · H le Labo`;
  if(history){const url=new URL(location.href);url.searchParams.set('atelier',id);window.history.pushState({},'',url);}
  closeDrawer();storeDraft();return true;
}
function controlHTML(c){
  const id=`ctl-${c.id}`,disabled=c.disabled?' disabled':'';
  if(c.type==='button')return `<button id="${esc(id)}" data-control="${esc(c.id)}"${disabled}>${esc(c.label)}</button>`;
  if(c.type==='checkbox')return `<label class="check" for="${esc(id)}"><input id="${esc(id)}" data-control="${esc(c.id)}" type="checkbox" ${c.value?'checked':''}${disabled}>${esc(c.label)}</label>`;
  let input='';
  if(c.type==='select')input=`<select id="${esc(id)}" data-control="${esc(c.id)}"${disabled}>${c.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(c.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
  else input=`<input id="${esc(id)}" data-control="${esc(c.id)}" type="${['number','text','range'].includes(c.type)?c.type:'number'}" value="${esc(c.value)}"${c.min!==undefined?` min="${esc(c.min)}"`:''}${c.max!==undefined?` max="${esc(c.max)}"`:''}${c.step!==undefined?` step="${esc(c.step)}"`:''}${disabled}>`;
  return `<label class="control" for="${esc(id)}"><span>${esc(c.label)}${c.type==='range'?`<span class="unit">${esc(c.value)} ${esc(c.unit||'')}</span>`:''}</span>${input}</label>`;
}
function refresh(){
  if(!current)return;
  referenceUI?.stopSettle();
  current.update(view,state,kit);
  const observation=current.observe(state);
  if(current.reference||current.natural)room.updateReferenceBoard(current.boardTitle??(current.natural?'OBSERVER · MANIPULER':current.parallel?'LE CIRCUIT EN DÉRIVATION':current.reference==='circuit'?'LE CIRCUIT · VALEURS CALCULÉES':'LIRE ET PRÉPARER UN VOLUME'),observation.boardMetrics??observation.metrics??[],current.boardRule??(current.natural?'Observer · Déduire · Comprendre · Appliquer':current.reference==='circuit'?'P = U × I · comparer l’éclat des lampes':'Lire le bas du ménisque à hauteur du regard.'));
  else room.updateWorkshopBoard(current.id,observation.board||observation.lines||[]);
  room.scene.updateMatrixWorld(true);room.invalidate();
  const focused=document.activeElement?.id;
  $('controls').innerHTML=current.reference||current.natural?'':current.controls(state).map(controlHTML).join('');
  if(focused?.startsWith('ctl-')){const next=$(focused);(next&&!next.disabled?next:$('controls').querySelector('button:not(:disabled),input:not(:disabled),select:not(:disabled)'))?.focus({preventScroll:true});}
  $('observation').innerHTML=`<h2>${esc(observation.title)}</h2><div class="metrics">${(observation.metrics||[]).map(m=>`<div class="metric">${esc(m.label)}<b>${esc(m.value)}</b></div>`).join('')}</div>${(observation.lines||[]).map(l=>`<p>${esc(l)}</p>`).join('')}${observation.warning?`<p class="warning">${esc(observation.warning)}</p>`:''}`;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
  referenceUI?.sync();naturalUI?.sync();
}
function preview(next){if(!finiteJSON(next)||!current.valid(next))throw Error('État de geste non valide');state=next;refresh();}
function change(next,{before=state}={}){
  if(!finiteJSON(next)||!current.valid(next))throw Error('État scientifique non valide');
  if(JSON.stringify(next)===JSON.stringify(before)){if(JSON.stringify(next)!==JSON.stringify(state))preview(next);return;}
  undo.push(clone(before));if(undo.length>50)undo.shift();redo=[];state=next;refresh();storeDraft();
}
function act(id,value){if(!current)return;referenceUI?.press.cancel();try{change(current.act(clone(state),id,value));}catch(error){console.error(error);say('Cette manipulation n’a pas pu être appliquée.');}}
function catalogueHTML(){return `<p class="catalogue-intro">${definitions.size+1} ateliers à explorer. Choisis une activité, puis suis la consigne sur la table. Saisis les objets pour manipuler et touche un appareil pour ses commandes. Les modèles et les explorations documentaires sont indiqués ci-dessous.</p><label for="search">Rechercher une leçon ou un atelier</label><input id="search" class="search" type="search" placeholder="Volume, dissolution, circuit…"><div id="lessons">${catalogue.lessons.map(l=>`<details class="lesson" ${l.activities.some(a=>a.id===current?.id)?'open':''}><summary>${esc(l.title)} <small>· ${l.activities.filter(a=>definitions.has(a.id)||a.id==='E02-A1').length}/${l.activities.length}</small></summary><div class="activities">${l.activities.map(a=>definitions.has(a.id)?`<button class="activity" data-open="${esc(a.id)}" aria-current="${current?.id===a.id}"><span>${esc(a.title)}</span><small>${esc(a.id)} · ${esc(kindLabel(a.kind))}</small></button>`:a.id==='E02-A1'?`<a class="activity link-button" href="../"><span>${esc(a.title)}</span><small>E02-A1 · Ouvrir l’atelier</small></a>`:`<div class="activity planned"><span>${esc(a.title)}</span><small>${esc(a.id)} · À construire</small></div>`).join('')}</div></details>`).join('')}</div>`;}
function helpHTML(){
  const a=activities.get(current.id);
  return `<p class="muted">${esc(kindLabel(a.kind))} · ${esc(a.id)}</p><p><strong>${esc(a.lesson.central_question)}</strong></p><p>${current.natural?esc((typeof current.natural.hint==='function'?current.natural.hint(state):current.natural.hint)||'Saisis les objets sur la table ; touche un appareil pour afficher ses commandes.') :current.reference==='immersion'?'Glisse un solide dans l’éprouvette, puis tire le solide ou son fil pour le soulever. Touche l’éprouvette pour comparer les niveaux avant et après. Les commandes de Matériel sont aussi utilisables au clavier.':current.momentary?'Maintiens le bouton du poussoir pour allumer la lampe, puis relâche pour l’éteindre. Saisis les socles pour les déplacer et relie deux bornes pour brancher un fil. Les boutons Signal court et Signal long permettent de composer sans contrainte de vitesse.':current.reference==='circuit'?'Saisis les socles pour déplacer les composants ; relie deux bornes pour brancher un fil. Touche un levier pour ouvrir son contact. Les commandes complémentaires sont dans Matériel.':current.reference==='water'?'Saisis la bouteille pour verser dans l’éprouvette et le compte-gouttes pour ajuster. Touche l’éprouvette pour lire les graduations.':'Manipule les objets qui réagissent au clic, ou utilise les commandes « Manipuler ».'} Tu peux annuler un geste, recommencer et garder plusieurs essais.</p>${[
    ['Observer',list(a.student_actions)+list(a.observations)],
    ['Déduire',`<p>${esc(a.deduction)}</p>`],
    ['Comprendre',`<p>${esc(a.explanation)}</p>`+list(a.correction_rules)],
    ['Appliquer',`<p>${esc(a.application)}</p>`],
    ['Limites de la simulation',list(a.model_limits)+`<p>Les mesures affichées proviennent d’un modèle. Les scénarios et hypothèses propres à cet atelier sont précisés dans « Observer ».</p>`]
  ].map(([title,body])=>`<details class="help-step"><summary>${title}</summary>${body}</details>`).join('')}<p class="muted">Manuel : pages ${esc(a.manual_pages.join(', '))}.${a.guide_pages?.length?` Guide enseignant : pages ${esc(a.guide_pages.join(', '))}.`:''}</p>`;
}
function notebookHTML(){
  return `<p>Chaque essai conserve la table, les réglages et ta note. Tu peux en ouvrir une copie ou le supprimer.</p><a class="link-button" href="../?carnet=1">Carnet du premier circuit E02-A1</a>${data.deletedTrial?'<p><button data-ui="restore">Annuler la dernière suppression</button></p>':''}${data.trials.length?`<div class="trials">${[...data.trials].reverse().map(t=>`<article class="trial">${t.image?`<img src="${esc(t.image)}" alt="Capture de ${esc(t.title)}" loading="lazy">`:''}<div class="trial-content"><small>${esc(t.workshopId)} · ${new Date(t.savedAt).toLocaleString('fr-FR')}</small><h2>${esc(t.title)}</h2>${t.note?`<p class="note">${esc(t.note)}</p>`:''}<div class="trial-actions"><button data-copy="${esc(t.id)}">Ouvrir une copie</button><button data-delete="${esc(t.id)}">Supprimer</button></div></div></article>`).join('')}</div>`:'<p class="empty">Aucun essai conservé ici. Utilise « Conserver cet essai » sur la table.</p>'}`;
}
function openDrawer(type){
  referenceUI?.finishGesture();naturalUI?.finish(true);
  drawerType=type;
  const titles={catalogue:'Choisir un atelier',notebook:'Mon carnet d’expériences',note:'Ma note',help:'Observer · Déduire · Comprendre · Appliquer',material:'Le matériel',measures:'Mes observations et mesures',schema:'Le schéma de mon montage'};
  $('drawer-title').textContent=titles[type];
  $('drawer-body').innerHTML=type==='catalogue'?catalogueHTML():type==='notebook'?notebookHTML():type==='help'?helpHTML():`<p>${esc(activities.get(current.id).title)}</p><label for="note">Mes observations, mes idées et mes questions</label><textarea id="note" maxlength="4000" placeholder="J’observe que…">${esc(data.notes[current.id]||'')}</textarea><p class="muted">La note est enregistrée avec le brouillon ; « Conserver cet essai » en garde une copie dans le carnet.</p>`;
  if(type==='material')$('drawer-body').innerHTML=`<p>${current.materialIntro??(current.natural?'Manipule les appareils directement sur la table. Ces commandes permettent aussi de réaliser les gestes au clavier et de régler le matériel.':current.parallel?'Chaque branche possède sa lampe et son interrupteur. Ajoute une branche, déplace le matériel ou enlève les fils pour construire ton montage.':current.reference==='circuit'?'Ajoute une lampe en série, puis compare son éclat. Sur la table, tu peux aussi déplacer les objets et brancher les fils toi-même.':'Choisis l’éprouvette et le volume à préparer. Touche ensuite la bouteille, le compte-gouttes ou l’éprouvette sur la table.')}</p><div class="reference-material-controls">${current.controls(state).map(controlHTML).join('')}</div>`;
  if(type==='measures')$('drawer-body').innerHTML=$('observation').innerHTML;
  if(type==='schema')$('drawer-body').innerHTML=referenceUI.schema();
  if(!$('drawer').open){returnFocus=document.activeElement;$('drawer').showModal();}
  if(type==='note')$('note').focus();
}
function closeDrawer(){if($('drawer').open)$('drawer').close();}
function snapshot(){
  try{room.renderer.render(room.scene,room.camera);const c=document.createElement('canvas');c.width=480;c.height=300;const ctx=c.getContext('2d'),src=room.canvas;ctx.fillStyle='#ece6dd';ctx.fillRect(0,0,480,300);const scale=Math.min(480/src.width,300/src.height),w=src.width*scale,h=src.height*scale;ctx.drawImage(src,(480-w)/2,(300-h)/2,w,h);if(current.natural){ctx.fillStyle='#fffaf4';ctx.fillRect(0,260,480,40);ctx.fillStyle='#203b48';ctx.font='bold 12px sans-serif';ctx.fillText(activities.get(current.id).title,10,275,460);ctx.font='11px sans-serif';ctx.fillText((current.observe(state).metrics||[]).slice(0,3).map(m=>m.label+' : '+m.value).join(' · '),10,291,460);}return c.toDataURL('image/jpeg',.7);}catch{return '';}
}
function saveTrial(){
  if(data.trials.length>=MAX_TRIALS){say(`Le carnet contient ${MAX_TRIALS} essais. Supprime un ancien essai pour faire de la place.`);return;}
  const t={id:crypto.randomUUID(),workshopId:current.id,title:activities.get(current.id).title,state:clone(state),note:data.notes[current.id]||'',savedAt:Date.now(),image:snapshot()};
  data.trials.push(t);if(persist())say('Essai conservé avec sa capture et sa note.');
}
$('controls').addEventListener('click',e=>{const el=e.target.closest('button[data-control]');if(el)act(el.dataset.control);});
$('drawer-body').addEventListener('click',e=>{const el=e.target.closest('button[data-control]');if(el){act(el.dataset.control);if(drawerType==='material')openDrawer('material');}});
$('drawer-body').addEventListener('change',e=>{const el=e.target;if(!el.dataset.control)return;act(el.dataset.control,el.type==='checkbox'?el.checked:el.type==='range'||el.type==='number'?Number(el.value):el.value);if(drawerType==='material')openDrawer('material');});
$('controls').addEventListener('change',e=>{const el=e.target;if(!el.dataset.control)return;act(el.dataset.control,el.type==='checkbox'?el.checked:el.type==='range'||el.type==='number'?Number(el.value):el.value);});
$('controls').addEventListener('input',e=>{if(e.target.type==='range')e.target.closest('label').querySelector('.unit').textContent=`${e.target.value} ${current.controls(state).find(c=>c.id===e.target.dataset.control)?.unit||''}`;});
document.addEventListener('click',e=>{
  const open=e.target.closest('[data-open]');if(open){openWorkshop(open.dataset.open);return;}
  const copy=e.target.closest('[data-copy]');if(copy){const t=data.trials.find(t=>t.id===copy.dataset.copy);if(t&&openWorkshop(t.workshopId,{trial:t})){say('Une copie est ouverte. L’essai conservé reste dans le carnet.');}return;}
  const del=e.target.closest('[data-delete]');if(del){const i=data.trials.findIndex(t=>t.id===del.dataset.delete);if(i>=0){data.deletedTrial=data.trials.splice(i,1)[0];persist();openDrawer('notebook');say('Essai supprimé. Tu peux annuler cette suppression.');}return;}
  const action=e.target.closest('[data-ui]')?.dataset.ui;if(!action)return;
  if(['catalogue','notebook','help','note'].includes(action)){if(ready)openDrawer(action);return;}
  if(action==='close'){closeDrawer();return;}
  if(!ready)return;
  if(['save','reset','undo','redo'].includes(action)){referenceUI?.finishGesture();naturalUI?.finish(true);}
  if(action==='save')saveTrial();
  if(action==='reset'){change(current.initial());say('La manipulation recommence. Tes essais conservés restent dans le carnet.');}
  if(action==='undo'||action==='redo'){const from=action==='undo'?undo:redo,to=action==='undo'?redo:undo;if(from.length){to.push(clone(state));state=from.pop();refresh();storeDraft();}}
  if(action==='restore'&&data.deletedTrial){if(data.trials.length>=MAX_TRIALS){say('Libère une place dans le carnet pour restaurer cet essai.');return;}data.trials.push(data.deletedTrial);data.deletedTrial=null;persist();openDrawer('notebook');say('Essai restauré avec sa capture et sa note.');}
});
$('drawer-body').addEventListener('input',e=>{
  if(e.target.id==='note'){data.notes[current.id]=e.target.value;persist();}
  if(e.target.id==='search'){const query=e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();document.querySelectorAll('.lesson').forEach(el=>{const matches=el.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query);el.hidden=!matches;if(query&&matches)el.open=true;});}
});
$('drawer').addEventListener('close',()=>{$('dialog-feedback').hidden=true;drawerType='';returnFocus?.focus?.({preventScroll:true});});
window.addEventListener('storage',e=>{if(e.key===STORE||e.key===null){blocked=true;$('storage-status').textContent='Session seulement · carnet modifié dans un autre onglet';say('Un autre onglet a modifié le carnet. Recharge cette page pour utiliser la nouvelle version ; cette table reste disponible ici.');}});
window.addEventListener('popstate',()=>{if(ready)openWorkshop(new URL(location.href).searchParams.get('atelier')||data.lastWorkshop||'M03-A01',{history:false});});
const mobile=matchMedia('(max-width:650px)');
function mobilePanels(){if(mobile.matches){$('observations').open=false;$('manipulate').open=false;}}
mobilePanels();mobile.addEventListener('change',mobilePanels);
for(const [a,b]of [['manipulate','observations'],['observations','manipulate']])$(a).addEventListener('toggle',()=>{if(mobile.matches&&$(a).open)$(b).open=false;});
function clickablePositions(){
  const positions=[];root.traverse(o=>{if(!o.userData.workshopAction)return;let n=o;while(n){if(!n.visible)return;n=n.parent;}const p=new T.Box3().setFromObject(o).getCenter(new T.Vector3());positions.push({...o.userData.workshopAction,...room.project(p)});});return positions;
}
function directPositions(){if(!current.parallel&&!current.directCircuit)return [];root.updateMatrixWorld(true);return Object.entries(view.devices).filter(([,d])=>d.g.visible).flatMap(([id,d])=>d.s.pressTarget?[{id,gesture:'press',...room.project(d.s.pressTarget.localToWorld(new T.Vector3(0,.1,0)))}]:d.s.lever?[{id,gesture:'switch',...room.project(d.s.lever.localToWorld(new T.Vector3(.5,.035,0)))}]:d.s.bulb?[{id,gesture:'bulb',...room.project(d.s.bulb.localToWorld(new T.Vector3(0,.7,.18)))}]:[]);}
async function start(){
  const response=await fetch('./catalogue.json');if(!response.ok)throw Error('Catalogue indisponible');catalogue=await response.json();
  activities=new Map(catalogue.lessons.flatMap(l=>l.activities.map(a=>[a.id,{...a,lesson:l}])));
  try{data=readStore(localStorage.getItem(STORE));}catch{blocked=true;$('storage-status').textContent='Session seulement · ancien carnet préservé';say('Le carnet enregistré ne peut pas être lu. Il est préservé ; cette session utilise un carnet temporaire.');}
  room=new window.Hidaya3D();Object.values(room.objects).forEach(g=>g.visible=false);room.wires.visible=false;room.halo.visible=false;room.lampLight.intensity=0;
  room.mount($('stage'));new ResizeObserver(()=>room.resize($('stage').clientWidth,$('stage').clientHeight)).observe($('stage'));
  referenceUI=new ReferenceUI({stage:$('stage'),main:document.querySelector('main'),get:()=>({room,root,kit,view,current,state}),act,commit:change,preview,say,openDrawer,drawerOpen:()=>$('drawer').open});
  naturalUI=new NaturalUI({stage:$('stage'),main:document.querySelector('main'),get:()=>({room,root,kit,view,current,state}),act,commit:change,preview,say,openDrawer,drawerOpen:()=>$('drawer').open});
  room.canvas.addEventListener('click',e=>{if(!root||$('drawer').open||current.natural)return;const rect=room.canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),room.camera);for(const hit of ray.intersectObject(root,true)){let n=hit.object,visible=true,action=null;while(n&&n!==room.scene){if(!n.visible)visible=false;if(!action&&n.userData.workshopAction)action=n.userData.workshopAction;n=n.parent;}if(visible&&action){act(action.id,action.value);return;}}});
  room.canvas.addEventListener('lab-context-lost',()=>say('La vue 3D a été interrompue. Recharge la page ; tes essais enregistrés sont conservés.'));
  const requested=new URL(location.href).searchParams.get('atelier');
  openWorkshop(definitions.has(requested)?requested:definitions.has(data.lastWorkshop)?data.lastWorkshop:'M03-A01',{history:false});ready=true;
  window.atelierDiagnostics=()=>({id:current.id,state:clone(state),stateValid:current.valid(state),observation:current.observe(state),available:[...definitions.keys(),'E02-A1'],total:activities.size,stats:room.stats(),camera:room.camera.position.toArray(),rootChildren:root.children.length,clickables:clickablePositions(),direct:directPositions(),natural:naturalUI?.diagnostics()??[],blockedStorage:blocked});
  if(!requested)openDrawer('catalogue');
}
start().catch(error=>{console.error(error);$('stage').innerHTML='<div class="error"><strong>Le laboratoire n’a pas pu démarrer.</strong><p>Vérifie que ton navigateur prend en charge WebGL, puis recharge la page.</p><a href="../../classique.html">Ouvrir le circuit en vue classique</a></div>';});
