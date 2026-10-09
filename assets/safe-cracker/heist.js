(() => {
  'use strict';
  const {heads,colors,palettes,wireGeometry} = window.SafeCrackerHeistCatalog;
  const shapes = Object.keys(heads), names = shapes.map(type=>heads[type][0]);
  const slots = [[15,20],[50,18],[85,20],[15,50],[85,50],[15,80],[50,82],[85,80]];
  const icon = type => `<svg viewBox="0 0 28 28" aria-hidden="true"><path fill-rule="evenodd" d="${(heads[type] || heads.slot)[1]}"/></svg>`;
  let colorMode = 'off';
  try { const saved=localStorage.getItem('safecracker-color-assist-v1'); if(palettes[saved])colorMode=saved; } catch {}
  const wireColor = color => palettes[colorMode].values[Object.keys(colors).indexOf(color)] || colors[color];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let game = null, api = null, selected = '', drag = null, lastEffect = '', transition = null;
  const queue = window.SafeCrackerHeistInput.createQueue({
    isActive: id => root()?.dataset.scGameId === id && !root()?.closest('[hidden], [aria-hidden="true"]'),
    submit: (item, id) => {
      if (!root()?.isConnected || game?.gameId !== id) throw new Error('That game is no longer open.');
      return window.__safeCrackerBridge.submit({choice:'safecracker:'+item.command,actionId:item.actionId});
    },
    onChange: g => { patch(); api?.accept(g); },
    onError: error => message(error?.message || 'Could not use that tool. Try again.')
  });
  const heist = () => queue.view();
  const root = () => document.querySelector('[data-sc-heist]');
  const canUse = () => game?.status === 'playing' && !heist()?.failed && queue.length < 32;
  const phaseName = p => ['Panel', 'Wires', 'Dial'][p] || 'Panel';
  function progress(p, stage) {
    if (!p) return 'Not started';
    return `${phaseName(p.phase)} · ${p.phase === 0 ? `${p.removed}/8` : p.phase === 1 ? `${p.cutCount}/${p.wireCount || 10}` : `${stage || 0}/3`}`;
  }
  function tracker(g) {
    const state = g.safecrackerState || {}, mine = g === game ? heist() : state.me?.heist, other = state.opponent?.heist;
    return `<div class="sh-journey" aria-label="Break-in progress">${['Access panel','Wiring','Vault dial'].map((label,i) => `<span class="${i === (mine?.phase || 0) ? 'active' : i < (mine?.phase || 0) ? 'done' : ''}"><i>${i+1}</i>${label}</span>`).join('')}</div><div class="sh-rival"><span>YOU <b>${progress(mine,state.me?.stage)}</b></span><span>RIVAL <b>${progress(other,state.opponent?.stage)}</b></span></div>`;
  }
  const kit = () => heist()?.kit || shapes.slice(0,6);
  function colorSamples() {
    return Object.keys(colors).slice(0,10).map(color=>`<span><i style="background:${colors[color]}" aria-label="Original ${color}"></i><i style="background:${wireColor(color)}" aria-label="Adjusted ${color}"></i><b>${color}</b></span>`).join('');
  }
  function colorMenu() {
    return `<details class="sh-color-menu"><summary aria-label="Color blind options">◉ <span>Color assist</span></summary><div class="sh-color-panel"><label>Color vision preset<select data-sh-palette aria-label="Wire color vision mode">${Object.entries(palettes).map(([key,p])=>`<option value="${key}" ${key===colorMode?'selected':''}>${p.label}</option>`).join('')}</select></label><p>Choose the easiest colors to tell apart. Wire names and the cutting order stay the same.</p><small>ORIGINAL → ADJUSTED</small><div class="sh-color-samples" data-sh-samples>${colorSamples()}</div></div></details>`;
  }
  function applyPalette() {
    const samples=root()?.querySelector('[data-sh-samples]');
    if(samples?.dataset.mode === colorMode)return;
    root()?.querySelectorAll('[data-sh-wire]').forEach(node=>node.style.setProperty('--wire',wireColor(node.dataset.shWire)));
    if(samples){samples.innerHTML=colorSamples();samples.dataset.mode=colorMode;}
    const menu=root()?.querySelector('.sh-color-menu');if(menu)menu.dataset.enabled=String(colorMode!=='off');
  }
  function toolBag() {
    return `<aside class="sh-bag" data-sh-kit="${kit().join(',')}" aria-label="Tool roll"><span class="sh-kit-strap sh-strap-left" aria-hidden="true"></span><span class="sh-kit-strap sh-strap-right" aria-hidden="true"></span><div class="sh-bag-label"><b>VAULT SERVICE KIT</b><span class="sh-drag-hint">Drag tools to use</span>${colorMenu()}</div><div class="sh-tools">${kit().map(type => `<button type="button" class="sh-tool sh-driver" data-sh-tool="${type}" aria-label="${heads[type][0]} screwdriver" draggable="false"><span class="sh-shaft"></span><span class="sh-handle">${icon(type)}</span><small>${heads[type][0]}</small></button>`).join('')}<button type="button" class="sh-tool sh-cutters" data-sh-tool="cutters" aria-label="Wire cutters" draggable="false"><svg viewBox="0 0 60 80" aria-hidden="true"><path class="sh-jaws" d="M15 4l14 15-5 14-8-9z M45 4L31 19l5 14 8-9z"/><path class="sh-bevel" d="M16 5l13 15-5 7 M44 5L31 20l5 7"/><path class="sh-grip-core" d="M26 28C25 42 12 48 14 69 M34 28C35 42 48 48 46 69"/><path class="sh-grips" d="M21 43C16 52 13 58 14 69 M39 43C44 52 47 58 46 69"/><path class="sh-grip-light" d="M19 45Q12 60 14 67 M40 45Q47 60 46 67"/><circle class="sh-pivot" cx="30" cy="29" r="7"/><path class="sh-pivot-slot" d="M27 32l6-6"/></svg><small>Wire cutters</small></button><button type="button" class="sh-tool sh-note" data-sh-card aria-label="Wire Cutting Instructions"><span class="sh-paper"><b>WIRE GUIDE</b><i style="--strip:#e66b62"></i><i style="--strip:#75b3d3"></i><i style="--strip:#d5b95d"></i><i style="--strip:#78ad89"></i></span><small>Wire Cutting<br>Instructions</small></button></div></aside>`;
  }
  function screws(h) {
    const list = h?.screws || shapes.slice(0,6).concat(['slot','star']).map(type => ({type}));
    return `<div class="sh-backplate"><div class="sh-panel" data-sh-panel><div class="sh-plate-mark"><small>AUTHORIZED ACCESS ONLY</small><b>SECURITY BACKPLATE</b><span>08 FASTENERS · SERIES IV</span></div><div class="sh-vent"></div></div>${list.map((s,i)=> `<button type="button" class="sh-screw" data-sh-screw="${i}" style="--x:${slots[i][0]}%;--y:${slots[i][1]}%" aria-label="Screw ${i+1}, ${names[shapes.indexOf(s.type)]}"><span class="sh-thread"></span><span class="sh-screw-head">${icon(s.type)}</span></button>`).join('')}</div>`;
  }
  const wireColors = () => heist()?.wireLayout?.order || heist()?.wireColors || Object.keys(colors).slice(0,10);
  const wireRoute = index => wireGeometry(heist()?.wireLayout,index,wireColors().length);
  const wireY = index => wireRoute(index).y;
  function wires() {
    return `<div class="sh-wiring"><img src="/assets/safe-cracker/images/safe-interior-v1.png" alt="Exposed metal safe mechanism" draggable="false"><svg class="sh-wire-board" viewBox="0 0 600 320" preserveAspectRatio="none" aria-label="${wireColors().length} live wires">${wireColors().map((color,i) => {
      const r=wireRoute(i);
      return `<g data-sh-wire="${color}" aria-label="${color} wire" style="--wire:${wireColor(color)}"><title>${color} wire</title><path class="sh-wire-shadow" d="${r.before} ${r.after}"/><path class="sh-cable sh-left" d="${r.before}"/><path class="sh-cable sh-right" d="${r.after}"/><path class="sh-wire-bridge" d="M288 ${r.y}h24"/><path class="sh-wire-gloss" d="${r.before} ${r.after}"/><path class="sh-wire-hit" d="${r.before} L310 ${r.y} ${r.after}"/><circle cx="32" cy="${r.left}" r="6"/><circle cx="568" cy="${r.right}" r="6"/><text class="sh-wire-label" x="268" y="${r.y-7}">${color.toUpperCase()}</text></g>`;
    }).join('')}</svg></div>`;
  }
  function note(h) {
    if (!h?.cardOpen) return '';
    return `<div class="sh-note-cover"><section class="sh-note-card" role="dialog" aria-modal="true" aria-label="Wire cutting instructions"><div class="sh-note-header"><div><small>RECOVERED FIELD NOTES</small><h3>Cut in this order</h3></div><button type="button" data-sh-close aria-label="Put note away">×</button></div><p>Read the color <b>name</b>, not its ink. Put this card away to cut.</p><ol>${(h.instructions || []).map((item,i)=> `<li class="${item.done ? 'done' : ''}"><b>${String(i+1).padStart(2,'0')}</b><span>Cut <strong style="color:${colors[item.ink]};${item.orientation === 1 ? 'transform:rotate(180deg)' : ''}">${item.orientation === 2 ? [...item.color.toUpperCase()].reverse().join('') : item.color.toUpperCase()}</strong></span>${item.done ? '<i>✓</i>' : ''}</li>`).join('')}</ol><button type="button" class="sh-put-away" data-sh-close>Put card away · use cutters</button></section></div>`;
  }
  function message(text) {
    const node = root()?.querySelector('[data-sh-message]');
    if (node) node.textContent = text;
  }
  function send(command) {
    if (!canUse()) return;
    queue.enqueue(command, `heist-${Date.now()}-${crypto.randomUUID()}`);
  }
  function activate(target) {
    if (!canUse() || heist()?.cardOpen) return;
    if (target.hasAttribute('data-sh-screw')) {
      if (!shapes.includes(selected)) return;
      send(`screw:${target.dataset.shScrew}:${selected}`);
    } else if (target.hasAttribute('data-sh-wire')) {
      if (heist()?.cut?.includes(target.dataset.shWire)) return;
      if (selected !== 'cutters') return message('Pick up the wire cutters first.');
      send(`cut:${target.dataset.shWire}`);
    }
  }
  function stopDrag() {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    drag.ghost?.remove();
    drag = null;
    document.querySelectorAll('.sh-drop-target').forEach(n=>n.classList.remove('sh-drop-target'));
  }
  function bind(board) {
    board.addEventListener('change',event=>{
      if(!event.target.matches('[data-sh-palette]') || !palettes[event.target.value])return;
      colorMode=event.target.value;
      try {localStorage.setItem('safecracker-color-assist-v1',colorMode);} catch {}
      applyPalette();
    });
    board.addEventListener('click', event => {
      if (event.target.closest('[data-sh-card]')) { send('card:open'); return; }
      if (event.target.closest('[data-sh-close]')) { send('card:close'); return; }
    });
    board.addEventListener('keydown', event => {
      if(event.key === 'Escape' && board.querySelector('.sh-color-menu[open]')) {board.querySelector('.sh-color-menu').open=false;board.querySelector('.sh-color-menu summary').focus();event.preventDefault();return;}
      if (event.key === 'Escape' && heist()?.cardOpen) { event.preventDefault(); send('card:close'); }
      if (event.key === 'Tab' && heist()?.cardOpen) {
        const controls = [...board.querySelectorAll('.sh-note-card button')];
        if (event.shiftKey && document.activeElement === controls[0]) {event.preventDefault(); controls.at(-1)?.focus();}
        if (!event.shiftKey && document.activeElement === controls.at(-1)) {event.preventDefault(); controls[0]?.focus();}
      }
    });
    board.addEventListener('pointerdown', event => {
      const tool = event.target.closest('[data-sh-tool]');
      if (!tool || tool.disabled || !canUse() || event.button !== 0) return;
      api.wakeAudio();
      selected = tool.dataset.shTool; patch();
      stopDrag();
      drag = {id:event.pointerId,tool,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,frame:0,ghost:null};
      tool.setPointerCapture(event.pointerId);
    });
    board.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag.x = event.clientX; drag.y = event.clientY;
      if (!drag.ghost && Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>6) {
        drag.ghost = document.createElement('div');
        drag.ghost.className = drag.tool.className;
        drag.ghost.innerHTML = drag.tool.innerHTML;
        drag.ghost.querySelector('small')?.remove();
        drag.ghost.removeAttribute('data-sh-tool');
        drag.ghost.setAttribute('aria-hidden','true');
        drag.ghost.classList.add('sh-tool-ghost');
        document.body.appendChild(drag.ghost);
      }
      if (!drag.ghost || drag.frame) return;
      drag.frame = requestAnimationFrame(()=> {
        if (!drag?.ghost) return;
        drag.frame = 0;
        drag.ghost.style.transform = `translate3d(${drag.x-30}px,${drag.y-7}px,0) rotate(-18deg)`;
        const target = document.elementFromPoint(drag.x,drag.y)?.closest('[data-sh-screw],[data-sh-wire]');
        board.querySelectorAll('.sh-drop-target').forEach(n=>n.classList.toggle('sh-drop-target',n===target));
        target?.classList.add('sh-drop-target');
      });
    });
    board.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = Boolean(drag.ghost);
      const target = moved ? document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-sh-screw],[data-sh-wire]') : null;
      stopDrag();
      if (target) activate(target);
    });
    board.addEventListener('pointercancel',stopDrag);
    board.addEventListener('lostpointercapture',stopDrag);
  }
  function patch() {
    const board = root();
    if (!board) return;
    const h = heist(), phase = h?.phase || 0;
    const bagMount=board.querySelector('[data-sh-bag-mount]');
    if(bagMount && bagMount.querySelector('[data-sh-kit]')?.dataset.shKit !== kit().join(',')) bagMount.innerHTML=toolBag();
    applyPalette();
    board.dataset.scStatus = game.status;
    if (!h?.failed) board.classList.remove('sh-overload');

    const trackerNode = board.querySelector('[data-sh-tracker]');
    const html = tracker(game);
    if (trackerNode.innerHTML !== html) trackerNode.innerHTML = html;
    const stageLabel = board.querySelector('[data-sh-stage-label]');
    stageLabel.textContent = phase === 0 ? 'Remove the access panel' : 'Disarm the wiring';
    const description = board.querySelector('[data-sh-description]');
    description.textContent = h?.phase === 2 && queue.length ? 'Wiring complete. Confirming access to the dial…' : phase === 0 ? 'Match each screw to the symbol on its screwdriver.' : 'Check the note. Remember the order. Put it away to cut.';
    board.querySelectorAll('[data-sh-tool]').forEach(node=> {
      const allowed = phase === 0 ? shapes.includes(node.dataset.shTool) : node.dataset.shTool === 'cutters';
      node.disabled = !canUse() || !allowed || Boolean(h?.cardOpen);
      node.classList.toggle('sh-picked-up',Boolean(drag && node === drag.tool));
    });
    board.querySelector('[data-sh-card]').disabled = !canUse() || phase !== 1;
    board.querySelectorAll('[data-sh-screw]').forEach((node,i)=> {
      const s = h?.screws?.[i];
      // The waiting board has decorative heads; replace them with the private
      // randomized puzzle when the authoritative round arrives on the same board.
      if (s && node.dataset.shType !== s.type) {
        node.querySelector('.sh-screw-head').innerHTML = icon(s.type);
        node.dataset.shType = s.type;
      }
      node.disabled = !canUse() || !s || s.removed || Boolean(h?.cardOpen);
      node.classList.toggle('removed',Boolean(s?.removed));
      node.classList.toggle('stripped',Boolean(s?.stripped));
      node.style.setProperty('--turns',s?.turns || 0);
      if(s) node.setAttribute('aria-label',`Screw ${i+1}, ${names[shapes.indexOf(s.type)]}${s.removed ? ', removed' : s.stripped ? `, stripped, ${3-s.turns} turns left` : ''}`);
    });
    const panel = board.querySelector('[data-sh-panel]');
    if (panel) {panel.style.setProperty('--loose',h?.removed || 0);panel.style.transform = `translateY(${(h?.removed||0)*1.4}px) rotate(${(h?.removed||0)*.22}deg)`;}
    board.querySelectorAll('[data-sh-wire]').forEach(node=> {
      const cut = h?.cut?.includes(node.dataset.shWire);
      node.classList.toggle('cut',Boolean(cut));
      node.setAttribute('aria-disabled',String(!canUse() || cut || h?.cardOpen));
      node.setAttribute('aria-label',`${cut ? 'Cut' : 'Cut the'} ${node.dataset.shWire} wire${cut ? ', disconnected' : ''}`);
      node.removeAttribute('tabindex');
    });
    const noteMount = board.querySelector('[data-sh-note-mount]');
    const noteHTML = note(h);
    if(noteMount.innerHTML !== noteHTML) {
      const wasOpen = Boolean(noteMount.firstElementChild);
      noteMount.innerHTML = noteHTML;
      if(h?.cardOpen) noteMount.querySelector('button')?.focus();
      else if(wasOpen) board.querySelector('[data-sh-card]')?.focus();
    }
    board.querySelectorAll('[data-sh-close]').forEach(button=>button.disabled=!canUse());
    const key = `${game.gameId}:${h?.lastAction?.actionId || h?.lastAction?.at}:${h?.lastAction?.effect}`;
    if (h?.lastAction && key !== lastEffect) {
      lastEffect = key;
      const effect = h.lastAction.effect;
      api.sound(effect);
      message(({strip:'Stripped! Use the matching driver three times.',turn:'The damaged screw is backing out. Keep using the matching driver.',remove:'Fastener removed.',cut:'Wire disconnected.',zap:'Wrong wire! The vault electronics took damage.','card-open':'Note in hand. Cutting is locked.','card-close':'Note put away. Cut the next wire.'})[effect] || '');
      if(effect === 'zap') {
        const sparks = board.querySelector('.sh-sparks');
        const wireIndex = wireColors().indexOf(h.lastAction.target);
        if (sparks && wireIndex >= 0) sparks.style.top = `${wireY(wireIndex)/320*100}%`;
        board.classList.remove('sh-zap');void board.offsetWidth;board.classList.add('sh-zap');
        if (h.failed) { board.classList.add('sh-overload'); message('Five wrong wires — vault lockdown!'); }
      }
    }
    const damage = board.querySelector('[data-sh-damage]');
    const faults = h?.mistakes || 0;
    damage.textContent = faults >= 5 ? '5 faults · vault lockdown' : faults >= 3 ? faults + ' faults · proximity display offline' : faults === 2 ? '2 faults · number offline / yellow feedback lost' : faults === 1 ? '1 fault · dial number display offline' : '';
    damage.classList.toggle('damaged',faults>0);
  }
  function renderTools(g,mount,helpers) {
    if (g.safecrackerState?.version !== 2 && !g.safecrackerState?.me?.heist) return false;
    if (game?.gameId !== g.gameId) {selected='';lastEffect='';clearTimeout(transition?.timer);transition=null;stopDrag();}
    game = g; api = helpers; queue.receive(g);
    const phase = heist()?.phase === 2 && queue.length ? 1 : (heist()?.phase || 0);
    if (phase === 2) {stopDrag();return false;}
    const key = `${g.gameId}:${phase}`;
    if (g.status === 'playing' && phase === 1 && root()?.dataset.shKey === `${g.gameId}:0` && !transition?.ready) {
      if (!transition) {
        const board = root();
        board.classList.add('sh-panel-release');
        board.querySelectorAll('button').forEach(button=>button.disabled=true);
        const job = transition = {ready:false,timer:0};
        job.timer = setTimeout(()=>{if(transition!==job || !board.isConnected)return;job.ready=true;api.accept(game);},360);
      }
      return true;
    }
    if (root()?.dataset.shKey !== key) {
      stopDrag();
      selected = phase === 1 ? 'cutters' : '';
      mount.innerHTML = `<section class="safe-cracker-game sh-game" data-sc-heist data-sh-key="${esc(key)}" data-sc-game-id="${esc(g.gameId)}" data-sc-status="${esc(g.status)}"><div class="sh-header"><div><small>VAULT BREAK-IN · STAGE ${phase+1}/3</small><h2 data-sh-stage-label></h2><p data-sh-description></p></div><div class="sh-clock"><span data-sc-timer>${helpers.time()}</span><small>${Number(g.pot||g.wager||0).toLocaleString()} CHIP POT</small></div></div><div data-sh-tracker></div><div class="sh-workbench">${phase === 0 ? screws(heist()) : wires()}<div class="sh-sparks" aria-hidden="true">${Array.from({length:24},(_,i)=>`<i style="--angle:${i*137.5}deg;--reach:${90+(i%5)*38}px;--delay:${(i%4)*.08}s"></i>`).join('')}</div></div><div data-sh-note-mount></div><div data-sh-bag-mount>${toolBag()}</div><footer class="sh-footer"><span data-sh-message role="status">${g.status === 'playing' ? 'Your tools are ready.' : 'Ready up below to begin the break-in.'}</span><small data-sh-damage></small></footer></section>`;
      bind(root());
    }
    patch();
    if (g.status === 'countdown' && !root().querySelector('[data-sc-start-countdown]')) root().insertAdjacentHTML('afterbegin',`<div class="sc-start-countdown-overlay" data-sc-start-countdown><div class="sc-countdown-copy"><small>BREAK-IN STARTS IN</small><span data-sc-countdown-value>${esc(helpers.countdown())}</span><b data-sc-countdown-status>TOOLS READY</b></div></div>`);
    if(g.status === 'complete' && !document.querySelector('[data-sc-result-sequence],[data-sc-result-portal]')) root().insertAdjacentHTML('beforeend',helpers.result(g));
    return true;
  }
  function decorateDial(g,mount) {
    const h = g.safecrackerState?.me?.heist;
    if(!h || h.phase !== 2) return;
    const board = mount.querySelector('.safe-cracker-game');
    if(!board) return;
    board.classList.add('sh-dial-stage');
    board.classList.toggle('sh-number-off',h.mistakes>=1);
    board.classList.toggle('sh-yellow-lost',h.mistakes>=2);
    board.classList.toggle('sh-heat-off',h.mistakes>=3);
    if(!board.querySelector('[data-sh-tracker]')) board.insertAdjacentHTML('afterbegin','<div data-sh-tracker></div>');
    const node = board.querySelector('[data-sh-tracker]'), html = tracker(g);
    if(node.innerHTML !== html) node.innerHTML = html;
    const title = board.querySelector('.sc-instruction-heading > b');
    if(title) title.textContent = 'Final stage · crack the vault';
    const tip = board.querySelector('.sc-tip-bar span');
    if(tip) tip.textContent = h.mistakes>=3 ? 'Electronics offline. Watch the latches and locked numbers for a correct guess.' : h.mistakes>=2 ? 'Damaged feedback: orange now includes nearby numbers. Use the dial markings.' : h.mistakes ? 'Number display offline. Read the engraved dial markings.' : 'Electronics intact. Red → orange → yellow → green.';
    const glass = board.querySelector('.sc-display-glass');
    if(glass) glass.setAttribute('aria-hidden',String(h.mistakes>=3));
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDrag();});
  window.SafeCrackerHeist = {renderTools,decorateDial};
})();
