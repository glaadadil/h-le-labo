import * as T from './vendor/three.module.min.js';

export function addBlackboard(s,frame){
  const x=4.35,y=2.60,z=-6.74;
  s.box(s.scene,4.02,2.25,.11,frame,x,y,z-.02);
  const c=document.createElement('canvas');c.width=1200;c.height=660;
  const ctx=c.getContext('2d'),map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;s.textures.push(map);
  s.mesh(s.scene,new T.PlaneGeometry(3.9,2.15),new T.MeshBasicMaterial({map,toneMapped:false}),x,y,z+.085,false);
  s.box(s.scene,4.05,.06,.22,frame,x,y-1.1,z+.09);
  let previous='';
  s.updateReferenceBoard=(title,metrics,rule)=>{
    const key=JSON.stringify(['reference',title,metrics,rule]);if(key===previous)return;previous=key;
    ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,1200,660);
    ctx.fillStyle='#111111';ctx.font='700 35px sans-serif';ctx.fillText(title,64,70,1072);
    ctx.fillStyle='#315568';ctx.fillRect(64,91,1072,4);
    const clipped=(text,width)=>{let line=String(text);if(ctx.measureText(line).width<=width)return line;while(line&&ctx.measureText(line+'…').width>width)line=line.slice(0,-1);return line.trimEnd()+'…';};
    const shown=metrics.slice(0,3),wide=shown.some(m=>String(m.value).length>22);
    if(wide){shown.forEach((m,i)=>{const y=133+i*73;ctx.fillStyle='#315568';ctx.font='600 24px sans-serif';ctx.fillText(clipped(m.label,1072),64,y);ctx.fillStyle='#111111';ctx.font='700 32px sans-serif';ctx.fillText(clipped(m.value,1072),64,y+35);});}
    else shown.forEach((m,i)=>{const x=64+i*367;if(i){ctx.fillStyle='#d7d8d1';ctx.fillRect(x-29,126,2,171);}ctx.fillStyle='#111111';ctx.font='700 32px sans-serif';const words=String(m.label).split(/\s+/);let a='',b='';for(const word of words){if(!b&&ctx.measureText((a?a+' ':'')+word).width<=325)a+=(a?' ':'')+word;else b+=(b?' ':'')+word;}ctx.fillText(a,x,148);if(b)ctx.fillText(clipped(b,325),x,184);let size=66;ctx.font='700 '+size+'px sans-serif';while(size>28&&ctx.measureText(String(m.value)).width>325){size-=2;ctx.font='700 '+size+'px sans-serif';}ctx.fillText(clipped(m.value,325),x,270);});
    ctx.fillStyle='#eaf0f1';ctx.fillRect(51,342,1098,100);ctx.fillStyle='#111111';ctx.font='600 36px sans-serif';ctx.fillText(rule,72,405,1050);
    ctx.font='500 31px sans-serif';ctx.fillText('Toucher le matériel · Manipuler · Comparer',64,520,1072);
    ctx.fillStyle='#d7d8d1';ctx.fillRect(64,563,1072,2);ctx.fillStyle='#111111';ctx.font='600 29px sans-serif';ctx.fillText('Observer · Déduire · Comprendre · Appliquer',64,614);
    s.boardReadings={workshop:title,metrics,rule};map.needsUpdate=true;
  };
  // Common board for the other workshops; the original electrical layout stays intact.
  s.updateWorkshopBoard=(title,lines=[])=>{
    const key=JSON.stringify(['workshop',title,lines]);if(key===previous)return;previous=key;
    ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,1200,660);
    ctx.fillStyle='#111111';ctx.font='700 38px sans-serif';
    ctx.fillText(title,64,76,1072);ctx.fillStyle='#315568';ctx.fillRect(64,98,1072,4);
    ctx.fillStyle='#111111';ctx.font='600 39px sans-serif';
    lines.slice(0,5).forEach((line,i)=>ctx.fillText(String(line),64,170+i*78,1072));
    ctx.fillStyle='#d7d8d1';ctx.fillRect(64,563,1072,2);
    ctx.font='600 29px sans-serif';ctx.fillStyle='#111111';ctx.fillText('Observer · Déduire · Comprendre · Appliquer',64,614);
    s.boardReadings={workshop:title,lines:[...lines]};map.needsUpdate=true;
  };
  s.updateBlackboard=(result,state)=>{
    const present=state.devices.lampe;
    const values=[result.lampVoltage,result.lampCurrent,result.lampPower].map(v=>present?Math.abs(v).toFixed(2).replace('.',','):'—');
    const rule=result.short?'Court-circuit : le filament est contourné.':'Relier le plot et le culot de la lampe.';
    s.boardReadings={present,voltage:present?Math.abs(result.lampVoltage):null,current:present?Math.abs(result.lampCurrent):null,power:present?result.lampPower:null};
    const key=JSON.stringify([values,rule]);if(key===previous)return;previous=key;
    ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,1200,660);
    ctx.fillStyle='#111111';ctx.font='700 35px sans-serif';ctx.fillText('LA LAMPE · VALEURS CALCULÉES',64,70);
    ctx.fillStyle='#315568';ctx.fillRect(64,91,1072,4);
    ['Tension U','Intensité I','Puissance P'].forEach((title,i)=>{
      const left=64+i*367;
      if(i){ctx.fillStyle='#d7d8d1';ctx.fillRect(left-29,126,2,171);}
      ctx.fillStyle='#111111';ctx.font='700 36px sans-serif';ctx.fillText(title,left,162);
      ctx.font='700 76px sans-serif';ctx.fillText(values[i],left,246);
      ctx.font='600 33px sans-serif';ctx.fillText(['volt · V','ampère · A','watt · W'][i],left,292);
    });
    ctx.fillStyle='#eaf0f1';ctx.fillRect(51,342,1098,81);
    ctx.font='700 54px sans-serif';ctx.fillStyle='#111111';ctx.fillText('P = U × I',72,402);
    ctx.font='600 35px sans-serif';ctx.fillText(rule,64,483);ctx.fillText('Le verre est isolant.',64,536);
    ctx.fillStyle='#d7d8d1';ctx.fillRect(64,563,1072,2);
    ctx.font='600 29px sans-serif';ctx.fillStyle='#111111';ctx.fillText('Observer · Déduire · Comprendre · Appliquer',64,614);
    map.needsUpdate=true;
  };
}
