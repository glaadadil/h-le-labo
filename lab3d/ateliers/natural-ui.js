const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=s=>JSON.parse(JSON.stringify(s));
const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
export class NaturalUI{
 constructor(api){
  this.api=api;this.layer=document.createElement('div');this.layer.className='natural-layer';this.layer.hidden=true;api.stage.after(this.layer);
  this.layer.innerHTML='<div class="natural-goal"></div><div class="natural-labels"></div><div class="natural-readings"></div><aside class="natural-inspector" hidden></aside><div class="natural-hint" role="status"></div><div class="natural-targets"></div>';
  this.labels=this.layer.querySelector('.natural-labels');this.inspector=this.layer.querySelector('.natural-inspector');
  this.layer.addEventListener('click',e=>{const close=e.target.closest('[data-natural-close]');if(close){this.selected=null;this.sync();return;}const ctl=e.target.closest('button[data-natural-control]');if(ctl){this.api.act(ctl.dataset.naturalControl);return;}const el=e.target.closest('[data-natural-id]');if(el&&(e.detail===0||performance.now()>(this.suppress||0)))this.choose(el.dataset.naturalId);});
  this.layer.addEventListener('change',e=>{if(e.target.dataset.naturalControl){const el=e.target;api.act(el.dataset.naturalControl,el.type==='checkbox'?el.checked:['number','range'].includes(el.type)?Number(el.value):el.value);}});
  this.layer.addEventListener('input',e=>{if(e.target.type==='range')e.target.closest('label')?.querySelector('output')?.replaceChildren(document.createTextNode(e.target.value));});
  api.main.addEventListener('pointerdown',e=>this.down(e));window.addEventListener('pointermove',e=>this.move(e));window.addEventListener('pointerup',e=>this.up(e));
  window.addEventListener('pointercancel',e=>{if(this.drag?.pointer===e.pointerId)this.finish(true);});api.main.addEventListener('lostpointercapture',e=>{if(e.target===api.main&&this.drag?.pointer===e.pointerId)this.finish(true);});window.addEventListener('pagehide',()=>this.finish(true));window.addEventListener('blur',()=>this.finish(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)this.finish(true);});
  document.addEventListener('keydown',e=>this.key(e));new ResizeObserver(()=>this.position()).observe(api.stage);
 }
 entities(){return this.api.get().view?.naturalEntities?.filter(e=>visible(e.object))??[];}
 entity(id){return this.entities().find(e=>e.id===id);}
 sync(){
  const q=this.api.get();this.active=!!q.current?.natural;this.layer.hidden=!this.active;if(!this.active){this.selected=null;return;}
  if(q.current.id!==this.id){this.id=q.current.id;this.selected=null;this.drag=null;}
  const n=q.current.natural,entities=this.entities();if(!entities.some(e=>e.id===this.selected))this.selected=null;
  const observation=q.current.observe(q.state),goal=typeof n.goal==='function'?n.goal(q.state):n.goal;
  this.layer.querySelector('.natural-goal').innerHTML=`<div>${esc(goal)}</div>${observation.warning?`<p class="natural-alert" role="status">${esc(observation.warning)}</p>`:''}`;
  this.layer.querySelector('.natural-hint').textContent=this.drag?.moved?(this.drag.entity.adjust?'Fais glisser pour régler. Relâche pour garder ce réglage.':this.drag.entity.drop?.length?'Amène l’objet sur le repère de destination, puis relâche.':'Déplace l’objet sur la table, puis relâche.'):(typeof n.hint==='function'?n.hint(q.state):n.hint)??'Saisis les objets sur la table. Touche un appareil pour voir ses commandes.';
  const oldFocus=this.layer.contains(document.activeElement)?document.activeElement.dataset:null;
  if(!this.drag){this.labels.innerHTML=entities.map(e=>`<button class="natural-label ${this.selected===e.id?'selected':''}" data-natural-id="${esc(e.id)}" aria-pressed="${this.selected===e.id}" title="${esc(e.hint||e.shortHint||(e.adjust?'Faire glisser pour régler':e.drop?.length?'Saisir et déposer':e.click?'Toucher pour agir':'Toucher pour observer'))}">${esc(e.label)}${e.readout?`<strong>${esc(e.readout)}</strong>`:''}<small>${esc(e.shortHint|| (e.adjust?'Faire glisser pour régler':e.drop?.length?'Saisir et déposer':e.click?'Toucher pour agir':e.movable===false?'Toucher pour observer':'Saisir pour déplacer'))}</small></button>`).join('');}
  else for(const e of entities){const el=[...this.labels.children].find(x=>x.dataset.naturalId===e.id);if(el?.querySelector('strong')&&e.readout)el.querySelector('strong').textContent=e.readout;}
  const readings=n.readings?.(q.state)??q.current.observe(q.state).metrics?.slice(0,2)??[];
  this.layer.querySelector('.natural-readings').innerHTML=readings.slice(0,3).map(m=>`<div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join('');
  this.renderInspector();this.position();
  if(oldFocus&&!this.drag){const sel=oldFocus.naturalControl?`[data-natural-control="${CSS.escape(oldFocus.naturalControl)}"]`:oldFocus.naturalId?`[data-natural-id="${CSS.escape(oldFocus.naturalId)}"]`:null;this.layer.querySelector(sel||'nosuch')?.focus({preventScroll:true});}
 }
 renderInspector(){
  const e=this.entity(this.selected),q=this.api.get();this.inspector.hidden=!e||!!this.drag?.moved;if(!e)return;
  const controls=q.current.controls(q.state).filter(c=>(e.controls||[]).includes(c.id)),ob=q.current.observe(q.state);
  this.inspector.innerHTML=`<header><h2>${esc(e.label)}</h2><button data-natural-close aria-label="Fermer les commandes de l’objet">×</button></header><p>${esc(e.hint||'Manipule cet objet directement, ou utilise ses commandes ci-dessous.')}</p>${e.readout?`<p class="natural-number">${esc(e.readout)}</p>`:''}${q.current.natural.instrument?.(q.state,e.id)??''}<div class="natural-controls">${controls.map(c=>this.control(c)).join('')}</div>${ob.warning?`<p class="warning">${esc(ob.warning)}</p>`:''}${!controls.length&&!e.readout?`<p>${esc(ob.lines?.[0]||ob.title)}</p>`:''}`;
 }
 control(c){
  const a=`data-natural-control="${esc(c.id)}"`,id=`natural-ctl-${esc(c.id)}`,dis=c.disabled?' disabled':'';
  if(c.type==='button')return `<button ${a}${dis}>${esc(c.label)}</button>`;
  if(c.type==='checkbox')return `<label class="check"><input type="checkbox" ${a}${c.value?' checked':''}${dis}>${esc(c.label)}</label>`;
  if(c.type==='select')return `<label for="${id}">${esc(c.label)}<select id="${id}" ${a}${dis}>${c.options.map(o=>`<option value="${esc(o.value)}"${String(o.value)===String(c.value)?' selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`;
  return `<label for="${id}">${esc(c.label)} ${c.type==='range'?`<output>${esc(c.value)}</output> ${esc(c.unit||'')}`:''}<input id="${id}" type="${['range','number','text'].includes(c.type)?c.type:'number'}" ${a} value="${esc(c.value)}"${c.min!==undefined?` min="${esc(c.min)}"`:''}${c.max!==undefined?` max="${esc(c.max)}"`:''}${c.step!==undefined?` step="${esc(c.step)}"`:''}${dis}></label>`;
 }
 anchor(e,drop=false){
  const {kit,room}=this.api.get(),T=kit.T;let p;
  if(e.anchor){const a=e.anchor;p=e.object.localToWorld(a.clone?a.clone():new T.Vector3(...a));}
  else {const b=new T.Box3().setFromObject(e.object);p=b.isEmpty()?e.object.getWorldPosition(new T.Vector3()):b.getCenter(new T.Vector3());if(!drop){p.y=b.min.y+.03;p.z=b.max.z+.18;}}
  return room.project(p);
 }
 position(){if(!this.active)return;const {root}=this.api.get();root.updateMatrixWorld(true);const w=this.api.stage.clientWidth,h=this.api.stage.clientHeight,placed=[];
  for(const el of this.labels.children){const e=this.entity(el.dataset.naturalId);if(!e){el.hidden=true;continue;}const p=this.anchor(e);el.hidden=!p.visible;if(el.hidden)continue;
   const ew=el.offsetWidth||140,eh=el.offsetHeight||52;let x=Math.max(ew/2+8,Math.min(w-ew/2-8,p.x)),y=Math.max(w<650?137:108,Math.min(h-125,p.y));
   for(let attempt=0;attempt<8&&placed.some(r=>Math.abs(r.x-x)<(r.w+ew)/2+4&&Math.abs(r.y-y)<(r.h+eh)/2+4);attempt++)y+=attempt%2===0?eh+4:-(eh+4)*2;
   y=Math.max(w<650?137:108,Math.min(h-112,y));el.style.left=`${x}px`;el.style.top=`${y}px`;placed.push({x,y,w:ew,h:eh});
  }
  if(this.drag?.moved)this.drawTargets();
 }
 choose(id){const e=this.entity(id);if(!e)return;this.selected=this.selected===id?null:id;if(e.click){this.api.act(e.click.id,typeof e.click.value==='function'?e.click.value(this.api.get().state):e.click.value);this.sync();}else this.sync();}
 hit(event){const q=this.api.get(),T=q.kit.T,r=this.api.stage.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),q.room.camera);
  const entities=this.entities();let glassFallback=null;for(const hit of ray.intersectObject(q.root,true)){if(!visible(hit.object))continue;let node=hit.object;while(node&&node!==q.root){const e=entities.find(e=>e.object===node);if(e){const materials=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];if(materials.some(m=>m?.transparent&&m.opacity<.7)){if(!glassFallback||(!glassFallback.adjust&&!glassFallback.drop?.length&&!glassFallback.click)&&(e.adjust||e.drop?.length||e.click))glassFallback=e;break;}return e;}node=node.parent;}}return glassFallback;
 }
 tablePoint(event,y=.1){const q=this.api.get(),T=q.kit.T,r=this.api.stage.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),q.room.camera);return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-y),new T.Vector3());}
 down(event){if(!this.active||this.api.drawerOpen()||event.button!==0||this.drag)return;const label=event.target.closest('[data-natural-id]');if(!label&&event.target!==this.api.get().room.canvas)return;const e=label?this.entity(label.dataset.naturalId):this.hit(event);if(!e){this.selected=null;this.sync();return;}
  event.preventDefault();this.suppress=performance.now()+500;const q=this.api.get(),pos=e.object.position.clone(),world=e.object.getWorldPosition(new q.kit.T.Vector3());
  this.drag={entity:e,selectedBefore:this.selected,pointer:event.pointerId,x:event.clientX,y:event.clientY,moved:false,before:copy(q.state),position:pos,rotation:e.object.rotation.clone(),world,start:this.tablePoint(event,world.y)};this.selected=e.id;this.sync();
 }
 move(event){const d=this.drag;if(!d||d.pointer!==event.pointerId)return;const dx=event.clientX-d.x,dy=event.clientY-d.y;if(Math.hypot(dx,dy)<5&&!d.moved)return;if(!d.moved){try{this.api.main.setPointerCapture(event.pointerId);}catch{}}d.moved=true;const q=this.api.get();this.inspector.hidden=true;document.body.classList.add('natural-holding');
  if(d.entity.adjust){const a=d.entity.adjust,delta=(a.axis==='y'?-dy:dx)/(a.sensitivity||220),raw=a.value+delta*(a.max-a.min),step=a.step||.01,v=Math.max(a.min,Math.min(a.max,Math.round(raw/step)*step));let next=q.current.act(copy(q.state),a.id,v);if(a.secondary){const b=a.secondary,dd=(b.axis==='y'?-dy:dx)/(b.sensitivity||220),st=b.step||.01,vv=Math.max(b.min,Math.min(b.max,Math.round((b.value+dd*(b.max-b.min))/st)*st));next=q.current.act(next,b.id,vv);}this.api.preview(next);}
  else if(!d.entity.connection&&(d.entity.movable!==false||d.entity.drop?.length)){const p=this.tablePoint(event,d.world.y);if(p&&d.start){const world=d.world.clone().add(p.sub(d.start));world.x=Math.max(-5.1,Math.min(5.1,world.x));world.z=Math.max(-2.7,Math.min(2.8,world.z));const local=d.entity.object.parent.worldToLocal(world);d.entity.object.position.copy(local);q.root.updateMatrixWorld(true);q.room.invalidate();}}
  d.event={clientX:event.clientX,clientY:event.clientY};if(d.entity.pose==='pour'){d.entity.object.rotation.copy(d.rotation);if(this.target()){d.entity.object.rotation.z-=.55;d.entity.object.position.y+=.35;}}d.entity.onMove?.();q.root.updateMatrixWorld(true);q.room.invalidate();this.drawTargets();this.position();
 }
 targets(){const d=this.drag;if(!d)return[];return (d.entity.drop||[]).filter(t=>!t.constraint||t.constraint(this.api.get().state)).map(t=>({...t,entity:this.entity(t.target)})).filter(t=>t.entity);}
 target(){const d=this.drag;if(!d?.event)return null;const r=this.api.stage.getBoundingClientRect(),x=d.event.clientX-r.left,y=d.event.clientY-r.top;return this.targets().map(t=>({...t,p:this.anchor(t.entity,true)})).sort((a,b)=>Math.hypot(a.p.x-x,a.p.y-y)-Math.hypot(b.p.x-x,b.p.y-y)).find(t=>Math.hypot(t.p.x-x,t.p.y-y)<75)||null;}
 drawTargets(){const ready=this.target(),d=this.drag,r=this.api.stage.getBoundingClientRect(),p=d?.entity.connection?this.anchor(d.entity,true):null,ex=(d?.event?.clientX??0)-r.left,ey=(d?.event?.clientY??0)-r.top;const wire=p&&d.event?`<svg class="natural-wire-preview" width="100%" height="100%" aria-hidden="true"><path d="M${p.x},${p.y} C${p.x},${p.y+35} ${ex},${ey+35} ${ex},${ey}" fill="none" stroke="#a83d35" stroke-width="4" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="5" fill="#f8f4e8" stroke="#a83d35" stroke-width="2"/></svg>`:'';this.layer.querySelector('.natural-targets').innerHTML=wire+this.targets().map(t=>{const p=this.anchor(t.entity,true);return `<div class="natural-target ${ready?.target===t.target?'ready':''}" data-natural-target="${esc(t.target)}" style="left:${p.x}px;top:${p.y}px"><span>${esc(t.label||t.entity.label)}</span></div>`;}).join('');}
 up(event){if(!this.drag||event.pointerId!==this.drag.pointer)return;const d=this.drag;this.suppress=performance.now()+500;if(!d.moved){this.drag=null;if(d.entity.click){this.api.act(d.entity.click.id,typeof d.entity.click.value==='function'?d.entity.click.value(this.api.get().state):d.entity.click.value);this.sync();}else{this.selected=d.selectedBefore===d.entity.id?null:d.entity.id;this.sync();}return;}this.finish(false);}
 finish(cancel=false){const d=this.drag;if(!d)return;const q=this.api.get(),target=cancel?null:this.target(),p=d.entity.object.position.clone();this.drag=null;try{if(this.api.main.hasPointerCapture(d.pointer))this.api.main.releasePointerCapture(d.pointer);}catch{}this.layer.querySelector('.natural-targets').innerHTML='';document.body.classList.remove('natural-holding');
  d.entity.object.position.copy(d.position);d.entity.object.rotation.copy(d.rotation);let next=copy(d.before);
  if(!cancel&&d.moved){if(d.entity.adjust)next=copy(q.state);else if(target){next=q.current.act(next,target.action,typeof target.value==='function'?target.value(next):target.value);if(next._bench)delete next._bench[d.entity.id];this.api.say(target.message||`${d.entity.label} → ${target.entity.label}`);}else if(d.entity.movable!==false){next=q.current.act(next,'__move',{id:d.entity.id,x:p.x,z:p.z});}else if(d.entity.drop?.length)this.api.say('Le geste n’a pas été appliqué. Relâche sur le repère de destination.');else if(d.entity.dragMessage)this.api.say(d.entity.dragMessage);}
  if(d.moved)this.selected=!cancel&&target&&d.entity.inspectAfterDrop?d.entity.id:null;this.api.preview(copy(d.before));if(!cancel&&d.moved)this.api.commit(next,{before:d.before});this.sync();q.room.invalidate();
 }
 key(event){if(!this.active||this.api.drawerOpen())return;const el=event.target.closest('[data-natural-id]');if(event.key==='Escape'){this.finish(true);this.selected=null;this.sync();return;}if(!el||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const e=this.entity(el.dataset.naturalId),q=this.api.get(),positive=['ArrowRight','ArrowUp'].includes(event.key);if(e?.adjust){const a=e.adjust.secondary&&['ArrowUp','ArrowDown'].includes(event.key)?e.adjust.secondary:e.adjust;this.api.act(a.id,Math.max(a.min,Math.min(a.max,a.value+(positive?1:-1)*(a.step||(a.max-a.min)/100))));}else if(e?.movable!==false){const p=e.object.position.clone();p.x+=event.key==='ArrowLeft'?-.15:event.key==='ArrowRight'?.15:0;p.z+=event.key==='ArrowUp'?-.15:event.key==='ArrowDown'?.15:0;const w=e.object.parent.localToWorld(p);w.x=Math.max(-5.1,Math.min(5.1,w.x));w.z=Math.max(-2.7,Math.min(2.8,w.z));const local=e.object.parent.worldToLocal(w);this.api.act('__move',{id:e.id,x:local.x,z:local.z});}}
 diagnostics(){return this.active?this.entities().map(e=>({id:e.id,label:e.label,...this.anchor(e,true),drop:(e.drop||[]).map(t=>({target:t.target,action:t.action})),adjust:e.adjust||null,click:e.click||null,controls:e.controls||[]})):[];}
}
