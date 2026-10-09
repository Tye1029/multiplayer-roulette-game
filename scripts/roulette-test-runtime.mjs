import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Run the production rules with isolated persistence and deterministic chambers.
// No account, real balance, network service, or payout is accessed by this fixture.
export async function rouletteTestRuntime() {
  const source = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
  let game;
  const context = vm.createContext({
    console: { log() {} }, Date, Math,
    crypto: { randomInt: () => 6, randomBytes: () => ({ toString: () => 'fixture-cycle' }) },
    cleanUserId: value => String(value || ''), mpCleanId: value => String(value || ''),
    withRouletteLock: async (_id, task) => task(),
    duelSanitizeGame: value => structuredClone(value),
    duelGetRaw: async () => game,
    duelSaveGame: async value => (game = value),
    getUserRecord: async () => ({}),
    duelPublicGame: (value, viewer) => ({ ...value, isCreator: viewer === 'alice', rouletteState: context.roulettePublicState(value, viewer) }),
    int: (value, fallback) => Number(value || fallback),
    getGameOddsSettings: async () => ({ multiplayer: { houseCutPercent: 0 } }),
    mpRealGamePayout: pot => ({ payout: pot, houseCut: 0 }),
    duelPayPlayer: async () => {}, formatTickets: String, nowIso: () => new Date().toISOString()
  });
  vm.runInContext(source.slice(source.indexOf('function roulettePlayerIds('), source.indexOf('// ---------------- Rumble Fishing Duel')), context);
  return {
    rules: context,
    reset() {
      game = { gameId: `roulette-fixture-${Date.now()}`, mode: 'roulette', status: 'playing', revision: 1,
        creator: { userId: 'alice', name: 'Alice' }, joiner: { userId: 'bob', name: 'Remote Bot', isNpc: true },
        ready: { alice: true, bob: true }, startAt: new Date(Date.now() - 10000).toISOString(), pot: 0, wager: 0 };
      game.rouletteState = context.rouletteInitialState(game);
      game.rouletteState.turnId = 'alice'; game.rouletteState.openingSpinWinnerId = 'alice';
      return game;
    },
    get: () => game,
    set: value => (game = value),
    public: () => context.duelPublicGame(game, 'alice'),
    act: (choice, actor = 'alice', details = {}) => context.rouletteAction({ id: actor }, game.gameId, choice, details)
  };
}
