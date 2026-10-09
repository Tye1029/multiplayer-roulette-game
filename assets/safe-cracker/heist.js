(() => {
  'use strict';
  const shapes = ['slot', 'cross', 'pozidriv', 'hex', 'star', 'triwing'];
  const names = ['Flat', 'Cross', 'Pozi', 'Hex', 'Star', 'Tri-wing'];
  const colors = {red:'#fa5959',blue:'#548aff',green:'#2fac77',yellow:'#f2d64f',orange:'#ef9346',purple:'#a580ef',pink:'#f397cd',cyan:'#64d9e1',white:'#e7e9ec',brown:'#ad7652',lime:'#b9e35d',gray:'#8b929e'};
  const slots = [[12,13],[50,10],[88,13],[12,50],[88,50],[12,87],[50,90],[88,87]];
  const paths = {
    slot:'M5 13h18v4H5z', cross:'M12 5h4v7h7v4h-7v7h-4v-7H5v-4h7z',
    pozidriv:'M12 5h4v7h7v4h-7v7h-4v-7H5v-4h7z M7 6l3 3-1 1-3-3z M21 6l1 1-3 3-1-1z M7 22l-1-1 3-3 1 1z M22 21l-1 1-3-3 1-1z',
    hex:'M8 5h12l6 9-6 9H8l-6-9z',
    star:'M14 3l4 6 7 1-3 6 1 7-7-1-5 4-3-7-6-3 5-5 1-7z',
    triwing:'M12 4h4v8l7 5-2 4-7-5-7 5-2-4 7-5z'
  };
  const icon = type => `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="${paths[type] || paths.slot}"/></svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let game = null, api = null, selected = '', pending = null, drag = null, lastEffect = '', transition = null;
  const heist = () => game?.safecrackerState?.me?.heist;
  const root = () => document.querySelector('[data-sc-heist]');
  const canUse = () => game?.status === 'playing' && !pending;
  const phaseName = p => ['Panel', 'Wires', 'Dial'][p] || 'Panel';
  function progress(p, stage) {
    if (!p) return 'Not started';
    return `${phaseName(p.phase)} · ${p.phase === 0 ? `${p.removed}/8` : p.phase === 1 ? `${p.cutCount}/12` : `${stage || 0}/3`}`;
  }
  function tracker(g) {
    const state = g.safecrackerState || {}, mine = state.me?.heist, other = state.opponent?.heist;
    return `<div class="sh-journey" aria-label="Break-in progress">${['Access panel','Wiring','Vault dial'].map((label,i) => `<span class="${i === (mine?.phase || 0) ? 'active' : i < (mine?.phase || 0) ? 'done' : ''}"><i>${i+1}</i>${label}</span>`).join('')}</div><div class="sh-rival"><span>YOU <b>${progress(mine,state.me?.stage)}</b></span><span>RIVAL <b>${progress(other,state.opponent?.stage)}</b></span></div>`;
  }
  function toolBag() {
    return `<aside class="sh-bag" aria-label="Tool bag"><div class="sh-bag-label"><b>FIELD KIT</b><span>Drag a tool, or select it and tap a target</span></div><div class="sh-tools">${shapes.map((type,i) => `<button type="button" class="sh-tool sh-driver" data-sh-tool="${type}" aria-label="${names[i]} screwdriver" aria-pressed="false"><span class="sh-shaft"></span><span class="sh-handle">${icon(type)}</span><small>${names[i]}</small></button>`).join('')}<button type="button" class="sh-tool sh-cutters" data-sh-tool="cutters" aria-label="Wire cutters" aria-pressed="false"><svg viewBox="0 0 60 80" aria-hidden="true"><path class="sh-jaws" d="M16 6l14 14L44 6l-3 23-11 9-11-9z"/><path class="sh-grips" d="M24 30L12 68M36 30l12 38"/><circle cx="30" cy="30" r="5"/></svg><small>Cutters</small></button><button type="button" class="sh-tool sh-note" data-sh-card aria-label="Read wire instructions"><span class="sh-paper"><i></i><i></i><i></i><b>ORDER</b></span><small>Note card</small></button></div></aside>`;
  }
  function screws(h) {
    const list = h?.screws || shapes.concat(['slot','star']).map(type => ({type}));
    return `<div class="sh-backplate"><div class="sh-panel" data-sh-panel><div class="sh-plate-mark"><small>AUTHORIZED ACCESS ONLY</small><b>SECURITY BACKPLATE</b><span>08 FASTENERS · SERIES IV</span></div><div class="sh-vent"></div></div>${list.map((s,i)=> `<button type="button" class="sh-screw" data-sh-screw="${i}" style="--x:${slots[i][0]}%;--y:${slots[i][1]}%" aria-label="Screw ${i+1}, ${names[shapes.indexOf(s.type)]}"><span class="sh-thread"></span><span class="sh-screw-head">${icon(s.type)}</span></button>`).join('')}</div>`;
  }
  function wirePath(index, side) {
    const y = 31 + index * 22, end = 31 + ((index * 5 + 3) % 12) * 22;
    const middle = 40 + ((index * 7 + 2) % 12) * 20;
    return side === 0 ? `M34 ${y} C145 ${y},180 ${middle},290 ${middle}` : `M310 ${middle} C420 ${middle},455 ${end},566 ${end}`;
  }
  function wires() {
    return `<div class="sh-wiring"><img src="/assets/safe-cracker/images/safe-interior-v1.png" alt="Exposed metal safe mechanism" draggable="false"><svg class="sh-wire-board" viewBox="0 0 600 320" preserveAspectRatio="none" aria-label="Twelve live wires">${Object.entries(colors).map(([color,hex],i) => `<g data-sh-wire="${color}" role="button" tabindex="0" aria-label="Cut ${color} wire" style="--wire:${hex}"><title>${color} wire</title><path class="sh-wire-shadow" d="${wirePath(i,0)} ${wirePath(i,1)}"/><path class="sh-cable sh-left" d="${wirePath(i,0)}"/><path class="sh-cable sh-right" d="${wirePath(i,1)}"/><path class="sh-wire-bridge" d="M288 ${40+((i*7+2)%12)*20}h24"/><path class="sh-wire-gloss" d="${wirePath(i,0)} ${wirePath(i,1)}"/><path class="sh-wire-hit" d="${wirePath(i,0)} ${wirePath(i,1)}"/><circle cx="34" cy="${31+i*22}" r="6"/><circle cx="566" cy="${31+((i*5+3)%12)*22}" r="6"/><text x="43" y="${25+i*22}">${color.toUpperCase()}</text></g>`).join('')}</svg></div>`;
  }
  function note(h) {
    if (!h?.cardOpen) return '';
    return `<div class="sh-note-cover"><section class="sh-note-card" role="dialog" aria-modal="true" aria-label="Wire cutting instructions"><div class="sh-note-header"><div><small>RECOVERED FIELD NOTES</small><h3>Cut in this order</h3></div><button type="button" data-sh-close aria-label="Put note away">×</button></div><p>Read the color <b>name</b>, not its ink. Put this card away to cut.</p><ol>${(h.instructions || []).map((item,i)=> `<li class="${item.done ? 'done' : ''}"><b>${String(i+1).padStart(2,'0')}</b><span>Cut <strong style="color:${colors[item.ink]};${item.orientation === 1 ? 'transform:rotate(180deg)' : ''}">${item.orientation === 2 ? [...item.color.toUpperCase()].reverse().join('') : item.color.toUpperCase()}</strong></span>${item.done ? '<i>✓</i>' : ''}</li>`).join('')}</ol><button type="button" class="sh-put-away" data-sh-close>Put card away · use cutters</button></section></div>`;
  }
  function message(text) {
    const node = root()?.querySelector('[data-sh-message]');
    if (node) node.textContent = text;
  }
  async function send(command) {
    if (!canUse()) return;
    const id = game.gameId;
    const token = pending = { id, command, actionId: `heist-${Date.now()}-${crypto.randomUUID()}` };
    patch();
    message('Working…');
    try {
      const response = await window.__safeCrackerBridge.submit({choice:`safecracker:${command}`,actionId:token.actionId});
      if (pending !== token || game?.gameId !== id) return;
      // The bridge dispatches the accepted snapshot before this promise resolves.
      if (response?.game) api.accept(response.game);
    } catch (error) { if (game?.gameId === id) message(error?.message || 'Could not use that tool. Try again.'); }
    finally { if (pending === token) { pending = null; patch(); } }
  }
  function activate(target) {
    if (!canUse() || heist()?.cardOpen) return;
    if (target.hasAttribute('data-sh-screw')) {
      if (!shapes.includes(selected)) return message('Select a screwdriver, then drag it onto a matching screw.');
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
    board.addEventListener('click', event => {
      const tool = event.target.closest('[data-sh-tool]');
      if (tool && !tool.disabled) { selected = tool.dataset.shTool; patch(); return; }
      if (event.target.closest('[data-sh-card]')) { send('card:open'); return; }
      if (event.target.closest('[data-sh-close]')) { send('card:close'); return; }
      const target = event.target.closest('[data-sh-screw],[data-sh-wire]');
      if (target) activate(target);
    });
    board.addEventListener('keydown', event => {
      if (event.key === 'Escape' && heist()?.cardOpen) { event.preventDefault(); send('card:close'); }
      const target = event.target.closest('[data-sh-wire]');
      if (target && ['Enter',' '].includes(event.key)) { event.preventDefault(); activate(target); }
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
        drag.ghost = drag.tool.cloneNode(true);
        drag.ghost.removeAttribute('data-sh-tool');
        drag.ghost.setAttribute('aria-hidden','true');
        drag.ghost.classList.add('sh-tool-ghost');
        document.body.appendChild(drag.ghost);
      }
      if (!drag.ghost || drag.frame) return;
      drag.frame = requestAnimationFrame(()=> {
        if (!drag?.ghost) return;
        drag.frame = 0;
        drag.ghost.style.transform = `translate3d(${drag.x-30}px,${drag.y-25}px,0) rotate(-18deg)`;
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
    board.dataset.scStatus = game.status;
    board.classList.toggle('sh-busy', Boolean(pending));
    const trackerNode = board.querySelector('[data-sh-tracker]');
    const html = tracker(game);
    if (trackerNode.innerHTML !== html) trackerNode.innerHTML = html;
    const stageLabel = board.querySelector('[data-sh-stage-label]');
    stageLabel.textContent = phase === 0 ? 'Remove the access panel' : 'Disarm the wiring';
    const description = board.querySelector('[data-sh-description]');
    description.textContent = phase === 0 ? 'Match each screw to the symbol on its screwdriver.' : 'Check the note. Remember the order. Put it away to cut.';
    board.querySelectorAll('[data-sh-tool]').forEach(node=> {
      const allowed = phase === 0 ? shapes.includes(node.dataset.shTool) : node.dataset.shTool === 'cutters';
      node.disabled = !canUse() || !allowed || Boolean(h?.cardOpen);
      node.setAttribute('aria-pressed', String(node.dataset.shTool === selected));
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
      node.tabIndex = !canUse() || cut || h?.cardOpen ? -1 : 0;
    });
    const noteMount = board.querySelector('[data-sh-note-mount]');
    const noteHTML = note(h);
    if(noteMount.innerHTML !== noteHTML) {
      const wasOpen = Boolean(noteMount.firstElementChild);
      noteMount.innerHTML = noteHTML;
      if(h?.cardOpen) noteMount.querySelector('button')?.focus();
      else if(wasOpen) board.querySelector('[data-sh-card]')?.focus();
    }
    board.querySelectorAll('[data-sh-close]').forEach(button=>button.disabled=Boolean(pending));
    const key = `${game.gameId}:${h?.lastAction?.at}:${h?.lastAction?.effect}`;
    if (h?.lastAction && key !== lastEffect) {
      lastEffect = key;
      const effect = h.lastAction.effect;
      api.sound(effect);
      message(({strip:'Stripped! Use the matching driver three times.',turn:'The damaged screw is backing out. Keep using the matching driver.',remove:'Fastener removed.',cut:'Wire disconnected.',zap:'Wrong wire! The vault electronics took damage.','card-open':'Note in hand. Cutting is locked.','card-close':'Note put away. Cut the next wire.'})[effect] || '');
      if(effect === 'zap') {
        const sparks = board.querySelector('.sh-sparks');
        const wireIndex = Object.keys(colors).indexOf(h.lastAction.target);
        if (sparks && wireIndex >= 0) sparks.style.top = `${(40+((wireIndex*7+2)%12)*20)/320*100}%`;
        board.classList.remove('sh-zap');void board.offsetWidth;board.classList.add('sh-zap');
      }
    }
    const damage = board.querySelector('[data-sh-damage]');
    const faults = h?.mistakes || 0;
    damage.textContent = faults >= 3 ? '3 faults · proximity display offline' : faults === 2 ? '2 faults · number offline / yellow feedback lost' : faults === 1 ? '1 fault · dial number display offline' : 'Vault electronics intact';
    damage.classList.toggle('damaged',faults>0);
  }
  function renderTools(g,mount,helpers) {
    if (g.safecrackerState?.version !== 2 && !g.safecrackerState?.me?.heist) return false;
    if (game?.gameId !== g.gameId) {pending=null;selected='';lastEffect='';clearTimeout(transition?.timer);transition=null;stopDrag();}
    game = g; api = helpers;
    const phase = heist()?.phase || 0;
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
      mount.innerHTML = `<section class="safe-cracker-game sh-game" data-sc-heist data-sh-key="${esc(key)}" data-sc-game-id="${esc(g.gameId)}" data-sc-status="${esc(g.status)}"><div class="sh-header"><div><small>VAULT BREAK-IN · STAGE ${phase+1}/3</small><h2 data-sh-stage-label></h2><p data-sh-description></p></div><div class="sh-clock"><span data-sc-timer>${helpers.time()}</span><small>${Number(g.pot||g.wager||0).toLocaleString()} CHIP POT</small></div></div><div data-sh-tracker></div><div class="sh-workbench">${phase === 0 ? screws(heist()) : wires()}<div class="sh-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div data-sh-note-mount></div>${toolBag()}<footer class="sh-footer"><span data-sh-message role="status">${g.status === 'playing' ? 'Your tools are ready.' : 'Ready up below to begin the break-in.'}</span><small data-sh-damage></small></footer></section>`;
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
