// Separate namespace: the original circuit notebook is never rewritten here.
export const MAX_TRIALS=120;
export const STORE='h-le-labo-ateliers-v1';
export const clone=value=>JSON.parse(JSON.stringify(value));
export const blank=()=>({version:1,drafts:{},notes:{},trials:[],deletedTrial:null,lastWorkshop:null});
export function finiteJSON(value,depth=0){
  if(depth>15)return false;
  if(value===null||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value==='string')return value.length<20000;
  if(Array.isArray(value))return value.length<=2000&&value.every(v=>finiteJSON(v,depth+1));
  return !!value&&typeof value==='object'&&Object.keys(value).length<=150&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&finiteJSON(v,depth+1));
}
export function matchesState(value,initial){
  if(!finiteJSON(value)||!value||typeof value!=='object'||Array.isArray(value))return false;
  return Object.entries(initial).every(([k,v])=>Object.hasOwn(value,k)&&(v===null?true:Array.isArray(v)?Array.isArray(value[k]):typeof v===typeof value[k]));
}
function validTrial(t){return !!t&&typeof t.id==='string'&&/^[-\w]+$/.test(t.id)&&typeof t.workshopId==='string'&&typeof t.title==='string'&&typeof t.note==='string'&&t.note.length<=4000&&Number.isFinite(t.savedAt)&&finiteJSON(t.state)&&typeof t.image==='string'&&(t.image===''||/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(t.image))&&t.image.length<200000;}
export function readStore(raw){
  if(raw===null)return blank();
  const data=JSON.parse(raw);
  if(!data||data.version!==1||!data.drafts||!data.notes||typeof data.drafts!=='object'||typeof data.notes!=='object'||Array.isArray(data.drafts)||Array.isArray(data.notes)||!finiteJSON(data.drafts)||!finiteJSON(data.notes)||!Array.isArray(data.trials)||data.trials.length>MAX_TRIALS||!data.trials.every(validTrial)||!(data.deletedTrial===null||validTrial(data.deletedTrial))||!(data.lastWorkshop===null||typeof data.lastWorkshop==='string'))throw Error('Format du carnet non reconnu');
  if(!Object.values(data.notes).every(v=>typeof v==='string'&&v.length<=4000))throw Error('Note non valide');
  return data;
}
