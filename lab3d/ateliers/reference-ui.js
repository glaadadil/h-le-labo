import {ImmersionUI} from './reference-immersion-ui.js';
import {MomentaryPress} from './reference-press.js';
import {wiresFor,terminals,parallelBench,switchIds,switchClosed,lampRemoved} from './reference-circuit.js';
import {waterScales,bottleVolume,dropperVolume,poseWater} from './reference-models.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={pile:'Pile · 6 V',interrupteur:'Interrupteur',B0:'Interrupteur L1',B1:'Interrupteur L2',B2:'Interrupteur L3',L0:'Lampe L1',L1:'Lampe L2',L2:'Lampe L3',L3:'Lampe L4',L4:'Lampe L5',chassis:'Plaque · carrosserie',cylinder:'Éprouvette graduée',bottle:'Bouteille d’eau',dropper:'Compte-gouttes',tray:'Bac de récupération'};
const name=(id,s)=>s.deviceNames?.[id]??(parallelBench(s)&&id==='pile'?'Alimentation · 6 V':parallelBench(s)&&id==='interrupteur'?'Interrupteur principal':names[id]);
const button=(action,text,value='',extra='')=>`<button data-reference="${action}" data-value="${esc(value)}" ${extra}>${text}</button>`;
const number=n=>n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:2});
export function readingSVG(s,{beforeWater,divisions=12}={}){
  const d=waterScales[s.scale],ml=s.water*1e6,span=d.step*divisions,mid=Math.round((beforeWater===undefined?ml:beforeWater*1e6)/d.step)*d.step,min=Math.max(0,Math.min(d.capacity-span,mid-span/2)),max=min+span;
  const y=v=>240-(v-min)/span*210,level=y(ml),eye=level-s.eye*55;let ticks='';
  const before=beforeWater===undefined?'':`<path class="water-before-line" d="M55 ${y(beforeWater*1e6)} H174" stroke="#925f34" stroke-width="2" stroke-dasharray="5 4"/><text x="4" y="${y(beforeWater*1e6)+4}" font-size="12" fill="#774821">Avant</text>`;
  for(let v=Math.ceil(min/d.step)*d.step;v<=max+1e-8;v+=d.step){const major=Math.round(v/d.step)%5===0;ticks+=`<path d="M145 ${y(v)} h${major?34:19}"/><text x="192" y="${y(v)+5}">${major?number(v):''}</text>`;}
  return `<svg class="reading-svg" viewBox="0 0 280 282" role="img" aria-label="Vue agrandie des graduations. Une division vaut ${d.step} millilitre(s). Lis le bas du ménisque."><defs><clipPath id="water-clip"><rect x="55" y="24" width="106" height="217"/></clipPath><linearGradient id="water-fill" x2="1" y2="0"><stop stop-color="#d6eaf0"/><stop offset="1" stop-color="#89b7c7"/></linearGradient></defs><rect x="55" y="24" width="106" height="217" rx="6" fill="#fbfdfd" stroke="#8eacb9" stroke-width="2"/><g clip-path="url(#water-clip)"><path d="M55 ${level-9} Q108 ${level+9} 161 ${level-9} V242 H55Z" fill="url(#water-fill)"/><path class="water-current-line" d="M55 ${level-9} Q108 ${level+9} 161 ${level-9}" fill="none" stroke="#315568" stroke-width="2"/></g><g stroke="#203643" stroke-width="1.6" fill="#203643" font-size="16" font-family="system-ui"><g stroke="none"><text x="191" y="17">mL</text></g>${ticks.replaceAll('<text','<text stroke="none"')}</g>${beforeWater===undefined?`<path d="M23 ${eye} L108 ${level}" stroke="#ba792f" stroke-width="1.5" stroke-dasharray="4 4"/><circle cx="23" cy="${eye}" r="6" fill="#ba792f"/>`:before}<text x="140" y="268" text-anchor="middle" font-size="14" fill="#24333c">1 division = ${number(d.step)} mL</text></svg>`;
}
export class ReferenceUI{
  constructor(api){this.api=api;this.stage=api.stage;this.layer=document.createElement('div');this.layer.id='reference-layer';this.stage.after(this.layer);this.selected=null;this.pending=null;this.id=null;this.drag=null;this.press=new MomentaryPress(this);
    this.gesture=document.createElement('div');this.gesture.className='reference-gesture';this.gesture.hidden=true;this.layer.after(this.gesture);
    this.waterFeedback=document.createElement('aside');this.waterFeedback.className='reference-water-feedback';this.waterFeedback.hidden=true;this.waterFeedback.setAttribute('aria-label','Loupe du niveau après le compte-gouttes');this.gesture.after(this.waterFeedback);this.immersion=new ImmersionUI(api);
    this.onClick=e=>{const el=e.target.closest('[data-reference]');if(el){e.preventDefault();if(e.detail===0)this.suppressClickUntil=0;this.action(el.dataset.reference,el.dataset.value);}};
    document.addEventListener('click',this.onClick);
    this.layer.addEventListener('change',e=>{const el=e.target;if(el.dataset.refControl)this.api.act(el.dataset.refControl,el.type==='number'?Number(el.value):el.value);});
    this.onKey=e=>{if(!this.active||api.drawerOpen())return;if(e.key==='Escape'){this.finishGesture();this.selected=null;this.pending=null;this.sync();}const id=e.target.closest('[data-drag]')?.dataset.drag;if(id&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const v=api.get().view,d=(this.kind==='circuit'?v.devices[id].g:v.groups[id]).position;api.act('move',{id,x:d.x+(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0),z:d.z+(e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0)});}};
    document.addEventListener('keydown',this.onKey);
    this.onPointerDown=e=>this.pointerDown(e);this.onPointerMove=e=>this.pointerMove(e);this.onPointerUp=e=>this.pointerUp(e);
    api.main.addEventListener('pointerdown',this.onPointerDown);window.addEventListener('pointermove',this.onPointerMove);window.addEventListener('pointerup',this.onPointerUp);window.addEventListener('pointercancel',e=>{if(this.drag?.pointer===e.pointerId)this.finishGesture();});window.addEventListener('blur',()=>this.finishGesture());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.finishGesture();});window.addEventListener('pagehide',()=>this.finishGesture());
    this.resize=new ResizeObserver(()=>this.position());this.resize.observe(this.stage);
    this.material=document.createElement('button');this.material.textContent='Matériel';this.material.dataset.reference='material';document.querySelector('.header nav').insertBefore(this.material,document.querySelector('[data-ui=notebook]'));
    this.readings=document.createElement('button');this.readings.textContent='Mesures';this.readings.dataset.reference='measures';document.querySelector('.tools').append(this.readings);
    this.diagram=document.createElement('button');this.diagram.textContent='Schéma';this.diagram.dataset.reference='schema';document.querySelector('.tools').append(this.diagram);
  }
  circuitState(){const {current,state}=this.api.get();return current.circuitState?.(state)??state;}
  sync(){
    const {current,state:raw,view:v}=this.api.get(),s=this.circuitState();this.kind=current?.reference;this.active=!!this.kind&&this.kind!=='immersion';this.immersion.sync(this.kind==='immersion');
    document.body.classList.toggle('reference-bench',!!this.kind);this.layer.hidden=!this.active;this.material.hidden=!this.kind&&!current.natural;this.readings.hidden=!this.kind&&!current.natural;document.body.classList.toggle('natural-bench',!!current.natural);this.diagram.hidden=this.kind!=='circuit';
    if(this.kind!=='water'||this.waterFeedbackState&&['water','spill','added','scale'].some(k=>raw[k]!==this.waterFeedbackState[k]))this.hideWaterFeedback();
    if(!this.active)return;
    if(current.id!==this.id){this.id=current.id;this.selected=null;this.pending=null;}
    if(this.kind==='circuit'&&this.selected&&!this.selected.startsWith('wire:')&&!v.devices[this.selected]?.g.visible)this.selected=null;
    if(this.pending&&!terminals(this.kind==='circuit'?s:{n:0}).includes(this.pending))this.pending=null;
    const focused=document.activeElement?.id,focusedControl=this.layer.contains(document.activeElement)?document.activeElement?.dataset:null,status=current.observe(raw).title,commandsOpen=this.layer.querySelector('.reference-inspector details')?.open;
    const goal=current.goal?current.goal(raw):this.kind==='circuit'?(s.n<3?'Ajoute une lampe en série. Son éclat change-t-il ?':'Dévisse une lampe. Que deviennent les deux autres ?'):`Prépare ${number(s.target*1e6)} mL d’eau dans l’éprouvette.`;
    const instruction=current.instruction&&!this.pending?current.instruction:this.kind==='circuit'?(this.pending?'Touche une seconde borne pour brancher le fil.':this.selected?'Saisis l’objet ou son étiquette et déplace-le sur la table.':(current.parallel||current.directCircuit)?'Touche un levier pour l’ouvrir. Touche une ampoule pour la dévisser. Tire un fil entre deux bornes pour brancher.':'Tire un fil d’une borne à l’autre, ou touche les deux bornes. Touche le levier pour ouvrir la boucle.'):'Glisse la bouteille vers l’ouverture de l’éprouvette, maintiens pour verser, puis relâche pour arrêter.';
    let labels='';
    const devices=this.kind==='circuit'?Object.keys(v.devices).filter(id=>v.devices[id].g.visible):Object.keys(v.groups);
    for(const id of devices){const isSwitch=this.kind==='circuit'&&switchIds(s).includes(id),sub=s.deviceStatus?.[id]??(this.kind==='circuit'?(isSwitch?(switchClosed(s,id)?'Fermé · toucher pour ouvrir':'Ouvert · toucher pour fermer'):id==='pile'?((current.parallel||current.directCircuit)?'Tension régulée': 'Disponible'):lampRemoved(s,Number(id.slice(1)))?'Dévissée · toucher pour revisser':v.result.lamps[Number(id.slice(1))]?.p>1e-8?'Allumée':'Éteinte'):({cylinder:'Toucher pour lire',bottle:`Saisir pour verser · ${number(bottleVolume(s)*1e6)} mL`,dropper:dropperVolume(s)>1e-12?`${number(dropperVolume(s)*1e6)} mL · saisir pour ajuster`:'Vide · remplir dans la bouteille',tray:`${number((s.drained+s.spill)*1e6)} mL recueillis`})[id]);labels+=`<button class="reference-object ${this.selected===id?'selected':''}" data-anchor="device:${id}" data-reference="device" data-value="${id}" data-drag="${id}" aria-pressed="${(current.parallel||current.directCircuit)&&isSwitch?switchClosed(s,id):this.selected===id}">${name(id,s)}<small>${esc(sub)}</small></button>`;}
    if(this.kind==='circuit'){
      for(const t of terminals(s)){const id=t.split(':')[0],port=t.split(':')[1],text=s.portNames?.[t]??(id==='pile'?(port==='p'?'+':'−'):id.startsWith('L')?(port==='a'?'Culot':'Plot'):(port==='a'?'A':'B'));labels+=`<button class="reference-port ${this.pending===t?'pending':''}" data-anchor="port:${t}" data-reference="port" data-value="${t}" aria-label="${name(id,s)} · ${text}" aria-pressed="${this.pending===t}"><i></i><span>${text}</span></button>`;}
      wiresFor(s).forEach((w,i)=>labels+=`<button class="reference-wire ${this.selected==='wire:'+i?'selected':''}" data-anchor="wire:${i}" data-reference="wire" data-value="${i}" aria-label="Fil F${i+1} : ${name(w.a.split(':')[0],s)} vers ${name(w.b.split(':')[0],s)}">F${i+1}</button>`);
    }
    if(current.momentary)labels+=`<button class="reference-press-target" data-anchor="press:interrupteur" data-reference="press" aria-label="Maintenir le poussoir : fermer le contact" aria-pressed="${raw.pressed}" title="Maintiens pour allumer ; relâche pour éteindre"></button>`;
    this.layer.innerHTML=`<div class="reference-status" role="status">${esc(this.kind==='circuit'?status:'Mesurer un volume d’eau')}</div><div class="reference-goal"><span class="reference-goal-text">${esc(goal)}</span>${current.presets?`<div class="reference-presets" role="group" aria-label="Préparer un montage"><span>${esc(current.presetLabel??'Préparer :')}</span>${current.presets.map(p=>button('preset',esc(p.label),p.value,`aria-pressed="${current.activePreset(raw)===p.value}"`)).join('')}</div>`:''}${current.panelHTML?.(raw)??''}</div><div class="reference-labels">${labels}</div>${this.inspector(s,v)}<div class="reference-instruction">${esc(instruction)}${this.pending?button('cancel','Annuler le fil'):''}</div>`;
    if(commandsOpen&&this.layer.querySelector('.reference-inspector details'))this.layer.querySelector('.reference-inspector details').open=true;
    if(focused?.startsWith('ref-'))document.getElementById(focused)?.focus({preventScroll:true});
    else if(focusedControl?.reference)[...this.layer.querySelectorAll('[data-reference]')].find(el=>el.dataset.reference===focusedControl.reference&&el.dataset.value===focusedControl.value)?.focus({preventScroll:true});
    if(this.kind==='circuit')for(const [id,ring]of Object.entries(v.rings))ring.visible=id===this.selected&&v.devices[id].g.visible;
    this.position();this.api.get().room.invalidate();
  }
  inspector(s,v){
    if(!this.selected)return '';
    const head=title=>`<aside class="reference-inspector"><header><h2>${title}</h2>${button('clear','×','','aria-label="Fermer le panneau"')}</header>`;
    if(this.kind==='circuit'){
      if(this.selected.startsWith('wire:'))return head('Fil sélectionné')+`<p>Retire ce fil, puis touche deux bornes pour le rebrancher.</p>${button('unplug','Retirer ce fil',this.selected.slice(5))}</aside>`;
      if(this.selected==='chassis')return head('Plaque métallique')+`<p>Les trois bornes sont reliées par le métal. La plaque remplace plusieurs fils de retour.</p>${button('return-path','Débrancher ou rétablir le retour commun','','class="primary"')}<p>Tu peux aussi sélectionner le fil qui rejoint la borne −, puis le retirer.</p></aside>`;
      if(this.selected.startsWith('L')){const i=Number(this.selected.slice(1)),r=v.result.lamps[i];return head(name(this.selected,s))+`<p>${lampRemoved(s,i)?'La lampe est dévissée : son filament ne ferme plus le trajet.':'Le plot et le culot sont les deux contacts de la lampe.'}</p>${button('unscrew',lampRemoved(s,i)?'Revisser la lampe':'Dévisser la lampe',String(i),'class="primary"')}<p class="reference-reading">${number(r.p)} W <small>puissance calculée</small></p>${parallelBench(s)?`<p>${number(r.u===null?null:Math.abs(r.u))} V · ${number(r.i===null?null:Math.abs(r.i))} A</p>`:''}</aside>`;}
      if(this.api.get().current.momentary&&this.selected==='interrupteur')return head('Le poussoir')+`<p>Maintiens le bouton pour fermer le contact. Le ressort le rouvre au relâchement. Le socle et l’étiquette permettent de déplacer l’objet.</p>${button('press','Maintenir le poussoir','','class="primary"')}<div class="reference-row">${button('emit','Signal court','.')}${button('emit','Signal long','-')}</div></aside>`;
      if(switchIds(s).includes(this.selected))return head(name(this.selected,s))+`<p>${switchClosed(s,this.selected)?'La boucle passe par les deux contacts.':'Les deux contacts sont séparés.'}</p>${button('switch',switchClosed(s,this.selected)?'Ouvrir l’interrupteur':'Fermer l’interrupteur',this.selected,'class="primary"')}</aside>`;
      if(parallelBench(s))return head('Alimentation régulée')+'<p>Elle maintient 6 V entre ses deux bornes. La tension reçue par chaque lampe dépend de tes branchements.</p><p>Un fil direct entre + et − provoque un court-circuit.</p></aside>';
      return head('Pile')+'<p>Relie une borne à une lampe, puis forme un trajet qui revient à l’autre borne.</p><p>6 V · même pile pédagogique que le premier atelier.</p></aside>';
    }
    if(this.selected==='cylinder')return head('Lire le volume')+`<p>Place le regard au niveau de l’eau et lis le bas du ménisque.</p>${readingSVG(s)}<div class="reference-row">${button('eye','Regard plus haut','1')}${button('eye','À hauteur','0')}${button('eye','Plus bas','-1')}</div><label for="ref-answer">Ma lecture en mL<input id="ref-answer" data-ref-control="answer" type="number" min="0" max="${waterScales[s.scale].capacity}" step="0.5" value="${Number((s.answer*1e6).toFixed(6))}"></label>${button('check','Comparer ma lecture','','class="primary"')}${s.checked?`<p class="reading-feedback" role="status">${esc(this.api.get().current.observe(s).lines[2])}</p>`:''}</aside>`;
    if(this.selected==='bottle')return head('Verser de l’eau')+`<p>Saisis la bouteille et amène-la à l’ouverture de l’éprouvette. Maintiens pour verser ; éloigne-la ou relâche pour arrêter.</p><p>${number(bottleVolume(s)*1e6)} mL restent dans la bouteille.</p><details><summary>Commandes au clic ou au clavier</summary>${button('pour','Verser 5 mL')}${button('refill','Remplir la bouteille')}</details>${button('read','Lire le niveau')}</aside>`;
    if(this.selected==='dropper')return head('Ajuster doucement')+`<p>Glisse le compte-gouttes sur le repère de la bouteille, puis relâche pour le remplir. Amène-le au repère de l’éprouvette et relâche pour déposer son eau. Maintenir permet de verser progressivement ; éloigner le compte-gouttes arrête le transfert.</p><p>${number(dropperVolume(s)*1e6)} mL dans le compte-gouttes.</p><details><summary>Commandes au clic ou au clavier</summary>${button('drop','Vider le compte-gouttes')}${button('fillDropper','Remplir depuis la bouteille')}${button('remove','Retirer 0,5 mL')}</details>${button('read','Lire le niveau')}</aside>`;
    return head('Eau recueillie')+`<p>${number((s.spill+s.drained)*1e6)} mL ont rejoint le bac.</p><p>L’eau retirée et l’eau débordée restent comptées.</p></aside>`;
  }
  action(id,value){
    if(this.immersion.active){this.immersion.action(id,value);return;}
    if(this.api.get().current.natural&&['material','measures'].includes(id)){this.api.openDrawer(id);return;}
    if(!this.active)return;const s=this.circuitState();
    if(id==='close-water-feedback'){this.hideWaterFeedback();return;}
    if(['device','read','material','measures','schema'].includes(id))this.hideWaterFeedback();
    if(['device','port','wire'].includes(id)&&performance.now()<this.suppressClickUntil)return;
    if(['material','measures','schema'].includes(id)){this.api.openDrawer(id);return;}
    if(id==='preset'){this.selected=null;this.pending=null;this.api.act(this.api.get().current.presetAction??'topology',value);return;}
    if(id==='emit'){this.press.emit(value);return;}
    if(id==='lesson'){this.api.act(value);return;}
    if(id==='trace'){this.api.act('trace',value);this.api.openDrawer('schema');return;}
    if(id==='clear'||id==='cancel'){this.selected=null;this.pending=null;this.sync();return;}
    if(id==='device'){if(performance.now()<this.suppressClickUntil)return;if(parallelBench(s)&&switchIds(s).includes(value)){this.action('switch',value);return;}this.selected=this.selected===value?null:value;this.pending=null;this.sync();return;}
    if(id==='read'){this.selected='cylinder';this.sync();return;}
    if(id==='wire'){this.selected='wire:'+value;this.pending=null;this.sync();return;}
    if(id==='port'){this.selected=null;if(this.pending&&this.pending!==value){const a=this.pending;this.pending=null;this.connectPorts(a,value);}else{this.pending=this.pending===value?null:value;this.sync();}return;}
    if(id==='unplug'){this.selected=null;this.api.act('unplug',Number(value));return;}
    if(id==='switch'&&this.api.get().current.momentary){this.selected='interrupteur';this.sync();return;}
    if(id==='switch'){this.api.act(value?.startsWith('B')?`b${value.slice(1)}`:'closed');return;}
    if(id==='return-path'){this.api.act('returnPath');return;}
    if(id==='unscrew'){this.api.act('removeLamp',value);return;}
    if(id==='eye'){this.api.act('eye',Number(value));return;}
    if(['pour','drop','remove','check','fillDropper','refill'].includes(id)){this.api.act(id);return;}
  }
  position(){
    if(!this.active)return;const {room,view:v,kit}=this.api.get();kit.root.updateMatrixWorld(true);
    for(const el of this.layer.querySelectorAll('[data-anchor]')){const [kind,...parts]=el.dataset.anchor.split(':'),id=parts.join(':');let world;
      if(kind==='press')world=v.devices[id].s.pressTarget.localToWorld(new kit.T.Vector3(0,.1,0));else if(kind==='port')world=v.pins[id];else if(kind==='wire')world=v.curves[Number(id)]?.getPoint(v.options?.wireLabelT?.(Number(id),v,this.circuitState())??.48);else if(this.kind==='circuit'){const d=v.devices[id];world=d.g.localToWorld(v.options?.labelAnchor?.(id,v,this.circuitState())??(v.options?.branchSwitches===false&&id.startsWith('L')?new kit.T.Vector3(0,.01,1.22):v.parallel&&id.startsWith('L')?new kit.T.Vector3(1.55,.22,.25):new kit.T.Vector3(v.parallel&&id==='interrupteur'?.7:0,.01,id.startsWith('L')?1.05:.8)));}else world=v.groups[id].localToWorld(new kit.T.Vector3(0,.03,id==='bottle'?1.05:id==='cylinder'?.85:1.05));
      if(!world){el.hidden=true;continue;}const p=room.project(world);el.hidden=!p.visible;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
    }
    const bulbs=[];
    if(v.parallel&&this.stage.clientWidth>800)for(const d of Object.values(v.devices))if(d.g.visible&&d.s.bulb){const b=new kit.T.Box3().setFromObject(d.s.bulb),p=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.push(room.project(new kit.T.Vector3(x,y,z)));bulbs.push({left:Math.min(...p.map(p=>p.x))-6,right:Math.max(...p.map(p=>p.x))+6,top:Math.min(...p.map(p=>p.y))-6,bottom:Math.max(...p.map(p=>p.y))+6});}
    const placed=[];for(const el of this.layer.querySelectorAll('.reference-object:not([hidden])')){let x=parseFloat(el.style.left),y=parseFloat(el.style.top),w=el.offsetWidth,h=el.offsetHeight;x=Math.max(w/2+6,Math.min(this.stage.clientWidth-w/2-6,x));for(let i=0;i<12;i++){
      const obstacle=bulbs.find(r=>x+w/2>r.left&&x-w/2<r.right&&y+h>r.top&&y<r.bottom);
      if(obstacle){const right=obstacle.right+w/2+8;if(right<this.stage.clientWidth-w/2-6)x=right;else y=obstacle.bottom+8;continue;}
      const hit=placed.find(r=>Math.abs(x-r.x)<(w+r.w)/2+5&&y<r.y+r.h+5&&y+h>r.y-5);if(!hit)break;y=hit.y+hit.h+7;
    }el.style.left=`${x}px`;el.style.top=`${y}px`;placed.push({x,y,w,h});}
  }
  pointerDown(e){
    if(!this.active||this.api.drawerOpen()||e.button!==0||this.drag||this.press.active)return;this.suppressClickUntil=0;this.stopSettle();const q=this.api.get();
    const port=e.target.closest('[data-reference=port]');
    if(port){this.drag={type:'wire',id:port.dataset.value,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};return;}
    let id=e.target.closest('[data-drag]')?.dataset.drag,tapLamp;
    if(e.target===q.room.canvas){const rect=this.stage.getBoundingClientRect(),ray=new q.kit.T.Raycaster();ray.setFromCamera(new q.kit.T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),q.room.camera);
      const hit=ray.intersectObject(q.root,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return h.object.userData.referenceDevice||h.object.userData.referenceWire!==undefined;});
      if(hit?.object.userData.referenceWire!==undefined){this.action('wire',String(hit.object.userData.referenceWire));return;}
      id=hit?.object.userData.referenceDevice;
      tapLamp=hit?.object.userData.referenceLamp;
      if(!id){this.selected=null;this.pending=null;this.sync();return;}
    }
    if(!id)return;this.hideWaterFeedback();const rect=this.stage.getBoundingClientRect(),at=q.room.onTable(e.clientX-rect.left,e.clientY-rect.top),g=this.kind==='circuit'?q.view.devices[id].g:q.view.groups[id];
    this.drag={type:'object',id,tapLamp,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,state:copy(q.state),preview:copy(q.state),moved:false,fromLabel:!!e.target.closest('[data-drag]'),offset:at?{x:g.position.x-at.x,z:g.position.z-at.z}:{x:0,z:0},blend:0,last:performance.now()};
  }
  pointerMove(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointer)return;if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<6)return;
    if(!d.moved){d.moved=true;this.selected=null;this.pending=null;this.sync();this.api.main.setPointerCapture?.(e.pointerId);document.body.classList.add('reference-holding');this.gesture.hidden=false;this.layer.querySelector('.reference-inspector')?.remove();}
    e.preventDefault();d.x=e.clientX;d.y=e.clientY;
    const q=this.api.get(),rect=this.stage.getBoundingClientRect();
    if(d.type==='wire'){
      d.target=this.nearestPort(e.clientX,e.clientY,d.id);this.drawWire(d);return;
    }
    const at=q.room.onTable(e.clientX-rect.left,e.clientY-rect.top);if(!at)return;
    d.value={id:d.id,x:at.x+d.offset.x,z:at.z+d.offset.z};
    if(this.kind==='water'){
      const nextTarget=['bottle','dropper'].includes(d.id)?this.waterTarget(d):null;if(nextTarget!==d.target)d.targetSince=performance.now();d.target=nextTarget;
      if(d.target){const receiver=q.view.groups[d.target].position;d.value={id:d.id,x:receiver.x-(d.id==='bottle'?2.9:1.2),z:receiver.z+.15};if(d.poseTarget!==d.target){d.blend=0;d.filled=false;}d.poseTarget=d.target;}
      else d.filled=false;
      d.preview=q.current.act(d.preview,'move',d.value);
      if(!this.frame){d.last=performance.now();this.frame=requestAnimationFrame(t=>this.waterFrame(t));}
    }else{d.preview=q.current.act(d.state,'move',d.value);q.current.update(q.view,d.preview,q.kit);this.position();this.instruction('Déplace l’objet, puis relâche pour le poser. Les fils restent branchés.');}
  }
  nearestPort(x,y,source){let best=null,distance=36;for(const el of this.layer.querySelectorAll('[data-reference=port]')){if(el.hidden||el.dataset.value===source)continue;const r=el.getBoundingClientRect(),dist=Math.hypot(x-r.x-r.width/2,y-r.y-r.height/2);if(dist<distance){best=el.dataset.value;distance=dist;}}return best;}
  drawWire(d){
    const q=this.api.get(),r=this.stage.getBoundingClientRect(),a=q.room.project(q.view.pins[d.id]),b=d.target?q.room.project(q.view.pins[d.target]):{x:d.x-r.left,y:d.y-r.top};
    const path=`M${a.x} ${a.y} C${a.x} ${a.y+45} ${b.x} ${b.y+45} ${b.x} ${b.y}`;
    this.gesture.innerHTML=`<svg width="100%" height="100%" aria-hidden="true"><path d="${path}" fill="none" stroke="#fff9" stroke-width="8"/><path d="${path}" fill="none" stroke="#a0322d" stroke-width="4" stroke-linecap="round"/><circle cx="${b.x}" cy="${b.y}" r="6" fill="#a0322d" stroke="white" stroke-width="2"/></svg>`;
    for(const el of this.layer.querySelectorAll('[data-reference=port]')){el.classList.toggle('pending',el.dataset.value===d.id);el.classList.toggle('drop-ready',el.dataset.value===d.target);}
    this.instruction(d.target?'Relâche pour brancher le fil sur cette borne.':'Amène le bout du fil sur une autre borne. Relâcher sur la table annule ce fil.');
  }
  waterTarget(d){const q=this.api.get(),rect=this.stage.getBoundingClientRect();for(const id of d.id==='dropper'?['cylinder','bottle']:['cylinder']){const p=q.room.project(q.view.groups[id].localToWorld(new q.kit.T.Vector3(0,id==='bottle'?3:3.48,0)));if(Math.hypot(d.x-rect.left-p.x,d.y-rect.top-p.y)<48)return id;}return null;}
  waterFrame(time){
    this.frame=0;const d=this.drag;if(!d?.moved||d.type!=='object'||this.kind!=='water')return;
    const q=this.api.get(),dt=Math.min(.5,Math.max(0,(time-d.last)/1000)),flowTime=Math.min(.5,Math.max(0,(time-Math.max(d.last,(d.targetSince??time)+240))/1000));d.last=time;
    d.blend=d.target?Math.min(1,Math.max(0,(time-d.targetSince)/240)):Math.max(0,d.blend-dt/.24);
    let flowing=false;
    if(d.target&&d.blend>.95){
      if(d.target==='bottle'){if(!d.filled){d.preview=q.current.act(d.preview,'fillDropper');d.filled=true;}}
      else {const available=d.id==='bottle'?bottleVolume(d.preview):dropperVolume(d.preview);flowing=available>1e-12;if(flowing)d.preview=q.current.act(d.preview,'flow',{source:d.id,ml:flowTime*(d.id==='bottle'?6:.5)});}
    }
    q.current.update(q.view,d.preview,q.kit);
    if(d.blend>0&&d.poseTarget)poseWater(q.view,d.id,d.blend,flowing,time,d.poseTarget);
    else {q.view.groups[d.id].position.y+=.15;q.view.shadows[d.id].forEach(o=>o.visible=false);q.kit.invalidate();}
    this.position();this.drawWaterTargets(d);
    const bottleLabel=this.layer.querySelector('[data-drag=bottle] small');if(bottleLabel)bottleLabel.textContent=`Saisir pour verser · ${number(bottleVolume(d.preview)*1e6)} mL`;
    const pipetteLabel=this.layer.querySelector('[data-drag=dropper] small');if(pipetteLabel)pipetteLabel.textContent=dropperVolume(d.preview)>1e-12?`${number(dropperVolume(d.preview)*1e6)} mL · saisir pour ajuster`:'Vide · remplir dans la bouteille';
    if(d.id==='dropper'&&(d.target==='cylinder'||d.preview.added>d.state.added+1e-12))this.showWaterFeedback(d.state,d.preview);
    const remaining=d.id==='bottle'?bottleVolume(d.preview):dropperVolume(d.preview);
    this.instruction(d.target==='bottle'?(dropperVolume(d.preview)>1e-12?`Compte-gouttes rempli : ${number(dropperVolume(d.preview)*1e6)} mL. Amène-le à l’éprouvette.`:bottleVolume(d.preview)>1e-12?'Relâche ici pour remplir le compte-gouttes.':'La bouteille est vide.'):
      d.target==='cylinder'?(remaining>1e-12?(d.id==='dropper'?'Maintiens pour déposer progressivement, ou relâche ici pour vider le compte-gouttes.':d.blend>.95?'L’eau coule. Éloigne l’objet ou relâche pour arrêter.':'Maintiens ici pour verser.'):d.id==='dropper'?'Compte-gouttes vide. Ramène-le à la bouteille pour le remplir.':'Bouteille vide. Tu peux la remplir dans Matériel.'):
      d.id==='bottle'?'Amène le goulot vers le repère au-dessus de l’éprouvette.':d.id==='dropper'?'Amène le compte-gouttes sur un repère, puis relâche : bouteille pour remplir, éprouvette pour déposer.':'Relâche pour poser l’objet sur la table.');
    this.frame=requestAnimationFrame(t=>this.waterFrame(t));
  }
  drawWaterTargets(d){
    const q=this.api.get(),ids=d.id==='bottle'?['cylinder']:d.id==='dropper'?['cylinder','bottle']:[];
    if(this.gesture.childElementCount!==ids.length)this.gesture.innerHTML=ids.map(id=>`<div class="reference-drop-target" data-drop-target="${id}"><span>${id==='bottle'?'Remplir ici':'Verser ici'}</span></div>`).join('');
    for(const id of ids){const p=q.room.project(q.view.groups[id].localToWorld(new q.kit.T.Vector3(0,id==='cylinder'?3.48:3,0))),el=this.gesture.querySelector(`[data-drop-target=${id}]`);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.classList.toggle('ready',d.target===id);}
    this.layer.querySelector(`[data-drag="${d.id}"]`)?.classList.add('held');
  }
  hideWaterFeedback(){this.waterFeedback.hidden=true;this.waterFeedback.innerHTML='';this.waterFeedbackState=null;}
  showWaterFeedback(before,after){
    const deposited=Math.max(0,after.added-before.added)*1e6,spilled=Math.max(0,after.spill-before.spill)*1e6;
    const message=spilled>1e-6?`${number(deposited)} mL déposés, dont ${number(spilled)} mL débordés dans le bac.`:deposited>1e-6?`${number(deposited)} mL déposés dans l’éprouvette.`:dropperVolume(after)>1e-12?'Le niveau montera pendant le dépôt.':'Compte-gouttes vide : aucun ajout.';
    this.waterFeedback.hidden=false;this.waterFeedbackState={...after};
    this.waterFeedback.innerHTML=`<header><strong>Loupe du niveau</strong>${button('close-water-feedback','×','','aria-label="Fermer la loupe"')}</header><p class="water-transfer-message">${message}</p>${readingSVG(after,{beforeWater:before.water,divisions:6})}<small>Pointillés : avant le geste<br>Trait bleu : niveau actuel</small>`;
  }
  instruction(text){const el=this.layer.querySelector('.reference-instruction');if(el&&el.textContent!==text)el.textContent=text;}
  pointerUp(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointer)return;
    if(d.moved&&d.type==='wire'){const target=this.nearestPort(e.clientX,e.clientY,d.id),source=d.id;this.finishGesture();if(target)this.connectPorts(source,target);return;}
    if(d.moved){
      // A deliberate drop over a vessel completes the pipette transfer even
      // when the pointer is released before the settling animation finishes.
      if(this.kind==='water'&&d.id==='dropper'){
        d.x=e.clientX;d.y=e.clientY;const target=this.waterTarget(d),q=this.api.get();
        if(target)d.preview=q.current.act(d.preview,target==='bottle'?'fillDropper':'drop');
        d.releasedInto=target;
      }
      this.finishGesture(true);return;
    }
    this.drag=null;
    if(d.type==='object'&&!d.fromLabel){if(this.kind==='circuit'&&d.tapLamp!==undefined){this.api.act('removeLamp',d.tapLamp);this.api.say(lampRemoved(this.circuitState(),d.tapLamp)?`L${d.tapLamp+1} dévissée. Observe les autres lampes.`:`L${d.tapLamp+1} revissée.`);}else if(this.kind==='circuit'&&switchIds(this.circuitState()).includes(d.id))this.action('switch',d.id);else{this.selected=this.selected===d.id?null:d.id;this.sync();}}
  }
  finishGesture(animate=false){
    this.immersion.finishGesture();this.press.cancel();this.stopSettle();const d=this.drag;if(!d)return;this.drag=null;cancelAnimationFrame(this.frame);this.frame=0;
    const q=this.api.get(),g=this.kind==='water'&&d.type==='object'?q.view.groups[d.id]:null,pose=animate&&d.moved&&g?{position:g.position.clone(),quaternion:g.quaternion.clone()}:null;
    if(this.api.main.hasPointerCapture?.(d.pointer))this.api.main.releasePointerCapture(d.pointer);
    this.gesture.hidden=true;this.gesture.innerHTML='';document.body.classList.remove('reference-holding');
    if(d.moved){this.suppressClickUntil=performance.now()+350;this.selected=null;this.pending=null;if(d.type==='object')this.api.commit(d.preview);}
    q.current.update(q.view,this.api.get().state,q.kit);this.sync();
    if(this.kind==='water'&&d.id==='dropper'&&d.moved){
      if(d.preview.added>d.state.added+1e-12)this.showWaterFeedback(d.state,d.preview);
      if(d.releasedInto==='bottle')this.instruction(dropperVolume(d.preview)>1e-12?`Compte-gouttes rempli : ${number(dropperVolume(d.preview)*1e6)} mL. Amène-le au repère de l’éprouvette, puis relâche.`:'La bouteille est vide : le compte-gouttes n’a pas été rempli.');
      else if(d.releasedInto==='cylinder')this.instruction(d.preview.added>d.state.added+1e-12?'L’eau a été déposée. Compare les deux niveaux dans la loupe.':'Compte-gouttes vide : remplis-le dans la bouteille.');
      else if(d.releasedInto===null)this.instruction(d.preview.added>d.state.added+1e-12?`Versement arrêté. Il reste ${number(dropperVolume(d.preview)*1e6)} mL dans le compte-gouttes.`:dropperVolume(d.preview)>1e-12?`Compte-gouttes posé, toujours rempli (${number(dropperVolume(d.preview)*1e6)} mL). Pour verser, dépose-le sur le repère de l’éprouvette.`:'Compte-gouttes vide : dépose-le sur le repère de la bouteille pour le remplir.');
    }
    if(pose){const to=g.position.clone(),rotation=g.quaternion.clone(),start=performance.now();const step=t=>{const progress=Math.min(1,(t-start)/200),ease=progress*progress*(3-2*progress);g.position.copy(pose.position).lerp(to,ease);g.quaternion.copy(pose.quaternion).slerp(rotation,ease);this.position();q.kit.invalidate();this.settle=progress<1?requestAnimationFrame(step):0;};this.settle=requestAnimationFrame(step);}
  }
  stopSettle(){if(this.settle){cancelAnimationFrame(this.settle);this.settle=0;const q=this.api.get();if(q.view){q.current.update(q.view,q.state,q.kit);this.position();}}}
  connectPorts(a,b){if(wiresFor(this.circuitState()).some(w=>[w.a,w.b].includes(a)&&[w.a,w.b].includes(b))){this.sync();this.api.say('Ces deux bornes sont déjà reliées. Touche le fil pour le retirer.');return;}this.api.act('connect',{a,b});}
  schema(){
    const q=this.api.get();if(q.current.schema)return q.current.schema(q.state);
    if(parallelBench(this.api.get().state))return this.parallelSchema();
    const {state:s}=this.api.get(),coords={pile:[100,110],interrupteur:[160,330],L0:[380,110],L1:[520,280],L2:[330,290]};
    const point=t=>{const [id,port]=t.split(':'),[x,y]=coords[id];return [x+(port==='a'||port==='p'?-35:35),y];};
    let art='';wiresFor(s).forEach((w,i)=>{const a=point(w.a),b=point(w.b);art+=`<path d="M${a} L${b}" fill="none" stroke="#405668" stroke-width="3"/><text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-9}" font-size="13">F${i+1}</text>`;});
    for(const [id,[x,y]]of Object.entries(coords)){if(id.startsWith('L')&&Number(id.slice(1))>=s.n)continue;art+=`<g transform="translate(${x} ${y})" stroke="#263f4b" stroke-width="3" fill="#fffdf6">`;
      if(id==='pile')art+='<path d="M-35 0H-6 M6 0H35 M-6 -25V25 M6 -14V14"/>';
      else if(id==='interrupteur')art+=`<path d="M-35 0H-20 L20 ${s.closed?0:-24} M20 0H35"/><circle cx="-20" r="4"/><circle cx="20" r="4"/>`;
      else art+=`<path d="M-35 0H-23 M23 0H35"/><circle r="23"/><path d="M-16 -16L16 16 M-16 16L16 -16"/>`;
      art+=`<text y="48" text-anchor="middle" stroke="none" fill="#263f4b" font-size="15">${names[id]}</text></g>`;
    }
    return `<p>Les mêmes contacts et les mêmes fils, représentés par des symboles. Un croisement de fils ne crée pas de connexion.</p><svg viewBox="0 30 650 370" role="img" aria-label="Schéma du circuit actuel">${art}</svg>`;
  }
  parallelSchema(){
    const {state:s}=this.api.get(),columns=s.n===3?[360,555,750]:[410,670,750],coords={pile:[90,230],interrupteur:[230,80]};
    for(let i=0;i<s.n;i++){coords[`B${i}`]=[columns[i],180];coords[`L${i}`]=[columns[i],300];}
    const point=t=>{const [id,p]=t.split(':'),[x,y]=coords[id],offset=p==='a'||p==='p'?-35:35;return id==='interrupteur'?[x+offset,y]:[x,y+offset];};
    let art='';
    for(const [i,w]of wiresFor(s).entries()){
      let route=[point(w.a),point(w.b)],a=w.a,b=w.b;
      if([a,b].includes('pile:p')&&[a,b].includes('interrupteur:a'))route=[point('pile:p'),[90,80],point('interrupteur:a')];
      else if([a,b].includes('interrupteur:b')&&[a,b].some(t=>/^B\d:a$/.test(t))){const t=[a,b].find(t=>/^B\d:a$/.test(t)),p=point(t);route=[point('interrupteur:b'),[p[0],80],p];}
      else if([a,b].includes('pile:m')&&[a,b].some(t=>/^L\d:b$/.test(t))){const t=[a,b].find(t=>/^L\d:b$/.test(t)),p=point(t);route=[p,[p[0],410],[90,410],point('pile:m')];}
      art+=`<path d="M${route.map(p=>p.join(' ')).join(' L')}" fill="none" stroke="#405668" stroke-width="3" stroke-linejoin="round"><title>Fil F${i+1}</title></path>`;
    }
    for(const [id,[x,y]]of Object.entries(coords)){
      const vertical=id!=='interrupteur';art+=`<g transform="translate(${x} ${y}) rotate(${vertical?90:0})" stroke="#263f4b" stroke-width="3" fill="#fffdf6">`;
      if(id==='pile')art+='<path d="M-35 0H-22 M22 0H35"/><circle r="22"/><path d="M-13 0h10 M-8 -5v10 M7 0h9"/>';
      else if(switchIds(s).includes(id))art+=`<path d="M-35 0H-20 L20 ${switchClosed(s,id)?0:-24} M20 0H35"/><circle cx="-20" r="4"/><circle cx="20" r="4"/>`;
      else if(lampRemoved(s,Number(id.slice(1))))art+='<path d="M-35 0H-28 M28 0H35"/><circle r="22" stroke-dasharray="4 5" opacity=".4"/>';
      else art+='<path d="M-35 0H-22 M22 0H35"/><circle r="22"/><path d="M-15 -15L15 15 M-15 15L15 -15"/>';
      art+='</g>';
      const title=id==='pile'?'6 V régulée':id==='interrupteur'?'Principal':id.startsWith('B')?`Contact L${Number(id[1])+1}`:`L${Number(id[1])+1}${lampRemoved(s,Number(id[1]))?' dévissée':''}`;
      art+=`<text x="${id==='interrupteur'?x:x+38}" y="${id==='interrupteur'?y-37:y+5}" text-anchor="${id==='interrupteur'?'middle':'start'}" fill="#263f4b" font-size="16">${title}</text>`;
    }
    return `<p>Chaque branche relie les deux lignes communes. Les contacts et les ampoules représentent l’état réel de ta table ; les croisements seuls ne créent pas de connexion.</p><svg viewBox="0 30 930 435" role="img" aria-label="Schéma des connexions et contacts du circuit en dérivation">${art}</svg>`;
  }
}
function copy(s){return JSON.parse(JSON.stringify(s));}
