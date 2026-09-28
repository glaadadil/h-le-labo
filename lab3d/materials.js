import * as T from './vendor/three.module.min.js';

// Authored locally: repeatable mineral/wood grain, daylight and contact shading.
// No downloaded textures, random changes between visits, or animation loop.
function random(seed=47){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function canvas(w,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function texture(c,repeat=1){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;return t;}
function grain(kind){
  const c=canvas(512),ctx=c.getContext('2d'),pixels=ctx.createImageData(512,512),r=random(kind==='wood'?21:47);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,noise=r()-.5;
    if(kind==='wood'){
      const bend=3*Math.sin(x*.018)+1.7*Math.sin(x*.046+y*.011),v=y+bend;
      const grain=Math.sin(v*1.9)*3+Math.sin(v*.44+Math.sin(x*.025))*4+Math.sin(v*.13)*6;
      const pore=r()>.983?-23:0;
      pixels.data[i]=178+grain+noise*13+pore;pixels.data[i+1]=135+grain*.8+noise*11+pore;pixels.data[i+2]=89+grain*.6+noise*8+pore;
    }else{
      const cloud=2*Math.sin(x*.05+Math.sin(y*.016))+1.5*Math.sin(y*.039+Math.cos(x*.013));
      const fleck=r()>.991?-18:r()>.975?9:0,n=cloud+noise*10+fleck;
      pixels.data[i]=220+n;pixels.data[i+1]=217+n;pixels.data[i+2]=208+n;
    }
    pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const t=texture(c,kind==='wood'?.7:.5);if(kind==='wood')t.repeat.set(.44,1.3);return t;
}
function floor(){const c=canvas(512),ctx=c.getContext('2d'),r=random(95);ctx.fillStyle='#b6b5af';ctx.fillRect(0,0,512,512);for(let i=0;i<40000;i++){ctx.fillStyle=`rgba(${r()>.5?'255,255,255':'65,62,52'},.035)`;ctx.fillRect(r()*512,r()*512,1,1);}ctx.strokeStyle='#94958f';ctx.lineWidth=2;ctx.strokeRect(1,1,510,510);ctx.strokeStyle='#cdcdc5';ctx.lineWidth=1;ctx.strokeRect(3,3,507,507);return texture(c,9);}
function garden(){
  const c=canvas(1024,576),ctx=c.getContext('2d'),r=random(82),sky=ctx.createLinearGradient(0,0,0,576);
  sky.addColorStop(0,'#b4d0e1');sky.addColorStop(.7,'#edf1e9');sky.addColorStop(1,'#c4cdb6');ctx.fillStyle=sky;ctx.fillRect(0,0,1024,576);
  // Distant leafy trees: irregular silhouettes with small leaves, not solid spheres.
  const tree=(ox,oy,size)=>{
    const branch=(x,y,len,a,width,depth)=>{const nx=x+Math.cos(a)*len,ny=y+Math.sin(a)*len;ctx.strokeStyle='rgba(94,105,84,.25)';ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();if(depth){branch(nx,ny,len*.68,a-.4-r()*.3,width*.65,depth-1);branch(nx,ny,len*.72,a+.4+r()*.3,width*.65,depth-1);}else for(let j=0;j<70;j++){const ang=r()*Math.PI*2,rad=r()*size*.13;ctx.fillStyle=['#9dae92','#acbca1','#c0cdb2','#819877'][Math.floor(r()*4)];ctx.globalAlpha=.14+r()*.25;ctx.beginPath();ctx.ellipse(nx+Math.cos(ang)*rad,ny+Math.sin(ang)*rad,2+r()*5,1.5+r()*3,r()*Math.PI,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}};
    branch(ox,oy,size,-Math.PI/2,4,5);
  };
  tree(80,650,180);tree(880,660,200);tree(510,660,130);const soft=canvas(1024,576);soft.getContext('2d').drawImage(c,0,0);ctx.filter='blur(2px)';ctx.drawImage(soft,0,0);ctx.filter='none';ctx.fillStyle='rgba(250,246,228,.17)';ctx.fillRect(0,0,1024,576);
  const t=texture(c);t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return t;
}
function shadow(){const c=canvas(128),ctx=c.getContext('2d'),grad=ctx.createRadialGradient(64,64,12,64,64,64);grad.addColorStop(0,'rgba(34,30,23,.48)');grad.addColorStop(.38,'rgba(34,30,23,.28)');grad.addColorStop(.72,'rgba(34,30,23,.075)');grad.addColorStop(1,'rgba(34,30,23,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);return texture(c);}
export function makeMaterials(){return {stone:grain('stone'),wood:grain('wood'),floor:floor(),garden:garden(),shadow:shadow()};}

export function addContactShadow(parent,map,w,d,y=.014,opacity=1){const mesh=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.raycast=()=>{};parent.add(mesh);return mesh;}
