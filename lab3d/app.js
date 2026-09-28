import './scene.js';
(function () {
  'use strict';
  const C = window.HidayaCircuit;
  const main = document.getElementById('main'), feedback = document.getElementById('feedback');
  const STORE = 'hidaya-laboratoire-e02-v1';
  const names = {pile:'Pile',lampe:'Lampe',interrupteur:'Interrupteur',douille:'Douille'};
  const labels = {'pile:p':'Pile · borne gauche','pile:m':'Pile · borne droite','lampe:plot':'Lampe · plot','lampe:culot':'Lampe · culot A','lampe:culot2':'Lampe · culot B','lampe:verre':'Lampe · verre','interrupteur:a':'Interrupteur · A','interrupteur:b':'Interrupteur · B','douille:a':'Douille · plot','douille:b':'Douille · culot'};
  const ports = {pile:[['pile:p','Gauche'],['pile:m','Droite']],lampe:[['lampe:plot','Plot'],['lampe:culot','Culot A'],['lampe:verre','Verre'],['lampe:culot2','Culot B']],interrupteur:[['interrupteur:a','Contact A'],['interrupteur:b','Contact B']],douille:[['douille:a','Vers le plot'],['douille:b','Vers le culot']]};
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (n,d=2) => n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const clone = C.clone;
  let circuit = C.example('closed'), note = '', trials = [], hasDraft = false, counter = 0;
  const positions3d={pile:{x:.16,y:.16},lampe:{x:.83,y:.39},interrupteur:{x:.46,y:.85},douille:{x:.82,y:.85}};
  circuit.positions=clone(positions3d);
  let scene3d=null,drawer=null;
  let screen = 'bench', free = false, view = 'objects', panel = null, selected = null, pending = null;
  let selectedWire=null, previewPoint=null, wireDrag=null, suppressClickUntil=0, noteOpen=false;
  let deletedTrial=null, archiveView='objects', previewTrial=null, previewReturn=null, snapshotSequence=0;
  const anchors={'pile:p':{x:66,y:40,nx:0,ny:-1},'pile:m':{x:154,y:40,nx:0,ny:-1},'lampe:plot':{x:110,y:157,nx:0,ny:1},'lampe:culot':{x:161,y:123,nx:1,ny:0},'lampe:culot2':{x:59,y:123,nx:-1,ny:0},'lampe:verre':{x:80,y:53,nx:-1,ny:0},'interrupteur:a':{x:35,y:101,nx:-1,ny:0},'interrupteur:b':{x:185,y:101,nx:1,ny:0},'douille:a':{x:46,y:128,nx:-1,ny:0},'douille:b':{x:174,y:128,nx:1,ny:0}};
  let undo = [], redo = [], compareA = null, compareB = null, connectionsOpen = false, modelOpen = false;
  let blockedStorage = false, loadWarning = '', saveTimer = null, observer = null, drag = null;
  function announce(s) { feedback.textContent = s; }
  function saveStatus(s) { document.getElementById('save-status').textContent = s; }
  function validTrial(t) {
    return t && typeof t.id==='string' && /^t[0-9]+$/.test(t.id) && t.model===C.VERSION && C.valid(t.circuit) && typeof t.note==='string' && t.note.length<=2000 && typeof t.name==='string' && t.name.length<=60;
  }
  function readSaved() {
    try {
      const raw = localStorage.getItem(STORE); if (!raw) return;
      const d = JSON.parse(raw);
      if (d.version !== 1 || !C.valid(d.circuit) || typeof d.note !== 'string' || d.note.length > 2000 || typeof d.hasDraft !== 'boolean' || !Number.isSafeInteger(d.counter) || d.counter < 0 || !Array.isArray(d.trials) || d.trials.length > 120) throw new Error('Format');
      const ids = new Set();
      for (const t of d.trials) {
        if (!validTrial(t) || ids.has(t.id)) throw new Error('Essai');
        ids.add(t.id);
      }
      circuit = clone(d.circuit); note = d.note; trials = clone(d.trials); hasDraft = d.hasDraft;
      if(d.deletedTrial && validTrial(d.deletedTrial.trial) && !ids.has(d.deletedTrial.trial.id) && Number.isInteger(d.deletedTrial.index) && d.deletedTrial.index>=0 && d.deletedTrial.index<120) deletedTrial=clone(d.deletedTrial);
      counter = Math.max(d.counter,...trials.map(t=>Number(t.id.slice(1))),Number(deletedTrial?.trial.id.slice(1)||0));
      free = d.free === true; if(free)panel=null; view = d.view === 'symbols' ? 'symbols' : 'objects';
    } catch (e) {
      blockedStorage = true;
      loadWarning = 'La sauvegarde locale est indisponible ou illisible. Tu peux expérimenter pendant cette session ; les anciennes données ne sont pas remplacées.';
      saveStatus('Session seulement · sauvegarde indisponible');
    }
  }
  function persist() {
    clearTimeout(saveTimer); saveTimer=null;
    if (blockedStorage) { saveStatus('Session seulement · sauvegarde indisponible'); return; }
    try {
      localStorage.setItem(STORE,JSON.stringify({version:1,circuit,note,trials,hasDraft,counter,free,view,deletedTrial}));
      saveStatus('Enregistré dans ce navigateur');
    } catch (e) { saveStatus('Session seulement · espace de sauvegarde indisponible'); }
  }
  function beforeChange() { return {circuit:clone(circuit),note}; }
  function mutate(fn,message) {
    const previous = beforeChange(); fn();
    if (!C.valid(circuit)) { circuit = previous.circuit; note = previous.note; announce('Cette modification n’a pas pu être appliquée.'); return; }
    if (JSON.stringify(previous) !== JSON.stringify(beforeChange())) { previous.restoreNote=previous.note!==note;undo.push(previous); if (undo.length > 50) undo.shift(); redo=[]; }
    hasDraft=true; pending=null; previewPoint=null; if(!circuit.wires.some(w=>w.id===selectedWire))selectedWire=null; persist(); render(); if (message) announce(message);
  }
  function btn(action,label,arg='',extra='') { return `<button type="button" data-action="${action}" data-arg="${esc(arg)}" ${extra}>${label}</button>`; }
  function observation(s,r) {
    const map = {
      lit:['La lampe est allumée','Ses deux contacts sont reliés à la pile par un trajet conducteur complet.'],
      open:['La lampe est éteinte','Le filament ne reçoit pas de courant. Examine les contacts et les fils du montage.'],
      short:['La pile est court-circuitée','Un trajet de fils ou de contacts fermés relie directement ses deux bornes. La lampe ne reçoit plus de tension dans ce montage.'],
      'no-source':['La lampe est éteinte','Il manque une source sur la table pour fournir de l’énergie au circuit.'],
      'no-lamp':['La lampe est absente','Ajoute une lampe depuis la réserve pour observer son fonctionnement.'],
      'broken-filament':['La lampe est éteinte','Le filament a été coupé dans cet essai. Le trajet intérieur de la lampe est ouvert.'],
      'empty-source':['La lampe est éteinte','La pile est réglée sur « déchargée » pour cet essai.']
    };
    const message = map[r.short ? 'short' : r.status];
    if (r.status === 'open' && r.glassContacts) return [message[0],'Un fil touche le verre isolant. Ce contact ne rejoint pas le filament. Examine aussi les autres liaisons.'];
    return message;
  }
  function statusMarkup(s,r) {
    const [title,text]=observation(s,r);
    return `<section class="observation" data-state="${r.short?'short':r.status}" aria-live="polite"><span class="observation-dot" aria-hidden="true"></span><div><strong id="lamp-status">${title}</strong><p>${text}</p></div></section>`;
  }
  function art(id,s,r,symbol=false) {
    const attrs='viewBox="0 0 220 180" class="device-figure" aria-hidden="true"';
    const defs=`<defs><linearGradient id="metal-${id}" x2="1" y2=".3"><stop stop-color="#edf0f2"/><stop offset=".45" stop-color="#929da5"/><stop offset=".7" stop-color="#e4e8eb"/><stop offset="1" stop-color="#7d888f"/></linearGradient><linearGradient id="case-${id}" x2="0" y2="1"><stop stop-color="#52616d"/><stop offset="1" stop-color="#27343e"/></linearGradient><radialGradient id="glass-${id}"><stop stop-color="${r.lit?'#fff9d8':'#ffffff'}" stop-opacity=".95"/><stop offset="1" stop-color="${r.lit?'#ffce58':'#bdd3dc'}" stop-opacity=".6"/></radialGradient></defs>`;
    const metal=`url(#metal-${id})`;
    if(id==='pile')return `<svg ${attrs}>${defs}${symbol?`<path d="M66 40V91H94 M154 40V91H126 ${s.polarity===1?'M94 56V126 M126 71V111':'M94 71V111 M126 56V126'}" fill="none" stroke="#3c4851" stroke-width="3"/>`:`<ellipse cx="110" cy="159" rx="83" ry="11" fill="#38434c" opacity=".12"/><rect x="36" y="63" width="148" height="90" rx="13" fill="url(#case-${id})" stroke="#26323b" stroke-width="2"/><path d="M39 78H181" stroke="#75818c" stroke-width="2"/><rect x="59" y="37" width="14" height="27" rx="3" fill="${metal}" stroke="#6a757e"/><rect x="147" y="37" width="14" height="27" rx="3" fill="${metal}" stroke="#6a757e"/><rect x="67" y="90" width="86" height="39" rx="4" fill="#ede8dc"/><text x="110" y="116" text-anchor="middle" font-size="24" font-weight="500" fill="#394650">6 V</text>`}</svg>`;
    if(id==='lampe')return `<svg ${attrs}>${defs}${r.lit?'<ellipse cx="110" cy="65" rx="60" ry="59" fill="#ffce57" opacity=".28"/>':''}${symbol?`<path d="M59 123V34H161V123 M110 34V42 M110 157V114" fill="none" stroke="#56616a" stroke-width="3"/><circle cx="110" cy="34" r="4" fill="#56616a"/><circle cx="110" cy="78" r="36" fill="${r.lit?'#ffe187':'#ffffff66'}" stroke="#45535f" stroke-width="2.5"/><path d="M85 53L${s.filamentIntact?'135 103':'106 74 M116 84L135 103'} M85 103L135 53" fill="none" stroke="#45535f" stroke-width="2.5"/>`:`<ellipse cx="110" cy="165" rx="50" ry="8" fill="#38434c" opacity=".12"/><path d="M88 114C88 96 67 93 67 61C67 9 153 9 153 61C153 93 132 96 132 114Z" fill="url(#glass-${id})" stroke="#8da1ab" stroke-width="2"/><path d="M83 48C86 34 92 29 103 26" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M99 114V75L105 64L112 78${s.filamentIntact?'L119 64L123 75V114':' M123 83V114'}" fill="none" stroke="${r.lit?'#d39618':'#6c757b'}" stroke-width="2.5"/><rect x="88" y="112" width="44" height="30" rx="4" fill="${metal}" stroke="#77828a"/><path d="M91 118H129 M91 125H129 M91 132H129" stroke="#626e78" stroke-width="2"/><path d="M88 123H59 M132 123H161 M110 146V157" stroke="#87939b" stroke-width="6"/><path d="M102 144H118" stroke="#454b51" stroke-width="4"/>`}</svg>`;
    if(id==='interrupteur')return `<svg ${attrs}>${defs}${symbol?'':`<ellipse cx="110" cy="148" rx="93" ry="12" fill="#38434c" opacity=".12"/><path d="M20 81L31 68H190L200 82V142H20Z" fill="#92734e" stroke="#7b644a"/><rect x="20" y="69" width="180" height="63" rx="8" fill="#d4b991" stroke="#af9270"/><path d="M29 126H192" stroke="#eed9b7"/>`}<path d="M35 101H62 M163 101H185" stroke="#6f7982" stroke-width="7"/><circle cx="62" cy="101" r="8" fill="${metal}" stroke="#606b75"/><path d="M62 101L${s.switchClosed?'165 101':'153 51'}" stroke="#646f77" stroke-width="9" stroke-linecap="round"/><path d="M85 ${s.switchClosed?'101':'89'}L${s.switchClosed?'151 101':'145 55'}" stroke="#304656" stroke-width="15" stroke-linecap="round"/><path d="M157 95V107H169V95" fill="${metal}" stroke="#66727a"/></svg>`;
    return `<svg ${attrs}>${defs}<ellipse cx="110" cy="158" rx="88" ry="11" fill="#38434c" opacity=".1"/><path d="M32 133L59 64H163L187 133Q110 164 32 133Z" fill="#f7f4eb" stroke="#c6c2b6" stroke-width="2"/><ellipse cx="111" cy="65" rx="52" ry="23" fill="#c3c9cb" stroke="#737f89" stroke-width="4"/><ellipse cx="111" cy="65" rx="34" ry="14" fill="#48525b"/><path d="M46 128H78V97 M174 128H146V81" stroke="#9d9279" stroke-width="5" fill="none"/>${s.mounted?'<path d="M102 60L109 67L123 50" stroke="#ebd591" fill="none" stroke-width="4"/>':''}</svg>`;
  }
  function home() {
    return `<section class="hero"><div><p class="eyebrow">Observer · déduire · comprendre · appliquer</p><h1>Et si tu allumais<br>cette lampe ?</h1><p class="subtitle">Une pile, une lampe, quelques fils. Construis ton montage et observe ce qui change à chaque essai.</p><div class="row">${btn('bench',hasDraft?'Reprendre ma table':'Entrer dans le laboratoire','','class="primary"')}${btn('free','Explorer librement')}</div></div><div class="hero-art">${art('lampe',C.initial(),{lit:true,brightness:.95})}<p>Les contacts font toute la différence.</p></div></section><section class="entry"><div><p class="eyebrow">E02 · Le circuit électrique simple</p><h3>Construire une boucle qui allume la lampe</h3><p>Manipuler, consulter une aide, conserver un essai.</p></div>${btn('catalogue','Voir l’expérience')}</section>`;
  }
  function catalogue() {
    return `<div class="heading"><div><p class="eyebrow">Les expériences du manuel · Électricité</p><h1>Le circuit électrique simple</h1><p class="subtitle">Comment obtenir une lampe allumée et expliquer le chemin conducteur ?</p></div></div><section class="entry"><div><p class="eyebrow">E02-A1 · Manuel p. 155–157 et 163–166</p><h3>Construire une boucle qui allume la lampe</h3><p>Relier les bons contacts, commander le circuit et essayer une autre disposition.</p></div>${btn('bench','Ouvrir l’atelier','','class="primary"')}</section><p class="subtitle">Ce premier atelier réalise le début de la leçon E02. Les autres ateliers du catalogue seront ajoutés progressivement.</p>`;
  }
  function deviceCard(id,r) {
    const stateText=id==='pile'?(circuit.batteryCharged?'6 V · disponible':'Déchargée'):id==='lampe'?(circuit.filamentIntact?(r.lit?'Allumée':'Éteinte'):'Filament coupé')+(circuit.mounted?' · sur douille':''):id==='interrupteur'?(circuit.switchClosed?'Fermé · toucher pour ouvrir':'Ouvert · toucher pour fermer'):(circuit.mounted?'Lampe vissée':'Douille vide');
    const controls=ports[id].map(([t,label])=>{
      if(id==='pile')label=(t==='pile:p')===(circuit.polarity===1)?'+':'−';
      const p=anchors[t];
      return `<button type="button" class="terminal" data-terminal="${t}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(labels[t])}${id==='pile'?' '+label:''}" aria-pressed="false"><span class="terminal-dot" aria-hidden="true"></span><span class="terminal-label">${esc(label)}</span><span class="terminal-flag" aria-hidden="true"></span></button>`;
    }).join('');
    return `<section class="device ${selected===id?'selected':''} ${id==='lampe'&&r.lit?'lit':''}" data-device="${id}" aria-label="${names[id]}"><div class="selection-frame" aria-hidden="true"></div><button type="button" class="object-body device-grab" data-action="select" data-arg="${id}" aria-label="Sélectionner ${names[id].toLowerCase()}" aria-pressed="${selected===id}">${art(id,circuit,r,view==='symbols')}</button>${controls}${id==='interrupteur'?`<button type="button" class="switch-lever" data-action="switch" role="switch" aria-checked="${circuit.switchClosed}" aria-label="${circuit.switchClosed?'Ouvrir':'Fermer'} l’interrupteur"></button>`:''}<button type="button" class="device-handle device-grab" data-action="select" data-arg="${id}" aria-pressed="${selected===id}">${names[id]}<span class="selection-label">${selected===id?'Sélectionné · cliquer pour libérer':'Déplacer ou examiner'}</span></button><span class="device-state">${stateText}</span></section>`;
  }
  function terminalOptions() { return Object.keys(C.TERMINALS).filter(t=>circuit.devices[C.TERMINALS[t]]).map(t=>`<option value="${t}">${esc(labels[t])}</option>`).join(''); }
  function connections() {
    return `<details class="panel" id="connections" ${connectionsOpen?'open':''}><summary>Relier des contacts et gérer les fils (${circuit.wires.length})</summary><div class="inner"><form id="connection-form" class="connect-fields"><label for="from">Premier contact<select id="from" name="from">${terminalOptions()}</select></label><label for="to">Second contact<select id="to" name="to">${terminalOptions()}</select></label><button type="submit">Relier</button></form><p class="help-label" style="margin-top:10px">Tu peux aussi toucher deux contacts directement sur la table. Deux fils qui se croisent ne sont pas reliés.</p><ul class="wire-list">${circuit.wires.map(w=>`<li class="wire-item"><span>${esc(labels[w.a])} ↔ ${esc(labels[w.b])}${w.intact?'':' · fil coupé'}</span><span class="row">${btn('wire-toggle',w.intact?'Couper':'Rétablir',w.id)}${btn('wire-remove','Retirer',w.id)}</span></li>`).join('')||'<li class="muted">Aucun fil pour le moment.</li>'}</ul></div></details>`;
  }
  function cutaway() {
    return `<svg class="cutaway" viewBox="0 0 340 220" role="img" aria-label="Le plot rejoint une tige, le filament, l’autre tige puis le culot. Le verre et l’isolant séparent les conducteurs."><path d="M116 152C115 117 90 103 90 64C90 2 220 2 220 64C220 103 195 117 194 152" fill="var(--board)" stroke="var(--ink)" stroke-width="2"/><path d="M143 193V94L152 72L161 94L170 72L179 94V153H192 M116 155H194V178H116Z M116 166H194 M143 191H168" fill="none" stroke="var(--ink)" stroke-width="2"/><path d="M135 183H175" stroke="var(--warning)" stroke-width="6"/><path d="M202 35H237 M180 80H238 M194 163H238 M168 191H238 M115 181H61" stroke="var(--muted)"/><g fill="var(--ink)" font-size="12"><text x="242" y="39">Verre</text><text x="242" y="84">Filament</text><text x="242" y="167">Culot</text><text x="242" y="195">Plot</text><text x="13" y="185">Isolant</text></g></svg>`;
  }
  function inspector() {
    if (selected && circuit.devices[selected]) {
      const descriptions={pile:'La pile possède deux bornes distinctes et fournit de l’énergie électrique au circuit.',lampe:'Le plot et le culot sont les deux contacts de la lampe. Culot A et culot B appartiennent à la même pièce métallique ; le verre est isolant.',interrupteur:'Fermé, l’interrupteur relie ses deux contacts. Ouvert, il coupe cette liaison. Une lampe peut aussi fonctionner dans une boucle sans interrupteur.',douille:'Une lampe vissée relie le contact « vers le plot » au plot, et « vers le culot » au culot. La douille seule ne relie pas ses deux contacts.'};
      let commands='';
      if(selected==='pile')commands=btn('polarity','Inverser la pile')+btn('charge',circuit.batteryCharged?'Essayer une pile déchargée':'Remettre une pile disponible');
      if(selected==='lampe')commands=btn('filament',circuit.filamentIntact?'Couper le filament':'Remplacer par une lampe intacte')+`<details><summary>Voir l’intérieur de la lampe</summary>${cutaway()}</details>`;
      if(selected==='interrupteur')commands=btn('switch',circuit.switchClosed?'Ouvrir l’interrupteur':'Fermer l’interrupteur','','class="primary"');
      if(selected==='douille')commands=btn('mount',circuit.mounted?'Dévisser la lampe':'Visser la lampe', '',circuit.devices.lampe?'':'disabled');
      return `<section class="inspector"><div class="row spread"><h3>${names[selected]}</h3>${btn('close-panel','Replier','','class="plain"')}</div><p>${descriptions[selected]}</p><div class="row">${commands}${btn('remove-device','Retirer de la table',selected)}</div></section>`;
    }
    if (!panel) return '';
    const content = {
      Observer:'<p>Commence avec un seul fil, puis essaie d’obtenir deux contacts utiles sur la lampe. Qu’est-ce qui change quand tu ouvres l’interrupteur ?</p><ul><li>Compare un contact sur le verre et un contact sur le plot.</li><li>Déplace la lampe en gardant les mêmes fils.</li><li>Conserve les essais que tu souhaites comparer.</li></ul>',
      Déduire:'<p>Pour les essais où la lampe s’allume, qu’ont en commun les contacts et le trajet ? Une boucle qui ressemble à un rectangle suffit-elle ?</p><details><summary>Voir une piste de conclusion</summary><p>Il faut un trajet conducteur complet qui relie les deux bornes de la pile au plot et au culot de la lampe, en passant par son filament intact. Le verre ne constitue pas un contact conducteur.</p></details>',
      Comprendre:'<p>La pile fournit l’énergie ; le filament de la lampe la transforme notamment en lumière et en chaleur. Les fils relient des contacts. L’interrupteur commande une liaison : il n’est pas indispensable si les fils forment déjà une boucle complète.</p><details><summary>Suivre le trajet intérieur de la lampe</summary>'+cutaway()+'<p>Plot → tige → filament → autre tige → culot. L’isolant entre plot et culot empêche un passage direct entre les deux.</p></details>',
      Appliquer:'<p>Allume la lampe sans interrupteur, puis déplace les objets. Essaie ensuite deux contacts différents sur le culot : peux-tu prévoir ce qui arrivera ?</p><details><summary>Consulter l’explication</summary><p>Sans interrupteur, un fil peut relier chaque borne de la pile à un contact différent de la lampe. Deux points du culot sont une seule borne électrique : y relier les deux bornes de la pile contourne le filament et court-circuite la pile.</p></details>'
    };
    return `<section class="inspector"><div class="row spread"><h3>${panel}</h3>${btn('close-panel','Replier','','class="plain"')}</div>${content[panel]}</section>`;
  }
  function modelDetails(r) {
    return `<details class="panel model" id="model" ${modelOpen?'open':''}><summary>Conditions et valeurs du modèle</summary><div class="inner"><p>Ce montage utilise une pile pédagogique construite : force électromotrice 6 V et résistance interne 1 Ω. Ce n’est pas la fiche d’une marque de pile. La lampe L6 utilise une courbe construite, avec un repère de 6 V ; son éclat représente sa puissance, sans mesure en lumens.</p><dl><dt>Tension calculée aux bornes de la pile</dt><dd>${r.sourcePresent?fmt(Math.abs(r.sourceVoltage))+' V':'Pile absente'}</dd><dt>Intensité calculée dans la pile</dt><dd>${r.sourcePresent?fmt(Math.abs(r.sourceCurrent),3)+' A':'Pile absente'}</dd><dt>Intensité calculée dans le filament</dt><dd>${circuit.devices.lampe?fmt(Math.abs(r.lampCurrent),3)+' A':'Lampe absente'}</dd><dt>Puissance calculée de la lampe</dt><dd>${circuit.devices.lampe?fmt(r.lampPower,3)+' W':'Lampe absente'}</dd></dl><p>Une seule pile et une seule lampe ; régime continu établi ; fils et contacts fermés idéaux. Aucun temps de destruction ni température de pile n’est prédit. Une lampe éteinte n’est pas automatiquement défectueuse. Le courant individuel dans les fils redondants n’est pas affiché.</p></div></details>`;
  }
  function bench() {
    const r=C.solve(circuit);
    return `<div class="immersive-lab"><div class="board" id="board" role="group" aria-label="Table de laboratoire en trois dimensions"><div class="stage-loading">Préparation de la paillasse…</div><svg class="wiring" id="wiring" aria-hidden="true"></svg><div id="wire-labels" class="wire-labels"></div>${C.DEVICES.filter(d=>circuit.devices[d]).map(d=>deviceCard(d,r)).join('')}</div><div class="top-tools"><div class="lab-badge"><span aria-hidden="true">◉</span> PAILLASSE 3D</div><div class="small-toolbar">${btn('undo','↶','','aria-label="Annuler le dernier geste" title="Annuler" '+(undo.length?'':'disabled'))}${btn('redo','↷','','aria-label="Rétablir le geste" title="Rétablir" '+(redo.length?'':'disabled'))}${btn('view-current','Schéma')}${btn('drawer','La table','table')}</div></div><div class="floating-observation">${statusMarkup(circuit,r)}</div><div class="interaction-strip" id="interaction-strip" role="status" aria-live="polite"></div><div class="selection-actions" id="selection-actions"></div><div class="bottom-tools"><div class="quiet-tools">${btn('drawer','Ma note','note')}${btn('drawer','Aide','help')}</div>${btn('save-trial','Conserver l’essai','','class="primary save-experiment"')}</div>${selected?`<div class="floating-inspector">${inspector()}</div>`:''}${drawerMarkup()}</div>`;
  }
  function drawerMarkup(){
    if(!drawer)return '';
    const titles={material:'Le matériel',history:'Mes derniers essais',notebook:'Mon carnet',note:'Ma note',help:'Explorer l’expérience',table:'La table',compare:'Comparer mes essais'};
    let content='';
    if(drawer==='material')content=`<p class="drawer-intro">Choisis le matériel à poser sur ta table.</p><div class="material-list">${C.DEVICES.map(d=>`<div class="material-row"><div class="material-illustration">${art(d,circuit,C.solve(circuit))}</div><div><h3>${names[d]}</h3><small>${circuit.devices[d]?'Sur la table':'Disponible'}</small></div>${btn(circuit.devices[d]?'select':'add-device',circuit.devices[d]?'Examiner':'Ajouter',d)}</div>`).join('')}</div><p class="help-label">Pour déplacer un objet, tire son étiquette ou son corps. Les flèches du clavier fonctionnent aussi.</p>`;
    if(drawer==='history')content=`${deletionNotice()}<p class="drawer-intro">Retrouve le montage et les observations de chaque essai.</p><div class="history-list">${trials.length?trials.slice().reverse().map(t=>trialCard(t,true)).join(''):'<div class="empty"><h3>Aucun essai conservé</h3><p>Utilise « Conserver l’essai » sur la table.</p></div>'}</div>${trials.length>1?btn('compare','Comparer deux essais','','class="primary drawer-compare"'):''}`;
    if(drawer==='notebook')content=notebook();
    if(drawer==='compare')content=compare();
    if(drawer==='note')content=`<p class="drawer-intro">Ce que j’observe, ce que je veux vérifier.</p><section class="note"><label for="note">Ma note<textarea id="note" maxlength="2000" placeholder="Quand j’ouvre l’interrupteur…">${esc(note)}</textarea></label></section><p class="help-label">La note sera conservée avec le prochain essai.</p>${btn('save-trial','Conserver avec mon montage','','class="primary"')}`;
    if(drawer==='help')content=`<div class="gesture-help"><p><b>Repères du tableau :</b> U désigne la tension en volts (V), I l’intensité en ampères (A) et P la puissance en watts (W). Pour la lampe, P = U × I. Les valeurs du tableau sont calculées par le modèle.</p><h3>Les gestes de la paillasse</h3><p><b>Brancher :</b> touche une borne puis une autre, ou tire un fil entre elles.</p><p><b>Déplacer :</b> tire le corps ou l’étiquette d’un objet.</p><p><b>Interrupteur :</b> touche son levier pour ouvrir ou fermer le circuit.</p><p><b>Fil :</b> touche son numéro pour le sélectionner, le couper ou le retirer.</p><p><b>Libérer :</b> touche la table vide, ou utilise Échap.</p></div><div class="study-tools">${['Observer','Déduire','Comprendre','Appliquer'].map(p=>btn('panel',p,p,`aria-pressed="${panel===p}"`)).join('')}</div>${panel&&!selected?inspector():''}${connections()}${modelDetails(C.solve(circuit))}`;
    if(drawer==='table')content=`<p class="drawer-intro">Préparer, ranger ou recommencer ton expérience.</p><div class="table-options">${btn('example','Essayer un circuit allumé','closed','class="primary"')}${btn('example','Essayer un interrupteur ouvert','open')}${btn('example','Essayer sans interrupteur','direct')}${btn('arrange','Ranger les objets')}${btn('reset','Recommencer sans fils')}</div><p class="help-label">« Annuler » retrouve le montage précédent. Tes essais conservés restent dans le carnet.</p><a class="classic-link" href="../classique.html?demo=3">Ouvrir la table classique</a>`;
    return `<div class="drawer-scrim" data-dismiss-drawer></div><aside class="lab-drawer ${drawer==='notebook'||drawer==='compare'?'wide-drawer':''}" aria-label="${titles[drawer]}" role="dialog" aria-modal="true"><header><div><p class="eyebrow">H le Labo</p><h2>${titles[drawer]}</h2></div>${btn('close-drawer','×','','class="close-drawer" aria-label="Fermer le tiroir"')}</header><div class="drawer-content">${content}</div></aside>`;
  }
  function snapshot(s, symbol=false) {
    const r=C.solve(s), width=960, height=560, prefix='saved-'+(++snapshotSequence)+'-';
    const present=C.DEVICES.filter(d=>s.devices[d]);
    const position=d=>({x:36+s.positions[d].x*(width-292),y:48+s.positions[d].y*(height-310)});
    const point=t=>{const p=position(C.TERMINALS[t]),a=anchors[t];return {...a,x:p.x+a.x,y:p.y+a.y};};
    const objects=present.map(d=>{
      const p=position(d),drawing=art(d,s,r,symbol).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}${id})`);
      const state=d==='pile'?(s.batteryCharged?'6 V':'Déchargée'):d==='lampe'?(s.filamentIntact?(r.lit?'Allumée':'Éteinte'):'Filament coupé')+(s.mounted?' · vissée':''):d==='interrupteur'?(s.switchClosed?'Fermé':'Ouvert'):(s.mounted?'Lampe vissée':'Vide');
      return `<g transform="translate(${p.x} ${p.y})" data-snapshot-device="${d}">${drawing}<text x="110" y="204" text-anchor="middle" font-size="17" font-weight="600" fill="#293b48">${names[d]}</text><text x="110" y="224" text-anchor="middle" font-size="14" fill="#606d77">${state}</text></g>`;
    }).join('');
    const wires=s.wires.map(w=>{const a=point(w.a),b=point(w.b),path=cablePath(a,b,Number(w.id.slice(1))-1,{width,height}),color=wireColor(w.id);return `<g data-snapshot-wire="${w.id}" data-from="${w.a}" data-to="${w.b}" data-intact="${w.intact}"><title>${wireName(w.id)} : ${esc(labels[w.a])} vers ${esc(labels[w.b])}${w.intact?'':' · coupé'}</title><path d="${path}" fill="none" stroke="#f5f2eb" stroke-width="9"/><path d="${path}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" ${w.intact?'':'stroke-dasharray="9 10"'}/></g>`;}).join('');
    const contacts=present.map(d=>{const p=position(d);return ports[d].map(([t,label])=>{const a=anchors[t];if(d==='pile')label=(t==='pile:p')===(s.polarity===1)?'+':'−';const side=t==='lampe:plot',tx=side?a.x+18:a.x,ty=side?a.y+5:a.y-18;return `<g transform="translate(${p.x} ${p.y})"><circle data-snapshot-terminal="${t}" cx="${a.x}" cy="${a.y}" r="7" fill="${t==='lampe:verre'?'#e5edf1':'#536773'}" stroke="#fff" stroke-width="2" ${t==='lampe:verre'?'stroke-dasharray="2 2"':''}/><text x="${tx}" y="${ty}" text-anchor="${side?'start':'middle'}" font-size="13" font-weight="600" fill="#354856" paint-order="stroke" stroke="#f3f0e8" stroke-width="4" stroke-linejoin="round">${esc(label)}</text></g>`;}).join('');}).join('');
    return `<svg class="saved-montage" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${symbol?'Schéma':'Montage'} enregistré : ${esc(observation(s,r)[0])}, ${s.wires.length} fils. Les traits discontinus représentent les fils coupés."><rect width="960" height="560" rx="12" fill="${symbol?'#fbfcfd':'#eeeae1'}"/>${objects}${wires}${contacts}${present.length?'':'<text x="480" y="280" text-anchor="middle" fill="#606d77" font-size="24">Table vide</text>'}<path d="M16 551H944" stroke="#bfa482" stroke-width="8" stroke-linecap="round"/></svg>`;
  }
  function deletionNotice() {
    return deletedTrial?`<div class="deletion-notice" role="status"><span>${esc(deletedTrial.trial.name)} supprimé.</span>${btn('restore-trial','Annuler la suppression')}</div>`:'';
  }
  function archiveToggle() {
    return `<div class="view-toggle archive-toggle" aria-label="Représentation des essais">${btn('archive-view','Montages','objects',`aria-pressed="${archiveView==='objects'}"`)}${btn('archive-view','Schémas','symbols',`aria-pressed="${archiveView==='symbols'}"`)}</div>`;
  }
  function trialCard(t,compact=false) {
    const s=t.circuit,r=C.solve(s),[status]=observation(s,r);
    const date=Number.isFinite(t.savedAt)&&Math.abs(t.savedAt)<=8640000000000000?new Date(t.savedAt).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    return `<article class="trial ${compact?'trial-compact':''}" data-trial="${t.id}"><div class="trial-heading"><div><h3>${esc(t.name)}</h3>${date?`<time datetime="${new Date(t.savedAt).toISOString()}">${esc(date)}</time>`:''}</div><span class="trial-state" data-state="${r.short?'short':r.status}">${r.short?'Court-circuit':r.lit?'Allumée':s.devices.lampe?'Éteinte':'Sans lampe'}</span></div><button type="button" class="snapshot-button" data-action="preview-trial" data-arg="${t.id}" aria-label="Agrandir le montage de ${esc(t.name)}">${snapshot(s,archiveView==='symbols')}<span class="snapshot-zoom">Agrandir ↗</span></button>${compact?'':`<p class="trial-note">${t.note?esc(t.note):'<span class="muted">Aucune note pour cet essai.</span>'}</p><details class="trial-details"><summary>Contacts et conditions · ${s.wires.length} fil${s.wires.length>1?'s':''}</summary><p>${status}. ${s.devices.pile?(s.batteryCharged?'Pile disponible.':'Pile déchargée.'):''} ${s.devices.lampe&&!s.filamentIntact?'Filament coupé.':''}</p><ul class="trial-wires">${s.wires.map(w=>`<li>${wireName(w.id)} · ${esc(labels[w.a])} ↔ ${esc(labels[w.b])}${w.intact?'':' (coupé)'}</li>`).join('')||'<li>Aucun fil.</li>'}</ul></details>`}<div class="trial-actions">${btn('copy',compact?'Reprendre':'Reprendre une copie',t.id)}${btn('delete-trial','Supprimer',t.id,`class="delete-button" aria-label="Supprimer ${esc(t.name)}"`)}</div></article>`;
  }
  function history() {
    return `<section class="bench-history" aria-labelledby="history-title"><div class="row spread"><h3 id="history-title">Mes essais conservés <span>${trials.length}</span></h3>${btn('notebook','Tout voir','','class="plain"')}</div><p class="help-label">Du plus récent au plus ancien.</p>${deletionNotice()}<div class="history-list">${trials.length?trials.slice(-3).reverse().map(t=>trialCard(t,true)).join(''):'<div class="history-empty"><span aria-hidden="true">▧</span><p>Ton premier montage apparaîtra ici.</p><small>Conserve un essai pour le retrouver et le comparer.</small></div>'}</div></section>`;
  }
  function notebook() {
    return `<div class="heading"><div><p class="eyebrow">Mes traces d’exploration · E02-A1</p><h1>Mon carnet</h1><p class="subtitle">${trials.length} essai${trials.length>1?'s':''} conservé${trials.length>1?'s':''} · Agrandis un montage pour retrouver ses branchements et ta note.</p></div><div class="row">${btn('bench','Revenir à ma table')}${trials.length>1?btn('compare','Comparer deux essais','','class="primary"'):''}</div></div>${deletionNotice()}${trials.length?`<div class="notebook-toolbar"><span class="help-label">Les essais les plus récents en premier</span>${archiveToggle()}</div><div class="trials">${trials.slice().reverse().map(t=>trialCard(t)).join('')}</div>`:'<div class="empty"><h3>Ton carnet est encore vide</h3><p>Depuis la table, conserve un essai avec une note si tu le souhaites.</p>'+btn('bench','Ouvrir ma table','','class="primary"')+'</div>'}`;
  }
  function showPreview(id) {
    const t=id==='current'?{id,name:'Montage en cours',circuit:clone(circuit),note}:trials.find(t=>t.id===id);if(!t)return;
    const dialog=document.getElementById('trial-preview');
    if(!dialog.open){previewReturn=document.activeElement;previewTrial=id;}
    dialog.innerHTML=`<div class="preview-heading"><div><p class="eyebrow">Montage conservé · E02-A1</p><h2 id="preview-title">${esc(t.name)}</h2></div>${btn('close-preview','Fermer','', 'autofocus')}</div><div class="row spread preview-tools"><strong>${esc(observation(t.circuit,C.solve(t.circuit))[0])}</strong>${archiveToggle()}</div>${snapshot(t.circuit,archiveView==='symbols')}<p class="help-label">Branchements enregistrés · Les fils coupés sont dessinés en pointillés.</p><div class="preview-note"><h3>Ma note</h3><p>${t.note?esc(t.note):'Aucune note ajoutée.'}</p></div><div class="row">${t.id==='current'?btn('close-preview','Revenir à la table','','class="primary"'):btn('copy','Reprendre une copie',t.id,'class="primary"')}</div>`;
    if(!dialog.open)dialog.showModal();
  }
  function closePreview() { document.getElementById('trial-preview').close(); }
  function differences(a,b) {
    const x=a.circuit,y=b.circuit,items=[];
    for (const d of C.DEVICES) if(x.devices[d]!==y.devices[d])items.push('présence de '+names[d].toLowerCase());
    if(x.switchClosed!==y.switchClosed)items.push('position de l’interrupteur');
    if(x.filamentIntact!==y.filamentIntact)items.push('état du filament');
    if(x.batteryCharged!==y.batteryCharged)items.push('état de la pile');
    if(x.polarity!==y.polarity)items.push('polarité de la pile');
    if(x.mounted!==y.mounted)items.push('lampe vissée dans la douille');
    const connections=s=>JSON.stringify(s.wires.map(w=>[...[w.a,w.b].sort(),w.intact]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    if(connections(x)!==connections(y))items.push('connexions ou état des fils');
    if(JSON.stringify(x.positions)!==JSON.stringify(y.positions))items.push('position des objets');
    return items;
  }
  function compare() {
    if(trials.length<2)return `<div class="heading"><div><p class="eyebrow">Observer ce qui change</p><h1>Comparer mes essais</h1></div>${btn('bench','Revenir à ma table')}</div>${deletionNotice()}<div class="empty"><h3>${trials.length?'Un premier essai est conservé':'Aucun essai conservé'}</h3><p>Conserve deux essais depuis la table pour comparer les montages et tes observations.</p>${btn('bench','Ouvrir ma table','','class="primary"')}</div>`;
    const a=trials.find(t=>t.id===compareA)||trials[0],b=trials.find(t=>t.id===compareB)||trials[trials.length-1];
    const column=(t,side)=>`<section><label for="compare-${side}">Essai ${side}<select id="compare-${side}" data-compare="${side}">${trials.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${trialCard(t)}</section>`;
    const diff=differences(a,b);
    return `<div class="heading"><div><p class="eyebrow">Observer ce qui change</p><h1>Comparer mes essais</h1></div>${btn('bench','Revenir à ma table')}</div>${deletionNotice()}${archiveToggle()}<div class="compare">${column(a,'A')}${column(b,'B')}</div><p class="compare-hint">${a.id===b.id?'Tu as choisi le même essai des deux côtés.':diff.length?'Ce qui a changé : '+esc(diff.join(', '))+'.':'Les conditions électriques et les positions sont identiques. Tu peux comparer les notes.'}</p>`;
  }
  function render() {
    const focused=document.activeElement;
    const focusKey=focused?.dataset?.action?{action:focused.dataset.action,arg:focused.dataset.arg}:null;
    const focusTerminal=focused?.dataset?.terminal,focusId=focused?.id;
    observer?.disconnect();
    if(scene3d)scene3d.canvas.remove();
    main.innerHTML=({home,catalogue,bench,notebook,compare})[screen]();
    document.querySelectorAll('nav button').forEach(b=>{const current=(b.dataset.action==='catalogue'&&(screen==='catalogue'||screen==='bench'&&!free))||(b.dataset.action==='free'&&screen==='bench'&&free)||(b.dataset.action==='notebook'&&(screen==='notebook'||screen==='compare'));if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    document.getElementById('trial-count').textContent=trials.length?'('+trials.length+')':'';
    if(screen==='bench'){
      const board=document.getElementById('board');observer=new ResizeObserver(()=>layoutBoard());observer.observe(board);layoutBoard();
      const to=document.getElementById('to');if(to?.options.length>1)to.selectedIndex=1;
      document.getElementById('connections')?.addEventListener('toggle',e=>{connectionsOpen=e.target.open;});
      document.getElementById('model')?.addEventListener('toggle',e=>{modelOpen=e.target.open;});
    }
    document.querySelectorAll('.immersive-lab>div:not(.lab-drawer):not(.drawer-scrim),.immersive-lab>.floating-inspector').forEach(el=>{el.inert=!!drawer;});
    if(focusKey){const el=[...document.querySelectorAll('button[data-action]')].find(b=>b.dataset.action===focusKey.action&&b.dataset.arg===focusKey.arg);el?.focus({preventScroll:true});}
    else if(focusTerminal)document.querySelector(`[data-terminal="${focusTerminal}"]`)?.focus({preventScroll:true});
    else if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  }
  function layoutBoard() {
    const board=document.getElementById('board');if(!board)return;
    try{if(!scene3d)scene3d=new window.Hidaya3D();scene3d.mount(board);}
    catch(e){board.innerHTML=`<div class="webgl-fallback"><h2>La vue 3D ne peut pas démarrer ici.</h2><p>Tu peux continuer l’expérience avec la table classique.</p><a href="../classique.html?demo=3">Ouvrir la table classique</a></div>`;board.dataset.renderer='unavailable';console.warn('3D indisponible',e);return;}
    board.dataset.renderer='webgl';board.querySelector('.stage-loading')?.remove();
    syncInteraction();drawWires();
  }
  function drawWires() {
    const board=document.getElementById('board');if(!board||!scene3d)return;
    scene3d.setState(circuit,{selected,selectedWire,pending,previewPoint});
    for(const [t]of Object.entries(C.TERMINALS)){
      const el=board.querySelector(`[data-terminal="${t}"]`);if(!el)continue;
      const p=scene3d.terminal(t);el.style.left=p.x+'px';el.style.top=p.y+'px';
    }
    for(const id of C.DEVICES){const el=board.querySelector(`[data-device="${id}"]`);if(!el)continue;const p=scene3d.label(id);const handle=el.querySelector('.device-handle');handle.style.left=p.x+'px';handle.style.top=p.y+'px';const state=el.querySelector('.device-state');state.style.left=p.x+'px';state.style.top=(p.y+29)+'px';if(id==='interrupteur'){const q=scene3d.leverPoint(),lever=el.querySelector('.switch-lever');lever.style.left=q.x+'px';lever.style.top=q.y+'px';}}
    const chips=document.getElementById('wire-labels'),rect=board.getBoundingClientRect(),occupied=[...board.querySelectorAll('.terminal,.terminal-label,.device-handle,.device-state')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{x:r.x-rect.x,y:r.y-rect.y,w:r.width,h:r.height};});
    chips.innerHTML=circuit.wires.map(w=>{const candidates=[.30+(Number(w.id.slice(1))%3)*.19,.22,.35,.48,.62,.77,.87].map(t=>scene3d.wirePoint(w.id,t));const score=p=>occupied.reduce((v,r)=>v+((p.x+22>r.x&&p.x-22<r.x+r.w&&p.y+21>r.y&&p.y-21<r.y+r.h)?1000:0),0)+(p.x<22||p.x>board.clientWidth-22||p.y>board.clientHeight-120?2000:0);const p=candidates.sort((a,b)=>score(a)-score(b))[0];occupied.push({x:p.x-22,y:p.y-21,w:44,h:42});return `<button type="button" class="wire-chip ${w.id===selectedWire?'active':''}" data-action="select-wire" data-arg="${w.id}" style="left:${p.x}px;top:${p.y}px;--cable:${wireColor(w.id)}" aria-label="Fil ${wireName(w.id)} : ${esc(labels[w.a])} vers ${esc(labels[w.b])}" aria-pressed="${w.id===selectedWire}">${wireName(w.id)}</button>`;}).join('');
  }
  function pinPosition(t) {
    const board=document.getElementById('board'),dot=board?.querySelector(`[data-terminal="${t}"] .terminal-dot`);if(!dot)return null;
    const a=dot.getBoundingClientRect(),b=board.getBoundingClientRect();return {x:a.left+a.width/2-b.left-board.clientLeft,y:a.top+a.height/2-b.top-board.clientTop,...anchors[t]&&{nx:anchors[t].nx,ny:anchors[t].ny}};
  }
  function cablePath(a,b,index=0,size=null) {
    const board=document.getElementById('board'),pad=12,width=size?.width??board.clientWidth,height=size?.height??board.clientHeight;
    const clamp=(n,max)=>Math.max(pad,Math.min(max-pad,n));
    const distance=Math.hypot(a.x-b.x,a.y-b.y),lead=Math.min(90,Math.max(45,distance*.24))+(index%3)*8;
    const ax=clamp(a.x+a.nx*lead,width),ay=clamp(a.y+a.ny*lead,height);
    const bx=clamp(b.x+(b.nx||0)*lead,width),by=clamp(b.y+(b.ny||0)*lead,height);
    return `M${a.x} ${a.y} C${ax} ${ay},${bx} ${by},${b.x} ${b.y}`;
  }
  function wireName(id){return 'F'+id.slice(1);}
  function wireColor(id){return ['#b84738','#35434f','#386daa','#986f29'][(Number(id.slice(1))-1)%4];}
  function syncInteraction(message='') {
    const board=document.getElementById('board'),strip=document.getElementById('interaction-strip'),actions=document.getElementById('selection-actions');if(!board)return;
    const wire=circuit.wires.find(w=>w.id===selectedWire);
    board.dataset.interaction=pending?'connecting':wire?'wire-selected':selected?'object-selected':'idle';
    for(const b of board.querySelectorAll('[data-terminal]')){
      const t=b.dataset.terminal,isStart=pending===t,isEnd=wire&&(wire.a===t||wire.b===t),hover=previewPoint?.target===t;
      b.classList.toggle('pending',isStart);b.classList.toggle('wire-selected',!!isEnd);b.classList.toggle('target',!!hover);b.classList.toggle('connected',circuit.wires.some(w=>w.a===t||w.b===t));
      b.setAttribute('aria-pressed',String(isStart));b.querySelector('.terminal-flag').textContent=isStart?'Départ':isEnd?wireName(wire.id):hover?'Arrivée':'';
    }
    for(const el of board.querySelectorAll('[data-device]')){
      const on=el.dataset.device===selected;el.classList.toggle('selected',on);el.querySelectorAll('[data-action="select"]').forEach(b=>b.setAttribute('aria-pressed',String(on)));
      el.querySelector('.selection-label').textContent=on?'Sélectionné · cliquer pour libérer':'Déplacer ou examiner';
    }
    const active=pending||wire||selected;
    const title=message||(pending?`Départ : ${labels[pending]}. Choisis la borne d’arrivée.`:wire?`Fil ${wireName(wire.id)} sélectionné · ${labels[wire.a]} ↔ ${labels[wire.b]}`:selected?`${names[selected]} sélectionné. Ses actions sont affichées à droite.`:'Pour ajouter un fil, touche une borne puis une autre.');
    strip.dataset.active=active?'true':'false';const stripHTML=`<span class="interaction-mark" aria-hidden="true">${pending?'1 → 2':wire?wireName(wire.id):selected?'✓':'↗'}</span><span>${esc(title)}</span>${active?btn('clear-selection',pending?'Annuler le fil':'Désélectionner','','class="clear-selection"'):''}`;if(strip.innerHTML!==stripHTML)strip.innerHTML=stripHTML;
    actions.innerHTML=wire?`<span><strong>${wireName(wire.id)}</strong> · ${wire.intact?'Fil intact':'Fil coupé'}</span><div class="row">${btn('wire-toggle',wire.intact?'Couper ce fil':'Rétablir ce fil',wire.id)}${btn('wire-remove','Retirer ce fil',wire.id)}${btn('clear-selection','Désélectionner')}</div>`:'';
    actions.hidden=!wire;
  }
  function clearSelection(message='Sélection effacée.') {
    pending=null;selected=null;selectedWire=null;previewPoint=null;wireDrag=null;drag=null;render();announce(message);
  }
  function go(next) { pending=null;selected=null;selectedWire=null;previewPoint=null;screen=next;if(next==='bench')hasDraft=true;persist();render();announce(''); }
  function attemptConnection(a,b) {
    const next=clone(circuit),error=C.connect(next,a,b);
    if(error){syncInteraction(error);announce(error);return;}
    const id=next.wires[next.wires.length-1].id;
    mutate(()=>{circuit=next;selected=null;selectedWire=id;previewPoint=null;},`${wireName(id)} relié : ${labels[a]} ↔ ${labels[b]}.`);
  }
  document.addEventListener('click',e=>{
    if(performance.now()<suppressClickUntil)return;
    const terminal=e.target.closest('button[data-terminal]');
    if(terminal){
      const t=terminal.dataset.terminal;
      if(pending===t){clearSelection('Départ annulé.');return;}
      if(pending){attemptConnection(pending,t);return;}
      pending=t;selected=null;selectedWire=null;previewPoint=null;render();announce('Départ choisi. Touche une seconde borne pour terminer le fil.');document.querySelector(`[data-terminal="${t}"]`)?.focus({preventScroll:true});return;
    }
    const path=e.target.closest('[data-select-wire]');
    if(path){const id=path.dataset.selectWire;selectedWire=selectedWire===id?null:id;selected=null;pending=null;previewPoint=null;render();return;}
    const b=e.target.closest('button[data-action]');
    if(!b){if(e.target.closest('[data-dismiss-drawer]')){drawer=null;render();return;}if(e.target.closest('canvas.lab-canvas')&&scene3d){const rect=e.target.getBoundingClientRect(),hit=scene3d.pick(e.clientX-rect.left,e.clientY-rect.top);if(hit?.type==='switch'){mutate(()=>{circuit.switchClosed=!circuit.switchClosed;},'Interrupteur actionné.');return;}if(hit?.type==='device'){selected=selected===hit.id?null:hit.id;selectedWire=null;pending=null;render();return;}if(hit?.type==='wire'){selectedWire=selectedWire===hit.id?null:hit.id;selected=null;pending=null;render();return;}}if(e.target.closest('#board')&&!e.target.closest('.device'))clearSelection();return;}
    const {action,arg}=b.dataset;
    if(action==='drawer'){drawer=drawer===arg?null:arg;selected=null;selectedWire=null;pending=null;render();main.querySelector('.lab-drawer button')?.focus({preventScroll:true});return;}
    if(action==='close-drawer'){drawer=null;render();document.querySelector('nav [data-action=drawer]')?.focus();return;}
    if(action==='view-current'){showPreview('current');return;}
    if(action==='notebook'||action==='compare'){drawer=action;render();main.querySelector('.lab-drawer button')?.focus({preventScroll:true});return;}
    if(action==='preview-trial'){showPreview(arg);return;}
    if(action==='close-preview'){closePreview();return;}
    if(action==='archive-view'){
      archiveView=arg==='symbols'?'symbols':'objects';
      if(previewTrial){showPreview(previewTrial);document.querySelector(`#trial-preview [data-action="archive-view"][data-arg="${archiveView}"]`)?.focus();}
      else render();
      return;
    }
    if(action==='delete-trial'){
      const index=trials.findIndex(t=>t.id===arg);if(index<0)return;
      deletedTrial={trial:clone(trials[index]),index};trials.splice(index,1);
      if(compareA===arg)compareA=null;if(compareB===arg)compareB=null;
      persist();render();main.querySelector('[data-action="restore-trial"]')?.focus({preventScroll:true});
      announce(deletedTrial.trial.name+' supprimé. Tu peux annuler cette suppression.');return;
    }
    if(action==='restore-trial'){
      if(!deletedTrial)return;
      if(trials.length>=120){announce('Le carnet est plein : cet essai ne peut pas être restauré pour le moment.');return;}
      const saved=deletedTrial, name=saved.trial.name;
      trials.splice(Math.min(saved.index,trials.length),0,clone(saved.trial));deletedTrial=null;
      persist();render();main.querySelector(`[data-action="preview-trial"][data-arg="${saved.trial.id}"]`)?.focus({preventScroll:true});announce(name+' restauré avec son montage et sa note.');return;
    }
    if(action==='clear-selection'||action==='cancel-wire'){clearSelection();return;}
    if(action==='select-wire'){selectedWire=selectedWire===arg?null:arg;selected=null;pending=null;previewPoint=null;render();return;}
    if(action==='note-toggle'){drawer='note';render();document.getElementById('note')?.focus();return;}
    if(['home','catalogue','bench'].includes(action)){drawer=null;go('bench');return;}
    if(action==='free'){free=true;panel=null;go('bench');return;}
    if(action==='mode'){free=arg==='free';selected=null;panel=null;persist();render();return;}
    if(action==='view'){view=arg;persist();render();announce('La représentation change ; les connexions restent identiques.');return;}
    if(action==='select'){drawer=null;selected=selected===arg?null:arg;selectedWire=null;pending=null;previewPoint=null;panel=null;render();return;}
    if(action==='panel'){panel=panel===arg?null:arg;selected=null;selectedWire=null;pending=null;previewPoint=null;render();return;}
    if(action==='close-panel'){panel=null;clearSelection();return;}
    if(action==='cancel-wire'){pending=null;render();return;}
    if(action==='switch'){mutate(()=>{circuit.switchClosed=!circuit.switchClosed;},circuit.switchClosed?'Interrupteur ouvert.':'Interrupteur fermé.');return;}
    if(action==='polarity'){mutate(()=>{circuit.polarity*=-1;},'Polarité de la pile inversée.');return;}
    if(action==='charge'){mutate(()=>{circuit.batteryCharged=!circuit.batteryCharged;},'État de la pile modifié pour cet essai.');return;}
    if(action==='filament'){mutate(()=>{circuit.filamentIntact=!circuit.filamentIntact;},'État de la lampe modifié pour cet essai.');return;}
    if(action==='mount'){mutate(()=>{circuit.mounted=!circuit.mounted;},circuit.mounted?'Lampe dévissée de la douille.':'Lampe vissée : les deux contacts de la douille rejoignent ceux de la lampe.');return;}
    if(action==='add-device'){drawer=null;mutate(()=>{circuit.devices[arg]=true;selected=arg;},names[arg]+' ajouté à la table.');return;}
    if(action==='remove-device'){mutate(()=>{C.removeDevice(circuit,arg);selected=null;},names[arg]+' retiré avec ses fils. « Annuler » restaure le montage.');return;}
    if(action==='wire-remove'){mutate(()=>{circuit.wires=circuit.wires.filter(w=>w.id!==arg);},'Fil retiré.');return;}
    if(action==='wire-toggle'){mutate(()=>{const w=circuit.wires.find(w=>w.id===arg);if(w)w.intact=!w.intact;},'État du fil modifié.');return;}
    if(action==='reset'){drawer=null;mutate(()=>{circuit=C.initial();circuit.positions=clone(positions3d);selected=null;},'Table remise à son état de départ. La note et le carnet sont conservés.');return;}
    if(action==='example'){drawer=null;mutate(()=>{circuit=C.example(arg);circuit.positions=clone(positions3d);selected=null;},'Montage préparé chargé. Tu peux le modifier librement ou annuler.');return;}
    if(action==='arrange'){drawer=null;mutate(()=>{circuit.positions=clone(positions3d);},'Objets rangés sur la table. Les branchements sont conservés.');return;}
    if(action==='undo'||action==='redo'){
      const from=action==='undo'?undo:redo,to=action==='undo'?redo:undo;if(!from.length)return;
      const saved=from.pop(),inverse=beforeChange();inverse.restoreNote=!!saved.restoreNote;to.push(inverse);circuit=clone(saved.circuit);if(saved.restoreNote)note=saved.note;pending=null;selected=null;selectedWire=null;previewPoint=null;persist();render();announce(action==='undo'?'Modification annulée.':'Modification rétablie.');return;
    }
    if(action==='save-trial'){
      if(trials.length>=120){announce('Ce carnet contient déjà 120 essais. Supprime un essai du carnet pour faire de la place.');return;}
      counter++;const t={id:'t'+counter,name:'Essai '+counter,model:C.VERSION,circuit:clone(circuit),note,savedAt:Date.now()};trials.push(t);compareA=trials.length>1?trials[trials.length-2].id:t.id;compareB=t.id;persist();render();announce(t.name+' conservé avec son montage et sa note.');return;
    }
    if(action==='copy'){
      const t=trials.find(t=>t.id===arg);if(!t)return;
      if(previewTrial)closePreview();
      screen='bench';drawer=null;selected=null;selectedWire=null;noteOpen=true;mutate(()=>{circuit=clone(t.circuit);note=t.note;},'Copie de '+t.name+' ouverte. L’original reste conservé dans le carnet.');return;
    }
  });
  main.addEventListener('input',e=>{if(e.target.id==='note'){note=e.target.value;saveStatus('Enregistrement…');clearTimeout(saveTimer);saveTimer=setTimeout(persist,200);}});
  main.addEventListener('change',e=>{if(e.target.dataset.compare){if(e.target.dataset.compare==='A')compareA=e.target.value;else compareB=e.target.value;render();document.getElementById('compare-'+e.target.dataset.compare)?.focus({preventScroll:true});}});
  main.addEventListener('submit',e=>{if(e.target.id==='connection-form'){e.preventDefault();attemptConnection(document.getElementById('from').value,document.getElementById('to').value);}});
  main.addEventListener('keydown',e=>{
    const handle=e.target.closest('.device-grab');if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const id=handle.dataset.arg;
    mutate(()=>{const p=circuit.positions[id],delta=e.shiftKey?.15:.04;if(e.key==='ArrowLeft')p.x=Math.max(0,p.x-delta);if(e.key==='ArrowRight')p.x=Math.min(1,p.x+delta);if(e.key==='ArrowUp')p.y=Math.max(0,p.y-delta);if(e.key==='ArrowDown')p.y=Math.min(1,p.y+delta);selected=id;selectedWire=null;},'Objet déplacé ; connexions conservées.');
  });
  function suppressNativeClick(){suppressClickUntil=performance.now()+400;setTimeout(()=>{suppressClickUntil=0;},0);}
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&drawer&&!previewTrial){e.preventDefault();drawer=null;render();return;}
    if(e.key==='Escape'&&!previewTrial&&screen==='bench'&&(pending||selected||selectedWire||drag||wireDrag)){e.preventDefault();if(drag?.moved)circuit=drag.before.circuit;if(drag||wireDrag)suppressNativeClick();clearSelection('Sélection annulée.');}
    if(e.key==='Tab'&&drawer&&!previewTrial){const els=[...document.querySelectorAll('.lab-drawer button,.lab-drawer a,.lab-drawer textarea,.lab-drawer select,.lab-drawer summary')].filter(el=>!el.disabled&&el.getClientRects().length);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  main.addEventListener('pointerdown',e=>{
    if(e.button!==0||drawer||!scene3d)return;
    const terminal=e.target.closest('[data-terminal]'),board=document.getElementById('board');if(!board||!e.target.closest('#board'))return;
    if(terminal){wireDrag={start:pending||terminal.dataset.terminal,pressed:terminal.dataset.terminal,handle:terminal,pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false};terminal.setPointerCapture(e.pointerId);return;}
    const handle=e.target.closest('.device-grab'),rect=board.getBoundingClientRect();const hit=e.target.closest('canvas')?scene3d.pick(e.clientX-rect.left,e.clientY-rect.top):null;
    const id=handle?.dataset.arg||(hit?.type==='device'?hit.id:null);if(!id)return;
    const start=scene3d.onTable(e.clientX-rect.left,e.clientY-rect.top);if(!start)return;
    const capture=handle||e.target;drag={id,handle:capture,board,pointer:e.pointerId,x:e.clientX,y:e.clientY,start,before:beforeChange(),world:scene3d.worldFor(circuit.positions[id]),moved:false};capture.setPointerCapture(e.pointerId);
  });
  function previewAt(e){
    const board=document.getElementById('board');if(!board||!pending)return;const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-terminal]'),t=hit?.dataset.terminal,rect=board.getBoundingClientRect();previewPoint={x:Math.max(0,Math.min(board.clientWidth,e.clientX-rect.left)),y:Math.max(0,Math.min(board.clientHeight,e.clientY-rect.top)),target:t&&t!==pending?t:null};syncInteraction();drawWires();
  }
  main.addEventListener('pointermove',e=>{
    if(wireDrag&&wireDrag.pointer===e.pointerId){if(Math.hypot(e.clientX-wireDrag.x,e.clientY-wireDrag.y)<6&&!wireDrag.moved)return;wireDrag.moved=true;pending=wireDrag.start;selected=null;selectedWire=null;previewAt(e);return;}
    if(drag&&drag.pointer===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<5&&!drag.moved)return;drag.moved=true;selected=drag.id;selectedWire=null;pending=null;previewPoint=null;const rect=drag.board.getBoundingClientRect(),point=scene3d.onTable(e.clientX-rect.left,e.clientY-rect.top);if(point){const next=drag.world.clone().add(point.sub(drag.start));circuit.positions[drag.id]=scene3d.positionFor(next);syncInteraction();drawWires();}return;}
    if(pending&&e.target.closest('#board'))previewAt(e);
  });
  function endPointer(e,cancelled=false){
    if(wireDrag&&wireDrag.pointer===e.pointerId){const d=wireDrag;wireDrag=null;if(cancelled){suppressNativeClick();clearSelection('Liaison annulée.');return;}if(!d.moved)return;suppressNativeClick();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-terminal]')?.dataset.terminal;if(target&&target!==d.start)attemptConnection(d.start,target);else clearSelection('Fil annulé : aucune seconde borne choisie.');return;}
    if(!drag||drag.pointer!==e.pointerId)return;const d=drag;drag=null;if(cancelled){circuit=d.before.circuit;render();return;}if(d.moved){undo.push(d.before);if(undo.length>50)undo.shift();redo=[];hasDraft=true;persist();suppressNativeClick();render();announce('Objet déplacé ; connexions conservées.');}
  }
  main.addEventListener('pointerup',e=>endPointer(e));main.addEventListener('pointercancel',e=>endPointer(e,true));
  main.addEventListener('lab-context-lost',()=>announce('La vue 3D a été interrompue. Recharge la page pour la relancer ; tes essais sont conservés.'));
  window.addEventListener('pagehide',()=>{if(saveTimer)persist();});
  // La fermeture d'un autre onglet ne doit pas écraser silencieusement cet essai.
  window.addEventListener('storage',e=>{if(e.key===STORE){blockedStorage=true;saveStatus('Session seulement · carnet modifié dans un autre onglet');announce('Le carnet a changé dans un autre onglet. Recharge la page pour reprendre cette version ; la table actuelle reste disponible ici.');}});
  document.getElementById('trial-preview').addEventListener('close',()=>{previewTrial=null;const target=previewReturn;render();if(target?.dataset?.arg)main.querySelector(`[data-action="preview-trial"][data-arg="${target.dataset.arg}"]`)?.focus({preventScroll:true});previewReturn=null;});
  window.lab3dDiagnostics=()=>scene3d?{...scene3d.stats(),pins:Object.fromEntries(Object.keys(C.TERMINALS).filter(t=>circuit.devices[C.TERMINALS[t]]).map(t=>[t,scene3d.terminal(t)])),circuit:clone(circuit)}:null;
  readSaved();if(new URL(location.href).searchParams.get('carnet')==='1')drawer='notebook';render();if(loadWarning)announce(loadWarning);
})();
