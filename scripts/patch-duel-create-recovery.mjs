import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
let html = await readFile(indexUrl, 'utf8');
let data = await readFile(dataUrl, 'utf8');
let action = await readFile(actionUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Duel create recovery patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Duel create recovery patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceSection(source, label, startMarker, endMarker, replacement) {
  if (source.includes(replacement)) return source;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Duel create recovery patch could not find ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

html = replaceOnce(
  html,
  'the create request timeout',
  `      const timeoutMs = action === "create" ? 12000 : 10000;`,
  `      const timeoutMs = action === "create" ? 30000 : 10000;`
);

html = replaceOnce(
  html,
  'the request timeout error',
  `      } catch (error) {
        if (error?.name === "AbortError") throw new Error("The game server took too long to respond. Please try again.");
        throw error;
      } finally {`,
  `      } catch (error) {
        if (error?.name === "AbortError") {
          const timeoutError = new Error(action === "create"
            ? "The game server is still finishing your game. Recovering it now…"
            : "The game server took too long to respond. Please try again.");
          timeoutError.code = "DUEL_TIMEOUT";
          timeoutError.action = action;
          throw timeoutError;
        }
        throw error;
      } finally {`
);

const createClientBlock = `    const DUEL_PENDING_CREATE_KEY = "duelPendingCreateV2";

    function duelCreateRandomHex(byteCount = 8) {
      const bytes = new Uint8Array(byteCount);
      try { window.crypto?.getRandomValues?.(bytes); }
      catch { for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256); }
      return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
    }

    function duelReadPendingCreate(mode, wager) {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(DUEL_PENDING_CREATE_KEY) || "null");
        const age = Date.now() - Number(parsed?.createdAt || 0);
        if (
          parsed &&
          parsed.mode === mode &&
          Number(parsed.wager) === Number(wager) &&
          /^duel-[a-z0-9_-]+-\\d{10,16}-[a-f0-9]{10,32}$/.test(String(parsed.gameId || "")) &&
          age >= 0 && age < 120000
        ) return parsed;
      } catch {}
      return null;
    }

    function duelStorePendingCreate(pending) {
      try { sessionStorage.setItem(DUEL_PENDING_CREATE_KEY, JSON.stringify(pending)); } catch {}
      return pending;
    }

    function duelClearPendingCreate() {
      try { sessionStorage.removeItem(DUEL_PENDING_CREATE_KEY); } catch {}
    }

    async function duelRecoverTimedOutCreate(gameId) {
      for (const delay of [450, 900, 1500, 2400, 3600]) {
        await new Promise(resolve => setTimeout(resolve, delay));
        try {
          const recovered = await duelRequest("get", { gameId });
          if (recovered?.game) return recovered;
        } catch (error) {
          const message = String(error?.message || "");
          if (!/not found|too long|finishing/i.test(message)) throw error;
        }
      }
      return null;
    }

    function duelAdoptCreatedGame(data, requestedMode) {
      const game = data?.game;
      if (!game?.gameId) throw new Error("The server did not return the created game.");
      duelResetGenericRuntime(null);
      duelFishingResetRuntime(null);
      duelFishingLatestGame = null;
      duelLastRenderKey = "";
      duelRememberCurrentGame(String(game.gameId));
      duelLastActiveGame = game;
      duelAcceptedStatusByGame.set(String(game.gameId), Number(DUEL_STATUS_RANK[String(game.status || "waiting")] || 0));
      if (game.mode === "roulette") {
        rouletteResetVisualRuntime(String(game.gameId));
        rouletteLatestGame = rouletteNormalizeSnapshot(game);
        rouletteAcceptedRevisionByGame.set(String(game.gameId), rouletteRevision(rouletteLatestGame));
      }
      duelRenderActive(game, true);
      if (data.resumedExisting) {
        duelSetStatus("Your existing active game was reopened instead of creating a duplicate.", "good");
      } else if (data.recoveredCreate) {
        duelSetStatus("Your game was recovered after the slow server response.", "good");
      } else {
        duelSetStatus(requestedMode === "roulette"
          ? "Duel created. Waiting for an opponent, or add the Roulette NPC for testing."
          : "Duel created. Waiting for an opponent.", "good");
      }
      return game;
    }

    async function duelCreate() {
      if (duelBusy) return;
      duelBusy = true;
      if (duelCreateBtn) duelCreateBtn.disabled = true;
      if (duelPollTimer) { clearInterval(duelPollTimer); duelPollTimer = null; }
      let pending = null;
      try {
        const mode = duelModeSelect?.value || "coin";
        const wager = Math.max(0, Math.floor(Number(duelWagerInput?.value || 0)));
        duelControlTestPlayer = false;
        pending = duelReadPendingCreate(mode, wager) || duelStorePendingCreate({
          mode,
          wager,
          createdAt: Date.now(),
          gameId: \`duel-\${mode}-\${Date.now()}-\${duelCreateRandomHex(6)}\`
        });

        duelSetStatus("Creating duel… Please wait for the server response.");
        let result;
        try {
          result = await duelRequest("create", { mode, wager, clientGameId: pending.gameId });
        } catch (error) {
          if (error?.code !== "DUEL_TIMEOUT") throw error;
          duelSetStatus("The server is still finishing your game. Checking the exact game ID now…");
          result = await duelRecoverTimedOutCreate(pending.gameId);
          if (!result?.game) {
            throw new Error("The create request is still processing. Tap Create again; the same game ID will be recovered without charging twice.");
          }
          result.recoveredCreate = true;
        }

        duelClearPendingCreate();
        duelAdoptCreatedGame(result, mode);
      } catch (error) {
        if (error?.code !== "DUEL_TIMEOUT" && !/still processing/i.test(String(error?.message || ""))) duelClearPendingCreate();
        duelSetStatus(error.message || "Unable to create duel.", "bad");
      } finally {
        duelBusy = false;
        if (duelCreateBtn) duelCreateBtn.disabled = false;
        duelSetPollRate(duelLastActiveGame || null);
      }
    }

`;

html = replaceSection(
  html,
  'the client create workflow',
  `    async function duelCreate() {`,
  `    async function duelAddSimpleNpc() {`,
  createClientBlock
);

const activeFinder = `async function duelFindActiveGameForUser(userId, excludeGameId="", options={}) {
  const viewer=cleanUserId(userId), excluded=mpCleanId(excludeGameId); if(!viewer) return null;
  const store=getUsersStore();
  try {
    const pointer=await store.get(duelActiveKey(viewer),{type:"json"});
    if(pointer?.gameId && pointer.schemaVersion===DUEL_SCHEMA_VERSION && mpCleanId(pointer.gameId)!==excluded){
      const g=await duelGetRaw(pointer.gameId);
      if(g && duelIsActiveStatus(g.status) && !duelIsExpired(g) && duelHasValidSchema(g) && [g.creator?.userId,g.joiner?.userId].map(cleanUserId).includes(viewer)) return g;
      await duelSetActivePointer(viewer,null);
    }
  } catch {}
  // Creating a game uses the authoritative active pointer only. Falling back to
  // a full Blob scan made every create increasingly slow as historical games grew.
  if(options?.scanFallback===false) return null;
  try {
    const listed=await store.list({prefix:DUEL_GAME_PREFIX});
    const entries=Array.isArray(listed?.blobs)?listed.blobs:[];
    const batchSize=8;
    for(let offset=0;offset<entries.length;offset+=batchSize){
      const batch=await Promise.all(entries.slice(offset,offset+batchSize).map(async entry=>{
        try{
          const raw=await store.get(entry.key,{type:"json"});if(!raw)return null;
          const g=duelSanitizeGame(raw);
          if(excluded&&g.gameId===excluded)return null;
          if(!duelIsActiveStatus(g.status)||duelIsExpired(g)||!duelHasValidSchema(g))return null;
          return [g.creator?.userId,g.joiner?.userId].map(cleanUserId).includes(viewer)?g:null;
        }catch{return null}
      }));
      const found=batch.find(Boolean);
      if(found){await duelSetActivePointer(viewer,found);return found}
    }
  } catch {}
  return null;
}


`;

data = replaceSection(
  data,
  'the active-game finder',
  `async function duelFindActiveGameForUser(userId, excludeGameId="") {`,
  `function duelSanitizePlayer(player = {}) {`,
  activeFinder
);

const createServerBlock = `function duelClientCreateGameId(mode, value) {
  const candidate=mpCleanId(value||"");
  if(!candidate)return "";
  const pattern=new RegExp(\`^duel-\${mode}-\\\\d{10,16}-[a-f0-9]{10,32}$\`);
  return pattern.test(candidate)?candidate:"";
}

async function duelCreateGame(user, details = {}) {
  await duelEnsureSchemaMigration();
  const mode = String(details.mode || "coin").toLowerCase();
  if (!DUEL_MODES[mode]) throw new Error("Choose a valid multiplayer arcade game.");
  const wager = int(details.wager, 0);
  if (wager < DUEL_VALID_WAGER_MIN || wager > DUEL_VALID_WAGER_MAX || wager % TICKETS_PER_XAN !== 0) {
    throw new Error("Choose a wager from 1,000 to 50,000 Tickets in 1,000 Ticket increments.");
  }

  const suppliedClientGameId=String(details.clientGameId||"").trim();
  const clientGameId=duelClientCreateGameId(mode,suppliedClientGameId);
  if(suppliedClientGameId&&!clientGameId)throw new Error("The create request ID was invalid. Please try again.");

  if(clientGameId){
    const existing=await duelGetRaw(clientGameId);
    if(existing){
      const clean=duelSanitizeGame(existing);
      if(cleanUserId(clean.creator?.userId)!==cleanUserId(user.id)||clean.mode!==mode||Number(clean.wager)!==wager){
        throw new Error("That create request ID belongs to a different game.");
      }
      const record=await getUserRecord(user.id);
      return {game:duelPublicGame(clean,user.id),record,recoveredCreate:true};
    }
  }

  const activeGame = await duelFindActiveGameForUser(user.id,"",{scanFallback:false});
  if (activeGame) {
    return {game:duelPublicGame(activeGame,user.id),record:await getUserRecord(user.id),resumedExisting:true};
  }

  let record = await getUserRecord(user.id);
  record = prepareLedgerRecord(record || { userId: String(user.id), name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(\`You need \${formatTickets(wager)} to create this duel.\`);
  const at = nowIso();
  const gameId = clientGameId || \`duel-\${mode}-\${Date.now()}-\${crypto.randomBytes(5).toString("hex")}\`;
  const ledgerId = \`duel:\${gameId}:creator-escrow\`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "duel_escrow",
    delta: -wager,
    amount: wager,
    at,
    reason: \`Created \${DUEL_MODES[mode]} \${gameId}\`,
    meta: { gameId, mode, role: "creator" }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + (ledgerResult.added ? wager : 0),
    recentEvents: ledgerResult.added ? addEvent(ledgerResult.record.recentEvents || [], {
      type: "duel_create",
      at,
      gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: \`\${user.name || "Unknown"} created \${DUEL_MODES[mode]} for \${formatTickets(wager)}.\`
    }) : (ledgerResult.record.recentEvents || [])
  }));
  const game = await duelSaveGame({
    schemaVersion: DUEL_SCHEMA_VERSION,
    gameId,
    mode,
    modeName: DUEL_MODES[mode],
    status: "waiting",
    wager,
    pot: wager,
    createdAt: at,
    updatedAt: at,
    creator: duelSanitizePlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    joiner: null,
    actions: {},
    ledgerIds: { creator: ledgerId }
  });
  return { game: duelPublicGame(game, saved.userId), record: saved, recoveredCreate:false };
}

`;

data = replaceSection(
  data,
  'the server create workflow',
  `async function duelCreateGame(user, details = {}) {`,
  `async function duelCancelGame(user, gameId) {`,
  createServerBlock
);

action = replaceOnce(
  action,
  'the create handler payload',
  `else if (action === "create") result = await duelCreateGame(user, { mode: body.mode, wager: body.wager, lastWithdrawal: body.lastWithdrawal });`,
  `else if (action === "create") result = await duelCreateGame(user, { mode: body.mode, wager: body.wager, lastWithdrawal: body.lastWithdrawal, clientGameId: body.clientGameId });`
);

for (const required of [
  'const timeoutMs = action === "create" ? 30000 : 10000;',
  'timeoutError.code = "DUEL_TIMEOUT";',
  'const DUEL_PENDING_CREATE_KEY = "duelPendingCreateV2";',
  'clientGameId: pending.gameId',
  'duelRecoverTimedOutCreate(pending.gameId)',
  'Your existing active game was reopened instead of creating a duplicate.'
]) if (!html.includes(required)) throw new Error(`Final create client is missing ${required}`);

for (const forbidden of [
  'const timeoutMs = action === "create" ? 12000 : 10000;',
  'Finish or cancel your current game before creating another one.'
]) if (html.includes(forbidden)) throw new Error(`Old create client behavior remains: ${forbidden}`);

for (const required of [
  'if(options?.scanFallback===false) return null;',
  'function duelClientCreateGameId(mode, value)',
  'recoveredCreate:true',
  'resumedExisting:true',
  'totalWagered: int(ledgerResult.record.totalWagered, 0) + (ledgerResult.added ? wager : 0)'
]) if (!data.includes(required)) throw new Error(`Final create server is missing ${required}`);

if (!action.includes('clientGameId: body.clientGameId')) throw new Error('The create handler does not forward the client game ID.');

await writeFile(indexUrl, html);
await writeFile(dataUrl, data);
await writeFile(actionUrl, action);
console.log('Patched duel creation: fast pointer-only checks, idempotent client game IDs, timeout recovery, and existing-game resume.');
