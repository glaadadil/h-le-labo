/* E02-A1 — profil borné : une pile, une lampe L6, contacts et fils idéaux. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HidayaCircuit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'E02-1.0';
  const PROFILE = Object.freeze({ emf: 6, internalResistance: 1, lampLinear: 10, lampQuadratic: 100 / 3, nominalPower: 1.8 });
  const TERMINALS = Object.freeze({ 'pile:p':'pile', 'pile:m':'pile', 'lampe:plot':'lampe', 'lampe:culot':'lampe', 'lampe:culot2':'lampe', 'lampe:verre':'lampe', 'interrupteur:a':'interrupteur', 'interrupteur:b':'interrupteur', 'douille:a':'douille', 'douille:b':'douille' });
  const DEVICES = ['pile','lampe','interrupteur','douille'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function initial() {
    return { devices:{pile:true,lampe:true,interrupteur:true,douille:false}, switchClosed:false, filamentIntact:true, batteryCharged:true, polarity:1, mounted:false, wires:[], positions:{pile:{x:0.04,y:0.02},lampe:{x:0.96,y:0.02},interrupteur:{x:0.04,y:0.96},douille:{x:0.96,y:0.96}} };
  }
  function valid(s) {
    if (!s || typeof s !== 'object' || !s.devices || !s.positions || !Array.isArray(s.wires) || s.wires.length > 64) return false;
    if (!DEVICES.every(d => typeof s.devices[d] === 'boolean' && Number.isFinite(s.positions[d]?.x) && Number.isFinite(s.positions[d]?.y) && s.positions[d].x >= 0 && s.positions[d].x <= 1 && s.positions[d].y >= 0 && s.positions[d].y <= 1)) return false;
    if (!['switchClosed','filamentIntact','batteryCharged','mounted'].every(k => typeof s[k] === 'boolean') || ![1,-1].includes(s.polarity)) return false;
    if (s.mounted && (!s.devices.douille || !s.devices.lampe)) return false;
    const pairs = new Set(), ids = new Set();
    return s.wires.every(w => {
      if (!w || typeof w.id !== 'string' || !/^w[0-9]+$/.test(w.id) || ids.has(w.id) || !TERMINALS[w.a] || !TERMINALS[w.b] || w.a === w.b || typeof w.intact !== 'boolean' || !s.devices[TERMINALS[w.a]] || !s.devices[TERMINALS[w.b]]) return false;
      const pair = [w.a,w.b].sort().join('|');
      if (pairs.has(pair)) return false;
      pairs.add(pair); ids.add(w.id); return true;
    });
  }
  function connect(s, a, b) {
    if (!TERMINALS[a] || !TERMINALS[b] || !s.devices[TERMINALS[a]] || !s.devices[TERMINALS[b]]) return 'Choisis deux contacts présents sur la table.';
    if (a === b) return 'Choisis un second contact différent.';
    if (s.wires.some(w => w.a === a && w.b === b || w.a === b && w.b === a)) return 'Ces deux contacts sont déjà reliés.';
    if (s.wires.length >= 64) return 'La table contient déjà 64 fils. Retire une liaison pour en ajouter une.';
    const n = Math.max(0, ...s.wires.map(w => Number(w.id.slice(1)))) + 1;
    s.wires.push({id:'w'+n,a,b,intact:true}); return null;
  }
  function removeDevice(s, id) {
    if (!DEVICES.includes(id)) return;
    s.devices[id] = false;
    s.wires = s.wires.filter(w => TERMINALS[w.a] !== id && TERMINALS[w.b] !== id);
    if (id === 'lampe' || id === 'douille') s.mounted = false;
  }
  function lampCurrent(voltage) {
    const u = Math.abs(voltage), a = PROFILE.lampQuadratic, b = PROFILE.lampLinear;
    return Math.sign(voltage) * 2 * u / (b + Math.sqrt(b*b + 4*a*u));
  }
  function solve(s) {
    if (!valid(s)) throw new Error('État du circuit non valide.');
    const active = Object.keys(TERMINALS).filter(t => s.devices[TERMINALS[t]]);
    const parent = Object.fromEntries(active.map(t => [t,t]));
    const find = t => parent[t] === t ? t : (parent[t] = find(parent[t]));
    const join = (a,b) => { parent[find(a)] = find(b); };
    if (s.devices.lampe) join('lampe:culot','lampe:culot2');
    if (s.devices.interrupteur && s.switchClosed) join('interrupteur:a','interrupteur:b');
    if (s.mounted) { join('douille:a','lampe:plot'); join('douille:b','lampe:culot'); }
    // Le verre n'est pas un nœud conducteur : des fils posés dessus restent isolés.
    for (const w of s.wires) if (w.intact && w.a !== 'lampe:verre' && w.b !== 'lampe:verre') join(w.a,w.b);
    const same = (a,b) => parent[a] !== undefined && parent[b] !== undefined && find(a) === find(b);
    const sourcePresent = s.devices.pile;
    const emf = sourcePresent && s.batteryCharged ? PROFILE.emf * s.polarity : 0;
    const short = sourcePresent && same('pile:p','pile:m');
    const acrossForward = s.devices.lampe && same('lampe:plot','pile:p') && same('lampe:culot','pile:m');
    const acrossReverse = s.devices.lampe && same('lampe:plot','pile:m') && same('lampe:culot','pile:p');
    const across = !short && (acrossForward || acrossReverse);
    let sourceCurrent = 0, lampI = 0, lampU = 0;
    if (short) sourceCurrent = emf / PROFILE.internalResistance;
    else if (across && s.filamentIntact) {
      const a = PROFILE.lampQuadratic, b = PROFILE.lampLinear + PROFILE.internalResistance;
      sourceCurrent = Math.sign(emf) * 2 * Math.abs(emf) / (b + Math.sqrt(b*b + 4*a*Math.abs(emf)));
      lampI = (acrossForward ? 1 : -1) * sourceCurrent;
      lampU = PROFILE.lampLinear * lampI + a * lampI * Math.abs(lampI);
    } else if (across) lampU = (acrossForward ? 1 : -1) * emf;
    const power = lampU * lampI;
    let status = 'open';
    if (short) status = 'short';
    else if (!s.devices.lampe) status = 'no-lamp';
    else if (!sourcePresent) status = 'no-source';
    else if (!s.batteryCharged) status = 'empty-source';
    else if (!s.filamentIntact) status = 'broken-filament';
    else if (power > 1e-12) status = 'lit';
    return { version:VERSION, status, lit:power > 1e-12, short, sourcePresent, across, sourceCurrent, sourceVoltage:emf-PROFILE.internalResistance*sourceCurrent, lampCurrent:lampI, lampVoltage:lampU, lampPower:power, brightness:Math.max(0,Math.min(1,power/PROFILE.nominalPower)), glassContacts:s.wires.filter(w => w.intact && (w.a === 'lampe:verre' || w.b === 'lampe:verre')).length, nodes:Object.fromEntries(active.map(t => [t,find(t)])) };
  }
  function example(kind) {
    const s = initial();
    if (kind === 'direct') {
      s.devices.interrupteur = false;
      connect(s,'pile:p','lampe:plot'); connect(s,'lampe:culot','pile:m');
    } else {
      connect(s,'pile:p','lampe:plot'); connect(s,'lampe:culot','interrupteur:a'); connect(s,'interrupteur:b','pile:m');
      s.switchClosed = kind === 'closed';
    }
    return s;
  }
  return Object.freeze({VERSION,PROFILE,TERMINALS,DEVICES,initial,valid,clone,connect,removeDevice,lampCurrent,solve,example});
});
