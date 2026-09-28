// A momentary contact is previewed while held. Only the complete pulse enters
// history, so Undo, reload and interruptions can never leave a button held down.
export class MomentaryPress{
  constructor(ui){this.ui=ui;this.api=ui.api;this.active=null;this.timer=0;
    this.api.main.addEventListener('pointerdown',e=>{
      const q=this.api.get();if(!q.current?.momentary||this.api.drawerOpen()||e.button!==0||e.isPrimary===false)return;
      let hit=!!e.target.closest('[data-reference=press]');
      if(!hit&&e.target===q.room.canvas){const rect=ui.stage.getBoundingClientRect(),ray=new q.kit.T.Raycaster();ray.setFromCamera(new q.kit.T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),q.room.camera);
        const front=ray.intersectObject(q.root,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return h.object.userData.referenceDevice||h.object.userData.referenceWire!==undefined;});hit=!!front?.object.userData.referencePress;
      }
      if(hit){e.preventDefault();e.stopImmediatePropagation();this.begin({pointer:e.pointerId});}
    },true);
    window.addEventListener('pointerup',e=>{if(this.active?.pointer===e.pointerId){e.preventDefault();this.finish();}},true);
    window.addEventListener('pointercancel',e=>{if(this.active?.pointer===e.pointerId)this.cancel();},true);
    this.api.main.addEventListener('lostpointercapture',e=>{if(this.active?.pointer===e.pointerId)this.cancel();});
    window.addEventListener('keydown',e=>{
      if(this.active&&['Escape','Tab'].includes(e.key)){this.cancel();return;}
      if(!this.api.get().current?.momentary||this.api.drawerOpen()||!e.target.closest?.('[data-reference=press]')||![' ','Enter'].includes(e.key))return;
      e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)this.begin({key:e.key});
    },true);
    window.addEventListener('keyup',e=>{if(this.active?.key===e.key){e.preventDefault();e.stopImmediatePropagation();this.finish();}},true);
  }
  begin(input={}){
    const q=this.api.get();if(this.active||this.ui.drag||!q.current?.momentary||this.api.drawerOpen())return false;
    this.ui.stopSettle();this.ui.selected=null;this.ui.pending=null;
    this.active={...input,before:JSON.parse(JSON.stringify(q.state)),start:performance.now()};
    if(input.pointer!==undefined)this.api.main.setPointerCapture(input.pointer);
    this.api.preview(q.current.act(q.state,'press'));return true;
  }
  emit(symbol){if(!['.','-'].includes(symbol)||!this.begin({symbol}))return;this.timer=setTimeout(()=>this.finish(),symbol==='.'?260:780);}
  finish(cancelled=false){
    const d=this.active;if(!d)return;this.active=null;clearTimeout(this.timer);this.timer=0;
    if(d.pointer!==undefined&&this.api.main.hasPointerCapture(d.pointer))this.api.main.releasePointerCapture(d.pointer);
    const q=this.api.get();this.ui.suppressClickUntil=performance.now()+350;
    if(cancelled){this.api.preview(q.current.act(d.before,'cancelPress'));return;}
    const next=q.current.act(q.state,'release',{ms:performance.now()-d.start,symbol:d.symbol});
    this.api.commit(next,{before:d.before});
  }
  cancel(){this.finish(true);}
}
