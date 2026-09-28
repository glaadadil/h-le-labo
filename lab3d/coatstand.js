import * as T from './vendor/three.module.min.js';
import {addContactShadow} from './materials.js';

export function addCoatStand(s){
  const g=new T.Group();g.position.set(9.35,-2.945,-6.05);g.rotation.y=-.14;s.scene.add(g);
  const wood=s.mat('coatStandWood','#76634d',{roughness:.52}),steel=s.mat('hangerSteel','#8b979d',{metalness:.8,roughness:.27});
  s.cyl(g,.055,.08,4.35,wood,0,2.2,0,20);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;s.tube(g,[[0,.40,0],[Math.sin(a)*.26,.17,Math.cos(a)*.26],[Math.sin(a)*.64,.055,Math.cos(a)*.64]],.055,wood,'',16);
  }
  for(const side of [-1,1])s.tube(g,[[0,3.95,0],[side*.42,4.05,0],[side*.5,4.22,0]],.038,wood,'',16);
  s.mesh(g,new T.SphereGeometry(.085,16,12),wood,0,4.39,0);
  // Hanger suspended from the right hook; the coat faces the working table.
  const coat=new T.Group();coat.position.set(.28,0,.14);g.add(coat);
  s.tube(coat,[[.11,4.17,0],[.1,4.29,0],[-.03,4.29,0],[-.08,4.15,0],[0,4.04,0],[0,3.95,0]],.017,steel,'',20);
  s.tube(coat,[[0,3.95,0],[-.57,3.67,0],[.57,3.67,0],[0,3.95,0]],.025,wood,'',12);
  const fabric=s.mat('labCoat','#f5f4ec',{roughness:.96,side:T.DoubleSide,emissive:'#fffdf7',emissiveIntensity:.18}),lapel=s.mat('labCoatLapel','#fffef9',{roughness:.91,side:T.DoubleSide,emissive:'#fffdf7',emissiveIntensity:.12}),seam=s.mat('labCoatSeam','#cccfc9',{roughness:1});
  const panel=(points,mat,z)=>{
    const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelThickness:.015,bevelSize:.016,bevelSegments:2,steps:1});
    return s.mesh(coat,geo,mat,0,0,z);
  };
  panel([[-.20,3.78],[-.64,3.63],[-1.00,2.52],[-.76,2.42],[-.44,3.06],[-.51,1.42],[-.04,1.38],[.02,3.32]],fabric,.03);
  panel([[.20,3.78],[.64,3.63],[1.00,2.52],[.76,2.42],[.44,3.06],[.51,1.42],[-.02,1.38],[-.02,3.32]],fabric,.06);
  panel([[-.20,3.80],[-.35,3.57],[-.20,3.44],[-.31,3.34],[.02,2.95],[-.06,3.50]],lapel,.115);
  panel([[.20,3.80],[.35,3.57],[.20,3.44],[.31,3.34],[-.02,2.95],[.06,3.50]],lapel,.13);
  for(const x of [-.31,.30]){
    panel([[x-.13,2.15],[x+.13,2.15],[x+.12,1.83],[x-.12,1.83]],lapel,.125);
    s.tube(coat,[[x-.12,2.14,.18],[x+.12,2.14,.18]],.008,seam,'',2);
    s.tube(coat,[[x,2.66,.105],[x-.035,2.39,.13],[x+.02,2.20,.12]],.009,seam,'',10);
  }
  panel([[.16,3.03],[.38,3.03],[.37,2.78],[.17,2.78]],lapel,.135);
  for(const y of [2.82,2.54,2.26,1.98,1.70]){const button=s.cyl(coat,.028,.028,.02,seam,.045,y,.18,12);button.rotation.x=Math.PI/2;}
  s.tube(coat,[[-.93,2.54,.10],[-.78,2.48,.10]],.01,seam,'',2);s.tube(coat,[[.93,2.54,.13],[.78,2.48,.13]],.01,seam,'',2);
  addContactShadow(g,s.surface.shadow,1.9,1.7,.01,.5);
}
