const password = document.getElementById('password');
    const loadBtn = document.getElementById('loadBtn');
    const statusBox = document.getElementById('status');
    const summary = document.getElementById('summary');
    const adjustPanel = document.getElementById('adjustPanel');
    const adjustUser = document.getElementById('adjustUser');
    const adjustAmount = document.getElementById('adjustAmount');
    const adjustAction = document.getElementById('adjustAction');
    const adjustReason = document.getElementById('adjustReason');
    const applyAdjustBtn = document.getElementById('applyAdjustBtn');
    const userTableWrap = document.getElementById('userTableWrap');
    const betTableWrap = document.getElementById('betTableWrap');
    const adjustmentTableWrap = document.getElementById('adjustmentTableWrap');
    const withdrawalTableWrap = document.getElementById('withdrawalTableWrap');
    const usersTitle = document.getElementById('usersTitle');
    const betsTitle = document.getElementById('betsTitle');
    const adjustmentsTitle = document.getElementById('adjustmentsTitle');
    const withdrawalsTitle = document.getElementById('withdrawalsTitle');
    const userRows = document.getElementById('userRows');
    const betRows = document.getElementById('betRows');
    const adjustmentRows = document.getElementById('adjustmentRows');
    const withdrawalRows = document.getElementById('withdrawalRows');
    const userDetailPanel = document.getElementById('userDetailPanel');
    const detailUserSelect = document.getElementById('detailUserSelect');
    const refreshDetailBtn = document.getElementById('refreshDetailBtn');
    const userDetailContent = document.getElementById('userDetailContent');
    const detailUpdated = document.getElementById('detailUpdated');
    const mpTestingPanel = document.getElementById('mpTestingPanel');
    const cancelAllMpGamesBtn = document.getElementById('cancelAllMpGamesBtn');
    const oddsPanel = document.getElementById('oddsPanel');
    const globalOddsPreset = document.getElementById('globalOddsPreset');
    const globalOddsJson = document.getElementById('globalOddsJson');
    const scratchGameOddsJson = document.getElementById('scratchGameOddsJson');
    const runnerGameOddsJson = document.getElementById('runnerGameOddsJson');
    const multiplayerHouseCutInput = document.getElementById('multiplayerHouseCutInput');
    const saveGameOddsBtn = document.getElementById('saveGameOddsBtn');
    const globalOddsStats = document.getElementById('globalOddsStats');
    const userOddsSelect = document.getElementById('userOddsSelect');
    const userOddsJson = document.getElementById('userOddsJson');
    const saveGlobalOddsBtn = document.getElementById('saveGlobalOddsBtn');
    const saveUserOddsBtn = document.getElementById('saveUserOddsBtn');
    const clearUserOddsBtn = document.getElementById('clearUserOddsBtn');
    const reloadOddsBtn = document.getElementById('reloadOddsBtn');
    const oddsHint = document.getElementById('oddsHint');
    const connectedCount = document.getElementById('connectedCount');
    const balanceTotal = document.getElementById('balanceTotal');
    const xanTotal = document.getElementById('xanTotal');
    const withdrawPendingTotal = document.getElementById('withdrawPendingTotal');
    const betCount = document.getElementById('betCount');
    const wageredTotal = document.getElementById('wageredTotal');
    const houseNet = document.getElementById('houseNet');
    let latestUsers = [];
    let latestOddsSettings = null;

    function setStatus(message, type = '') {
      statusBox.className = 'status' + (type ? ' ' + type : '');
      statusBox.innerHTML = message;
    }

    function fmtDate(value) {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString();
    }

    function xans(value) {
      const n = Math.max(0, Math.floor(Number(value || 0)));
      return `${n.toLocaleString()} ${n === 1 ? 'Ticket' : 'Tickets'}`;
    }

    function xanaxEquivalent(value) {
      const tickets = Math.max(0, Math.floor(Number(value || 0)));
      const wholeXans = Math.floor(tickets / 1000);
      return `${wholeXans.toLocaleString()} ${wholeXans === 1 ? 'Xanax' : 'Xanax'}`;
    }

    function signed(value) {
      const n = Number(value || 0);
      const cls = n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral';
      const text = n > 0 ? `+${xans(n)}` : n < 0 ? `-${xans(Math.abs(n))}` : xans(0);
      return `<span class="${cls}">${text}</span>`;
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    function fillAdjustUser(userId) {
      adjustUser.value = String(userId || '');
      adjustAmount.focus();
      window.scrollTo({ top: adjustPanel.offsetTop - 12, behavior: 'smooth' });
    }

    window.fillAdjustUser = fillAdjustUser;

    function selectUserDetails(userId) {
      detailUserSelect.value = String(userId || '');
      renderUserDetails();
      if (userId) window.scrollTo({ top: userDetailPanel.offsetTop - 12, behavior: 'smooth' });
    }

    window.selectUserDetails = selectUserDetails;

    function detailItem(title, value) {
      return `<div class="detail-card"><span>${escapeHtml(title)}</span><b>${value}</b></div>`;
    }

    function renderMiniRows(items, mapper, emptyText) {
      if (!Array.isArray(items) || !items.length) return `<div class="detail-muted">${escapeHtml(emptyText)}</div>`;
      return `<div class="detail-list">${items.map(mapper).join('')}</div>`;
    }

    function renderActiveTickets(user) {
      const tickets = Array.isArray(user.activeTickets) ? user.activeTickets : Object.values(user.activeTickets || {});
      const active = tickets.filter(ticket => ticket && ticket.status === 'active');
      if (!active.length) return '<div class="detail-muted">No active unrevealed ticket.</div>';
      return renderMiniRows(active, ticket => {
        const prizes = Array.isArray(ticket.prizes) ? ticket.prizes.map(v => Number(v) > 0 ? Number(v).toLocaleString() : 'LOSE').join(', ') : '—';
        return `<div class="detail-item"><strong>Ticket ${escapeHtml(ticket.ticketId || '—')}</strong><br>Cost: ${xans(ticket.ticketCost)} · Possible win: ${xans(ticket.winAmount)}<small>Created: ${escapeHtml(fmtDate(ticket.createdAt))}</small><small>Spots: ${escapeHtml(prizes)}</small></div>`;
      }, 'No active unrevealed ticket.');
    }

    function renderLinkedTornUsers(user) {
      const linked = Array.isArray(user.linkedTornUsers) ? user.linkedTornUsers : [];
      return renderMiniRows(linked.slice().reverse().slice(0, 20), item => {
        const label = `${item.name || 'Unknown'} [${item.id || '—'}]`;
        return `<div class="detail-item"><strong>${escapeHtml(label)}</strong><small>First seen: ${escapeHtml(fmtDate(item.firstSeenAt))}</small><small>Last seen: ${escapeHtml(fmtDate(item.lastSeenAt))}</small></div>`;
      }, 'No linked Torn API users recorded yet.');
    }

    function renderUserDetails() {
      const userId = detailUserSelect.value;
      const user = latestUsers.find(u => String(u.userId) === String(userId));
      if (!user) {
        userDetailContent.innerHTML = '<div class="detail-muted">Select a connected user to inspect.</div>';
        detailUpdated.textContent = latestUsers.length ? `${latestUsers.length.toLocaleString()} user(s) loaded` : 'Load admin data first';
        return;
      }

      const adminNet = Number(user.totalAdminAdded || 0) - Number(user.totalAdminRemoved || 0);
      const houseNetForUser = Number(user.totalWagered || 0) - Number(user.totalWon || 0);
      const pendingWithdrawals = (user.recentWithdrawals || []).filter(w => String(w.status || 'pending') === 'pending').reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const activeTicketCount = Array.isArray(user.activeTickets) ? user.activeTickets.length : Object.keys(user.activeTickets || {}).length;
      const ledgerCount = Number(user.ledgerCount || (Array.isArray(user.financialLedger) ? user.financialLedger.length : 0));

      const stats = [
        detailItem('Player', `${escapeHtml(user.name)} <small class="detail-muted">[${escapeHtml(user.userId)}]</small>`),
        detailItem('Linked API Users', Number((user.linkedTornUsers || []).length || 0).toLocaleString()),
        detailItem('Current Balance', xans(user.currentBalance)),
        detailItem('Total Deposited', `${xans(user.totalTicketsDeposited || 0)} <small class="detail-muted">${xanaxEquivalent(user.totalTicketsDeposited || 0)} received</small>`),
        detailItem('Pending Withdrawals', xans(pendingWithdrawals)),
        detailItem('Total Withdraw Requested', `${xans(user.totalWithdrawRequested)} <small class="detail-muted">${Number(user.withdrawalCount || 0).toLocaleString()} request(s)</small>`),
        detailItem('Bets', Number(user.betCount || 0).toLocaleString()),
        detailItem('Total Wagered', xans(user.totalWagered)),
        detailItem('Total Won', xans(user.totalWon)),
        detailItem('Player Net', signed(user.netProfit)),
        detailItem('House Net From User', signed(houseNetForUser)),
        detailItem('Admin Net', `${signed(adminNet)} <small class="detail-muted">+${xans(user.totalAdminAdded)} / -${xans(user.totalAdminRemoved)}</small>`),
        detailItem('Active Tickets', Number(activeTicketCount || 0).toLocaleString()),
        detailItem('Claimed Log IDs', Number(user.claimedLogCount || 0).toLocaleString()),
        detailItem('Ledger Entries', ledgerCount.toLocaleString()),
        detailItem('First Game Bonus', user.firstTicketBonusUsedAt ? `Used <small class="detail-muted">${escapeHtml(fmtDate(user.firstTicketBonusUsedAt))}</small>` : 'Eligible'),
        detailItem('First Bonus Ticket', user.firstTicketBonusTicketId ? escapeHtml(user.firstTicketBonusTicketId) : '—'),
        detailItem('First Connected', escapeHtml(fmtDate(user.firstConnectedAt))),
        detailItem('Last Checked', escapeHtml(fmtDate(user.lastCheckedAt))),
        detailItem('Last Bet', escapeHtml(fmtDate(user.lastBetAt))),
        detailItem('Last Withdrawal', escapeHtml(fmtDate(user.lastWithdrawalAt)))
      ].join('');

      const bets = renderMiniRows((user.recentBets || []).slice(0, 40), bet => {
        const prizes = Array.isArray(bet.prizes) ? bet.prizes.map(v => Number(v) > 0 ? Number(v).toLocaleString() : 'LOSE').join(', ') : '—';
        return `<div class="detail-item"><strong>${escapeHtml(fmtDate(bet.at))}</strong><br>Cost: ${xans(bet.ticketCost)} · Won: ${xans(bet.winAmount)} · Net: ${signed(bet.net)}<small>Balance: ${xans(bet.balanceBefore)} → ${xans(bet.balanceAfter)}</small><small>Ticket: ${escapeHtml(bet.ticketId || '—')}</small><small>Spots: ${escapeHtml(prizes)}</small></div>`;
      }, 'No completed bets recorded for this user.');

      const withdrawals = renderMiniRows((user.recentWithdrawals || []).slice(0, 40), w => `<div class="detail-item"><strong>${escapeHtml(fmtDate(w.at))}</strong><br>Withdraw: ${xans(w.amount)} · Status: <span class="pill">${escapeHtml(w.status || 'pending')}</span><small>Balance: ${xans(w.balanceBefore)} → ${xans(w.balanceAfter)}</small><small>${escapeHtml(w.note || 'User withdrawal request')}</small></div>`, 'No withdrawals recorded for this user.');

      const adjustments = renderMiniRows((user.recentAdjustments || []).slice(0, 40), adj => `<div class="detail-item"><strong>${escapeHtml(fmtDate(adj.at))}</strong><br>${escapeHtml(adj.action === 'decrease' ? 'Decrease' : 'Increase')}: ${xans(adj.amount)} · Delta: ${signed(adj.delta)}<small>Balance: ${xans(adj.balanceBefore)} → ${xans(adj.balanceAfter)}</small><small>Reason: ${escapeHtml(adj.reason || '—')}</small></div>`, 'No admin adjustments recorded for this user.');

      const ledger = renderMiniRows((user.financialLedger || []).slice(0, 60), entry => `<div class="detail-item"><strong>${escapeHtml(fmtDate(entry.at))}</strong><br>${escapeHtml(entry.type || 'ledger')} · ${signed(entry.delta)}<small>ID: ${escapeHtml(entry.id || '—')}</small><small>${escapeHtml(entry.reason || '')}</small></div>`, 'No ledger entries returned for this user.');

      const events = renderMiniRows((user.recentEvents || []).slice(0, 40), event => `<div class="detail-item"><strong>${escapeHtml(event.type || 'event')}</strong><small>${escapeHtml(fmtDate(event.at))}</small>${escapeHtml(event.message || '')}</div>`, 'No recent events recorded for this user.');

      userDetailContent.innerHTML = `
        <div class="detail-grid">${stats}</div>
        <div class="detail-columns">
          <div class="detail-box"><h3>Active Ticket</h3>${renderActiveTickets(user)}</div>
          <div class="detail-box"><h3>Linked API Users</h3>${renderLinkedTornUsers(user)}</div>
          <div class="detail-box"><h3>Recent Events</h3>${events}</div>
          <div class="detail-box"><h3>Recent Bets</h3>${bets}</div>
          <div class="detail-box"><h3>Withdrawals</h3>${withdrawals}</div>
          <div class="detail-box"><h3>Admin Adjustments</h3>${adjustments}</div>
          <div class="detail-box"><h3>Financial Ledger</h3>${ledger}</div>
        </div>
      `;
      detailUpdated.textContent = `Viewing ${user.name} [${user.userId}]`;
    }


    function prettyJson(value) {
      return JSON.stringify(value, null, 2);
    }

    function parseJsonTextarea(textarea, label) {
      try { return JSON.parse(textarea.value || '{}'); }
      catch (error) { throw new Error(`${label} contains invalid JSON: ${error.message}`); }
    }

    function renderOddsStats(profile) {
      const stats = profile?.stats || {};
      const items = [
        ['RTP', `${Number(stats.rtp || 0).toFixed(2)}%`],
        ['House Edge', `${Number(stats.houseEdge || 0).toFixed(2)}%`],
        ['Win/Refund Chance', `${Number(stats.winChance || 0).toFixed(2)}%`],
        ['Prob. Total', `${Number(stats.totalProbability || 0).toFixed(2)}%`]
      ];
      globalOddsStats.innerHTML = items.map(([name, value]) => `<div class="odds-stat"><span>${escapeHtml(name)}</span><b>${escapeHtml(value)}</b></div>`).join('');
    }

    function applyOddsToForm(settings) {
      latestOddsSettings = settings || latestOddsSettings;
      const globalProfile = latestOddsSettings?.defaultProfile || null;
      if (globalProfile) {
        const scratchProfile = { name: globalProfile.name, description: globalProfile.description, tiers: globalProfile.tiers };
        globalOddsJson.value = prettyJson(scratchProfile);
        if (scratchGameOddsJson) scratchGameOddsJson.value = prettyJson(scratchProfile);
        renderOddsStats(globalProfile);
      }
      const gameOdds = latestOddsSettings?.gameOdds || {};
      if (runnerGameOddsJson) runnerGameOddsJson.value = prettyJson(gameOdds.runner || { baseWinChance: 72, minWinChance: 12, chanceDropPerStep: 5.5, chanceDropPerMultiplier: 2.4, startMultiplier: 1, baseMultiplierIncrease: 0.22, multiplierGrowth: 1.18, maxMultiplier: 35 });
      if (multiplayerHouseCutInput) multiplayerHouseCutInput.value = String(gameOdds.multiplayer?.houseCutPercent ?? 3.3);
      const selectedUser = userOddsSelect.value;
      if (selectedUser) fillUserOddsTextarea(selectedUser);
    }

    async function loadOdds(showMessage = false) {
      const pass = password.value;
      if (!pass) return;
      const response = await fetch('/.netlify/functions/admin-odds', { headers: { 'X-Admin-Password': pass } });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load odds settings.');
      applyOddsToForm(data.settings);
      oddsPanel.hidden = false;
      if (showMessage) setStatus('Live odds settings loaded.', 'good');
    }

    function fillUserOddsTextarea(userId) {
      const cleanId = String(userId || '');
      const override = latestOddsSettings?.userProfiles?.[cleanId];
      const base = override || latestOddsSettings?.defaultProfile;
      userOddsJson.value = base ? prettyJson({ name: override ? base.name : `${base.name} (user override)`, description: base.description, tiers: base.tiers }) : '';
      oddsHint.textContent = override
        ? `This user currently has a custom odds override. New tickets for this user use the user-specific profile.`
        : `This user currently uses the global odds. Save an override to customize only this user.`;
    }

    async function saveOdds(action, payload) {
      const pass = password.value;
      if (!pass) return setStatus('Enter the admin password first.', 'bad');
      const response = await fetch('/.netlify/functions/admin-odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pass },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to save odds settings.');
      applyOddsToForm(data.settings);
      return data.settings;
    }


    async function saveGameOdds() {
      try {
        saveGameOddsBtn.disabled = true;
        const scratchProfile = parseJsonTextarea(scratchGameOddsJson, 'Scratch Tickets odds');
        const runnerOdds = parseJsonTextarea(runnerGameOddsJson, 'Street Runner odds');
        const houseCutPercent = Number(multiplayerHouseCutInput.value || 3.3);
        await saveOdds('set-global', { profile: scratchProfile });
        await saveOdds('set-game-odds', { gameOdds: { runner: runnerOdds, multiplayer: { houseCutPercent } } });
        setStatus('Per-game odds saved. Scratch Tickets, Multiplayer, and Street Runner now use the updated settings.', 'good');
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to save per-game odds.'), 'bad');
      } finally {
        saveGameOddsBtn.disabled = false;
      }
    }

    async function saveGlobalOdds() {
      try {
        saveGlobalOddsBtn.disabled = true;
        const preset = globalOddsPreset.value;
        let profile;
        if (preset && preset !== 'custom' && latestOddsSettings?.presets?.[preset]) {
          profile = latestOddsSettings.presets[preset];
        } else {
          profile = parseJsonTextarea(globalOddsJson, 'Global odds');
        }
        await saveOdds('set-global', { profile });
        setStatus('Global live odds saved. New tickets use the updated site-wide odds immediately.', 'good');
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to save global odds.'), 'bad');
      } finally {
        saveGlobalOddsBtn.disabled = false;
      }
    }

    async function saveUserOdds() {
      const userId = userOddsSelect.value;
      if (!userId) return setStatus('Select a user before saving a user-specific odds override.', 'bad');
      try {
        saveUserOddsBtn.disabled = true;
        const profile = parseJsonTextarea(userOddsJson, 'User odds');
        await saveOdds('set-user', { userId, profile });
        setStatus(`User-specific live odds saved for ${escapeHtml(userId)}. Their new tickets use this override immediately.`, 'good');
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to save user odds.'), 'bad');
      } finally {
        saveUserOddsBtn.disabled = false;
      }
    }

    async function clearUserOdds() {
      const userId = userOddsSelect.value;
      if (!userId) return setStatus('Select a user before clearing an odds override.', 'bad');
      try {
        clearUserOddsBtn.disabled = true;
        await saveOdds('clear-user', { userId });
        fillUserOddsTextarea(userId);
        setStatus(`User-specific odds cleared for ${escapeHtml(userId)}. They now use the global odds.`, 'good');
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to clear user odds.'), 'bad');
      } finally {
        clearUserOddsBtn.disabled = false;
      }
    }

    async function loadAdmin(showLoading = true) {
      const pass = password.value;
      if (!pass) {
        setStatus('Enter the admin password first.', 'bad');
        return;
      }

      loadBtn.disabled = true;
      if (showLoading) setStatus('Loading admin data...');

      try {
        const response = await fetch('/.netlify/functions/admin-users', {
          headers: { 'X-Admin-Password': pass }
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load admin users.');

        const users = data.users || [];
        latestUsers = users;
        const allBets = users.flatMap(user => (user.recentBets || []).map(bet => ({ ...bet, userName: user.name, userId: user.userId })));
        allBets.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        const allAdjustments = users.flatMap(user => (user.recentAdjustments || []).map(adj => ({ ...adj, userName: user.name, userId: user.userId })));
        allAdjustments.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        const allWithdrawals = users.flatMap(user => (user.recentWithdrawals || []).map(w => ({ ...w, userName: user.name, userId: user.userId })));
        allWithdrawals.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

        const totalBalance = users.reduce((sum, u) => sum + Number(u.currentBalance || 0), 0);
        const totalDeposited = users.reduce((sum, u) => sum + Number(u.totalTicketsDeposited || 0), 0);
        const totalBets = users.reduce((sum, u) => sum + Number(u.betCount || 0), 0);
        const totalWagered = users.reduce((sum, u) => sum + Number(u.totalWagered || 0), 0);
        const totalWon = users.reduce((sum, u) => sum + Number(u.totalWon || 0), 0);
        const pendingWithdrawTotal = allWithdrawals.filter(w => String(w.status || 'pending') === 'pending').reduce((sum, w) => sum + Number(w.amount || 0), 0);

        connectedCount.textContent = users.length.toLocaleString();
        balanceTotal.textContent = xans(totalBalance);
        xanTotal.textContent = xans(totalDeposited);
        withdrawPendingTotal.textContent = xans(pendingWithdrawTotal);
        betCount.textContent = totalBets.toLocaleString();
        wageredTotal.textContent = xans(totalWagered);
        houseNet.innerHTML = signed(totalWagered - totalWon);

        const selected = adjustUser.value;
        adjustUser.innerHTML = '<option value="">Select a connected user</option>' + users.map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name)} [${escapeHtml(user.userId)}] — ${xans(user.currentBalance)}</option>`).join('');
        if (users.some(u => String(u.userId) === String(selected))) adjustUser.value = selected;

        const selectedDetail = detailUserSelect.value;
        detailUserSelect.innerHTML = '<option value="">Select a user to inspect</option>' + users.map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name)} [${escapeHtml(user.userId)}] — ${xans(user.currentBalance)}</option>`).join('');
        if (users.some(u => String(u.userId) === String(selectedDetail))) detailUserSelect.value = selectedDetail;
        else if (users.length === 1) detailUserSelect.value = users[0].userId;
        renderUserDetails();

        const selectedOddsUser = userOddsSelect.value;
        userOddsSelect.innerHTML = '<option value="">Select a user for custom odds</option>' + users.map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name)} [${escapeHtml(user.userId)}]</option>`).join('');
        if (users.some(u => String(u.userId) === String(selectedOddsUser))) userOddsSelect.value = selectedOddsUser;
        await loadOdds(false);

        userRows.innerHTML = users.map(user => {
          const events = (user.recentEvents || []).slice(0, 4).map(event => `<div>${escapeHtml(event.message || event.type)}<br><small>${escapeHtml(fmtDate(event.at))}</small></div>`).join('<hr style="border-color:rgba(255,255,255,.10);border-width:0 0 1px;">');
          const adminNet = Number(user.totalAdminAdded || 0) - Number(user.totalAdminRemoved || 0);
          return `<tr>
            <td><strong>${escapeHtml(user.name)}</strong><br><span class="pill">[${escapeHtml(user.userId)}]</span></td>
            <td><strong>${xans(user.currentBalance)}</strong></td>
            <td>${xans(user.totalTicketsDeposited || 0)}<br><small>${xanaxEquivalent(user.totalTicketsDeposited || 0)} received</small></td>
            <td>${signed(adminNet)}<br><small>+${xans(user.totalAdminAdded)} / -${xans(user.totalAdminRemoved)}</small></td>
            <td>${xans(user.totalWithdrawRequested)}<br><small>${Number(user.withdrawalCount || 0).toLocaleString()} request(s)</small></td>
            <td>${Number(user.betCount || 0).toLocaleString()}</td>
            <td>${xans(user.totalWagered)}</td>
            <td>${xans(user.totalWon)}</td>
            <td>${signed(user.netProfit)}</td>
            <td>${escapeHtml(fmtDate(user.lastBetAt))}</td>
            <td>${escapeHtml(fmtDate(user.lastCheckedAt))}</td>
            <td><button class="secondary small-btn" type="button" onclick="selectUserDetails('${escapeHtml(user.userId)}')">View</button> <button class="secondary small-btn" type="button" onclick="fillAdjustUser('${escapeHtml(user.userId)}')">Adjust</button></td>
            <td class="events">${events || '—'}</td>
          </tr>`;
        }).join('');


        withdrawalRows.innerHTML = allWithdrawals.slice(0, 150).map(w => `<tr>
          <td>${escapeHtml(fmtDate(w.at))}</td>
          <td><strong>${escapeHtml(w.userName)}</strong><br><span class="pill">[${escapeHtml(w.userId)}]</span></td>
          <td><strong>${xans(w.amount)}</strong></td>
          <td><span class="pill">${escapeHtml(w.status || 'pending')}</span></td>
          <td>${xans(w.balanceBefore)}</td>
          <td><strong>${xans(w.balanceAfter)}</strong></td>
          <td class="events">${escapeHtml(w.note || 'User withdrawal request')}</td>
        </tr>`).join('') || '<tr><td colspan="7">No withdrawal requests recorded yet.</td></tr>';

        adjustmentRows.innerHTML = allAdjustments.slice(0, 100).map(adj => `<tr>
          <td>${escapeHtml(fmtDate(adj.at))}</td>
          <td><strong>${escapeHtml(adj.userName)}</strong><br><span class="pill">[${escapeHtml(adj.userId)}]</span></td>
          <td>${escapeHtml(adj.action === 'decrease' ? 'Decrease' : 'Increase')}</td>
          <td>${xans(adj.amount)}</td>
          <td>${signed(adj.delta)}</td>
          <td>${xans(adj.balanceBefore)}</td>
          <td><strong>${xans(adj.balanceAfter)}</strong></td>
          <td class="events">${escapeHtml(adj.reason || '—')}</td>
        </tr>`).join('') || '<tr><td colspan="8">No admin adjustments recorded yet.</td></tr>';

        betRows.innerHTML = allBets.slice(0, 100).map(bet => {
          const prizes = Array.isArray(bet.prizes) ? bet.prizes.map(v => Number(v) > 0 ? `${Number(v).toLocaleString()}` : 'LOSE').join(', ') : '—';
          return `<tr>
            <td>${escapeHtml(fmtDate(bet.at))}</td>
            <td><strong>${escapeHtml(bet.userName)}</strong><br><span class="pill">[${escapeHtml(bet.userId)}]</span></td>
            <td>${xans(bet.ticketCost)}</td>
            <td>${xans(bet.winAmount)}</td>
            <td>${signed(bet.net)}</td>
            <td>${xans(bet.balanceBefore)}</td>
            <td><strong>${xans(bet.balanceAfter)}</strong></td>
            <td class="events">${escapeHtml(prizes)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8">No completed bets recorded yet.</td></tr>';

        summary.hidden = false;
        adjustPanel.hidden = false;
        mpTestingPanel.hidden = false;
        userDetailPanel.hidden = false;
        usersTitle.hidden = false;
        betsTitle.hidden = false;
        withdrawalsTitle.hidden = false;
        adjustmentsTitle.hidden = false;
        userTableWrap.hidden = false;
        betTableWrap.hidden = false;
        withdrawalTableWrap.hidden = false;
        adjustmentTableWrap.hidden = false;
        if (showLoading) setStatus(`Loaded ${users.length.toLocaleString()} user(s), ${allBets.length.toLocaleString()} recent bet(s), ${allWithdrawals.length.toLocaleString()} withdrawal request(s), and ${allAdjustments.length.toLocaleString()} adjustment(s).`, 'good');
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to load admin data.'), 'bad');
      } finally {
        loadBtn.disabled = false;
      }
    }

    async function cancelAllMultiplayerGames() {
      const pass = password.value;
      if (!pass) return setStatus('Enter the admin password first.', 'bad');
      if (!confirm('Cancel all current multiplayer games and refund escrowed Tickets to real players?')) return;

      cancelAllMpGamesBtn.disabled = true;
      setStatus('Cancelling all current multiplayer games...');
      try {
        const response = await fetch('/.netlify/functions/admin-multiplayer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': pass
          },
          body: JSON.stringify({ action: 'cancel-all' })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to cancel multiplayer games.');
        setStatus(`Cancelled ${Number(data.cancelledCount || 0).toLocaleString()} current multiplayer game(s), removed ${Number(data.deletedCount || 0).toLocaleString()} game record(s), and refunded ${xans(data.refundedTickets || 0)}.`, 'good');
        await loadAdmin(false);
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to cancel multiplayer games.'), 'bad');
      } finally {
        cancelAllMpGamesBtn.disabled = false;
      }
    }

    async function applyAdjustment() {
      const pass = password.value;
      const userId = adjustUser.value;
      const amount = Number(adjustAmount.value || 0);
      const action = adjustAction.value;
      const reason = adjustReason.value.trim() || 'Admin balance adjustment';

      if (!pass) return setStatus('Enter the admin password first.', 'bad');
      if (!userId) return setStatus('Select a user to adjust.', 'bad');
      if (!Number.isFinite(amount) || amount <= 0) return setStatus('Enter an amount of at least 1 Ticket.', 'bad');

      const user = latestUsers.find(u => String(u.userId) === String(userId));
      const verb = action === 'decrease' ? 'remove' : 'add';
      if (!confirm(`Are you sure you want to ${verb} ${amount.toLocaleString()} Tickets ${action === 'decrease' ? 'from' : 'to'} ${user ? user.name : userId}?`)) return;

      applyAdjustBtn.disabled = true;
      setStatus('Saving balance adjustment...');

      try {
        const response = await fetch('/.netlify/functions/admin-adjust', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': pass
          },
          body: JSON.stringify({ userId, amount, action, reason })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to adjust balance.');

        adjustAmount.value = '';
        adjustReason.value = '';
        setStatus(`${action === 'decrease' ? 'Removed' : 'Added'} ${xans(amount)} ${action === 'decrease' ? 'from' : 'to'} ${escapeHtml(data.user.name)} [${escapeHtml(data.user.userId)}]. New balance: ${xans(data.user.currentBalance)}.`, 'good');
        await loadAdmin(false);
      } catch (error) {
        setStatus(escapeHtml(error.message || 'Unable to adjust balance.'), 'bad');
      } finally {
        applyAdjustBtn.disabled = false;
      }
    }

    loadBtn.addEventListener('click', () => loadAdmin(true));
    applyAdjustBtn.addEventListener('click', applyAdjustment);
    cancelAllMpGamesBtn.addEventListener('click', cancelAllMultiplayerGames);
    detailUserSelect.addEventListener('change', renderUserDetails);
    refreshDetailBtn.addEventListener('click', () => loadAdmin(true));
    saveGameOddsBtn.addEventListener('click', saveGameOdds);
    saveGlobalOddsBtn.addEventListener('click', saveGlobalOdds);
    saveUserOddsBtn.addEventListener('click', saveUserOdds);
    clearUserOddsBtn.addEventListener('click', clearUserOdds);
    reloadOddsBtn.addEventListener('click', () => loadOdds(true).catch(error => setStatus(escapeHtml(error.message || 'Unable to reload odds.'), 'bad')));
    globalOddsPreset.addEventListener('change', () => {
      const key = globalOddsPreset.value;
      if (key !== 'custom' && latestOddsSettings?.presets?.[key]) {
        const profile = latestOddsSettings.presets[key];
        globalOddsJson.value = prettyJson({ name: profile.name, description: profile.description, tiers: profile.tiers });
        renderOddsStats(profile);
      }
    });
    userOddsSelect.addEventListener('change', event => fillUserOddsTextarea(event.target.value));
    password.addEventListener('keydown', event => {
      if (event.key === 'Enter') loadAdmin(true);
    });
