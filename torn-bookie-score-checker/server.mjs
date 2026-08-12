import http from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v3";

const PORT = Number(process.env.PORT || 3000);
const VERSION = "0.2.0";
const TEMPLATE_URI = "ui://torn-bookie/score-tracker-v2.html";
const SPORT_SCORE_BASE = "https://sportscore.com";
const SPORT_SCORE_MATCHES = `${SPORT_SCORE_BASE}/api/widget/matches/`;
const SPORT_SCORE_MATCH = `${SPORT_SCORE_BASE}/api/widget/match/`;
const SPORTS_DB_BASE = "https://www.thesportsdb.com";
const SPORTS_DB_SEARCH = `${SPORTS_DB_BASE}/api/v1/json/123/searchevents.php`;
const SRC = "torn-bookie-chatgpt-score-app";
const SPORT_SCORE_SPORTS = new Set(["tennis", "football", "basketball", "cricket"]);
const SPECIAL_STATUS_KINDS = new Set([
  "DELAYED", "SUSPENDED", "POSTPONED", "CANCELLED", "ABANDONED", "WALKOVER"
]);

const DEFAULT_BETS = [
  {
    eventId: "6011053",
    sport: "tennis",
    matchup: "Lilli Tagger vs Robin Montgomery",
    pick: "Lilli Tagger",
    market: "ML",
    odds: 1.57,
    stake: 1000000,
    winCondition: "Lilli Tagger must win the match."
  },
  {
    eventId: "6011192",
    sport: "tennis",
    matchup: "Nicolai Budkov Kjaer vs Kyrian Jacquet",
    pick: "Kyrian Jacquet",
    market: "ML",
    odds: 1.50,
    stake: 1000000,
    winCondition: "Kyrian Jacquet must win the match."
  }
];

const betSchema = z.object({
  eventId: z.string().optional().default(""),
  eventDate: z.string().optional().default(""),
  sport: z.string().optional().default("tennis"),
  matchup: z.string().min(3),
  pick: z.string().min(1),
  market: z.string().optional().default("ML"),
  odds: z.number().positive(),
  stake: z.number().nonnegative(),
  winCondition: z.string().optional().default("")
});

const statusKindSchema = z.enum([
  "LIVE",
  "UPCOMING",
  "FINAL",
  "DELAYED",
  "SUSPENDED",
  "POSTPONED",
  "CANCELLED",
  "ABANDONED",
  "WALKOVER",
  "UNKNOWN"
]);

const checkedBetSchema = z.object({
  eventId: z.string(),
  eventDate: z.string(),
  sport: z.string(),
  matchup: z.string(),
  pick: z.string(),
  market: z.string(),
  odds: z.number(),
  stake: z.number(),
  winCondition: z.string(),
  found: z.boolean(),
  status: z.string(),
  statusKind: statusKindSchema,
  player1: z.string(),
  player2: z.string(),
  player1Score: z.string(),
  player2Score: z.string(),
  scoreText: z.string(),
  setsText: z.string(),
  competition: z.string(),
  startTime: z.string(),
  sourceUrl: z.string(),
  provider: z.string(),
  sourcesChecked: z.array(z.string()),
  result: z.enum(["WIN", "LOSS", "PENDING", "UNKNOWN"]),
  note: z.string()
});

const trackerOutputSchema = {
  checkedAt: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  bets: z.array(checkedBetSchema),
  summary: z.object({
    pending: z.number().int(),
    wins: z.number().int(),
    losses: z.number().int(),
    totalStake: z.number(),
    potentialReturn: z.number()
  })
};

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sportKey(value) {
  const s = normalize(value).replace(/\s+/g, "-");
  const aliases = new Map([
    ["soccer", "football"],
    ["association-football", "football"],
    ["ice-hockey", "hockey"],
    ["counter-strike-2", "counter-strike"],
    ["cs2", "counter-strike"],
    ["cs-go", "counter-strike"],
    ["league-of-legends", "lol"],
    ["american-football", "american-football"]
  ]);
  return aliases.get(s) || s || "unknown";
}

function splitMatchup(matchup) {
  const parts = clean(matchup).split(/\s+(?:v|vs\.?|versus)\s+/i).map(clean).filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(" vs ")] : [clean(matchup), ""];
}

function surname(name) {
  const p = normalize(name).split(" ").filter(Boolean);
  return p.at(-1) || "";
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-");
}

function getPath(obj, path) {
  let cur = obj;
  for (const key of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

function firstValue(obj, paths) {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function nameOf(value) {
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (!value || typeof value !== "object") return "";
  return clean(firstValue(value, [
    "name", "title", "shortName", "short_name", "displayName", "display_name",
    "player_name", "team_name", "strTeam", "strPlayer"
  ]));
}

function scoreOf(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (Array.isArray(value)) return value.map(scoreOf).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const preferred = firstValue(value, ["display", "current", "total", "value", "score", "games", "sets"]);
    if (preferred !== undefined) return scoreOf(preferred);
    const scalars = Object.values(value).filter(v => typeof v === "string" || typeof v === "number");
    if (scalars.length && scalars.length <= 6) return scalars.map(clean).join(" ");
  }
  return "";
}

function flattenStrings(value, out = [], depth = 0, seen = new Set()) {
  if (value == null || out.length > 300 || depth > 5) return out;
  if (typeof value === "string" || typeof value === "number") {
    const s = clean(value);
    if (s) out.push(s);
    return out;
  }
  if (typeof value !== "object" || seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) flattenStrings(child, out, depth + 1, seen);
  } else {
    for (const child of Object.values(value).slice(0, 100)) flattenStrings(child, out, depth + 1, seen);
  }
  return out;
}

function matchScore(match, playerA, playerB) {
  const hay = normalize(flattenStrings(match).join(" | "));
  const a = normalize(playerA);
  const b = normalize(playerB);
  const sa = surname(playerA);
  const sb = surname(playerB);
  let score = 0;
  if (a && hay.includes(a)) score += 6;
  else if (sa && hay.includes(sa)) score += 2;
  if (b && hay.includes(b)) score += 6;
  else if (sb && hay.includes(sb)) score += 2;
  if (a && b && hay.includes(a) && hay.includes(b)) score += 6;
  return score;
}

function extractSide(match, side) {
  const keys = side === 1
    ? ["home", "homeTeam", "home_team", "player1", "player_1", "firstPlayer", "first_player", "participant1", "participant_1", "competitor1", "competitor_1", "team1", "team_1", "strHomeTeam"]
    : ["away", "awayTeam", "away_team", "player2", "player_2", "secondPlayer", "second_player", "participant2", "participant_2", "competitor2", "competitor_2", "team2", "team_2", "strAwayTeam"];
  for (const key of keys) {
    if (match?.[key] !== undefined) {
      const n = nameOf(match[key]);
      if (n) return n;
    }
  }
  return "";
}

function extractSideScore(match, side) {
  const paths = side === 1
    ? ["homeScore", "home_score", "score.home", "scores.home", "score1", "score_1", "player1Score", "player_1_score", "firstScore", "first_score", "intHomeScore"]
    : ["awayScore", "away_score", "score.away", "scores.away", "score2", "score_2", "player2Score", "player_2_score", "secondScore", "second_score", "intAwayScore"];
  return scoreOf(firstValue(match, paths));
}

function extractSetText(match) {
  const value = firstValue(match, ["sets", "setScores", "set_scores", "periods", "scores.sets", "score.sets", "tennisScore", "tennis_score"]);
  if (value == null) return "";
  if (typeof value === "string") return clean(value);
  try {
    if (Array.isArray(value)) {
      return value.slice(0, 7).map((s, i) => {
        if (s && typeof s === "object") {
          const a = firstValue(s, ["home", "player1", "first", "score1", "score_1", "a"]);
          const b = firstValue(s, ["away", "player2", "second", "score2", "score_2", "b"]);
          if (a !== undefined || b !== undefined) return `S${i + 1} ${clean(a)}-${clean(b)}`;
        }
        return scoreOf(s);
      }).filter(Boolean).join(" · ");
    }
    return clean(JSON.stringify(value)).slice(0, 180);
  } catch {
    return "";
  }
}

function classifyStatus(raw) {
  const s = normalize(raw);
  if (!s) return "UNKNOWN";

  // Explicit disruption states first so words like "started" inside a long message cannot override them.
  if (/(rain delay|weather delay|delayed|delay|waiting for weather|weather interruption)/.test(s)) return "DELAYED";
  if (/(suspended|susp|interrupted|interrupt|intr\b|\bint\b)/.test(s)) return "SUSPENDED";
  if (/(postponed|rescheduled|\bpst\b|\bpost\b)/.test(s)) return "POSTPONED";
  if (/(cancelled|canceled|\bcanc\b)/.test(s)) return "CANCELLED";
  if (/(abandoned|\babd\b)/.test(s)) return "ABANDONED";
  if (/(walkover|walk over|\bwo\b)/.test(s)) return "WALKOVER";

  if (/(finished|final|ended|complete|completed|after match|match finished|game finished|\bft\b|\baet\b|\baot\b|\bap\b|\bpen\b|awarded|\bawd\b|\baw\b)/.test(s)) return "FINAL";
  if (/(live|in progress|inprogress|playing|started|set \d|break|halftime|half time|overtime|extra time|penalty in progress|\bq[1-4]\b|\b[12]h\b|\bot\b|\bht\b|\bet\b|\bbt\b|\bpt\b|\bs[1-7]\b|\bin[1-9]\b)/.test(s)) return "LIVE";
  if (/(scheduled|not started|notstarted|upcoming|fixture|pending|time to be defined|\bns\b|\btbd\b)/.test(s)) return "UPCOMING";
  return "UNKNOWN";
}

function extractStatus(match) {
  const status = clean(firstValue(match, [
    "status", "state", "matchStatus", "match_status", "statusText", "status_text", "phase", "strStatus"
  ]));
  const progress = clean(firstValue(match, ["progress", "strProgress"]));
  const postponed = normalize(firstValue(match, ["postponed", "strPostponed"]));
  if (["yes", "true", "1"].includes(postponed) && classifyStatus(status) !== "POSTPONED") {
    return status ? `Postponed · ${status}` : "Postponed";
  }
  if (status && progress && normalize(status) !== normalize(progress)) return `${status} · ${progress}`;
  return status || progress || "Unknown";
}

function winnerFromMatch(match, player1, player2, p1Score, p2Score) {
  const explicit = nameOf(firstValue(match, ["winner", "winnerName", "winner_name", "winningPlayer", "winning_player"]));
  if (explicit) return explicit;
  const winnerId = firstValue(match, ["winnerId", "winner_id"]);
  if (winnerId !== undefined) {
    const homeId = firstValue(match, ["home.id", "homeTeam.id", "home_team.id", "player1.id", "player_1.id", "idHomeTeam"]);
    const awayId = firstValue(match, ["away.id", "awayTeam.id", "away_team.id", "player2.id", "player_2.id", "idAwayTeam"]);
    if (String(winnerId) === String(homeId)) return player1;
    if (String(winnerId) === String(awayId)) return player2;
  }
  if (/^\d+(?:\.\d+)?$/.test(p1Score) && /^\d+(?:\.\d+)?$/.test(p2Score)) {
    const a = Number(p1Score), b = Number(p2Score);
    if (a !== b) return a > b ? player1 : player2;
  }
  return "";
}

function sportScoreSourceUrl(match, sport) {
  const url = clean(firstValue(match, ["url", "matchUrl", "match_url"]));
  if (/^https?:\/\//i.test(url)) return url;
  const slug = clean(firstValue(match, ["slug", "match_slug"]));
  return slug ? `${SPORT_SCORE_BASE}/${sport}/match/${slug.replace(/^\/+|\/+$/g, "")}/` : `${SPORT_SCORE_BASE}/${sport}/`;
}

function sportsDbSourceUrl(match) {
  const id = clean(firstValue(match, ["idEvent", "id"]));
  return id ? `${SPORTS_DB_BASE}/event/${encodeURIComponent(id)}` : SPORTS_DB_BASE;
}

function normalizeMatch(match, bet, provider, sport) {
  const [fallback1, fallback2] = splitMatchup(bet.matchup);
  const player1 = extractSide(match, 1) || fallback1;
  const player2 = extractSide(match, 2) || fallback2;
  const player1Score = extractSideScore(match, 1);
  const player2Score = extractSideScore(match, 2);
  const genericScore = scoreOf(firstValue(match, ["scoreText", "score_text", "score", "currentScore", "current_score", "intEventScore"]));
  const scoreText = (player1Score || player2Score) ? `${player1Score || "—"} – ${player2Score || "—"}` : genericScore;
  const status = extractStatus(match);
  const statusKind = classifyStatus(status);
  const setsText = extractSetText(match);
  const competition = nameOf(firstValue(match, ["competition", "tournament", "league"])) || clean(firstValue(match, [
    "competitionName", "competition_name", "tournamentName", "tournament_name", "leagueName", "league_name", "strLeague"
  ]));
  const date = clean(firstValue(match, ["dateEvent", "dateEventLocal"]));
  const time = clean(firstValue(match, ["strTime", "strTimeLocal"]));
  const startTime = clean(firstValue(match, [
    "startTime", "start_time", "startTimestamp", "start_timestamp", "strTimestamp", "scheduledAt", "scheduled_at"
  ])) || [date, time].filter(Boolean).join(" ");
  const sourceUrl = provider === "TheSportsDB" ? sportsDbSourceUrl(match) : sportScoreSourceUrl(match, sport);
  const winner = statusKind === "FINAL" ? winnerFromMatch(match, player1, player2, player1Score, player2Score) : "";
  return { player1, player2, player1Score, player2Score, scoreText, status, statusKind, setsText, competition, startTime, sourceUrl, winner, provider };
}

function isMoneylineMarket(market) {
  const m = normalize(market);
  return ["ml", "moneyline", "money line", "match winner", "winner"].includes(m);
}

function settleResult(bet, norm) {
  if (!norm) return "PENDING";
  if (norm.statusKind !== "FINAL") return "PENDING";
  if (!isMoneylineMarket(bet.market)) return "UNKNOWN";
  if (!norm.winner) return "UNKNOWN";
  const pick = normalize(bet.pick);
  const winner = normalize(norm.winner);
  if (pick === winner || (surname(bet.pick) && surname(bet.pick) === surname(norm.winner))) return "WIN";
  return "LOSS";
}

async function fetchJson(url, label, timeoutMs = 10000) {
  const response = await fetch(url, {
    headers: { "User-Agent": `TornBookieChatGPTScoreApp/${VERSION}` },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return response.json();
}

async function fetchSportScoreMatches(sport) {
  if (!SPORT_SCORE_SPORTS.has(sport)) return [];
  const url = new URL(SPORT_SCORE_MATCHES);
  url.searchParams.set("sport", sport);
  url.searchParams.set("limit", "50");
  url.searchParams.set("src", SRC);
  const data = await fetchJson(url, "SportScore");
  const matches = data?.matches ?? data?.events ?? data?.data ?? [];
  return Array.isArray(matches) ? matches : [];
}

function unwrapSingleMatch(data) {
  const candidate = data?.match ?? data?.event ?? data?.data ?? data;
  if (Array.isArray(candidate)) return candidate[0] || null;
  return candidate && typeof candidate === "object" ? candidate : null;
}

async function fetchSportScoreDirect(sport, bet) {
  if (!SPORT_SCORE_SPORTS.has(sport)) return null;
  const [a, b] = splitMatchup(bet.matchup);
  const slugs = [
    `${slugify(a)}-vs-${slugify(b)}`,
    `${slugify(b)}-vs-${slugify(a)}`
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  for (const slug of slugs) {
    const url = new URL(SPORT_SCORE_MATCH);
    url.searchParams.set("sport", sport);
    url.searchParams.set("slug", slug);
    url.searchParams.set("src", SRC);
    try {
      const data = await fetchJson(url, "SportScore", 8000);
      const match = unwrapSingleMatch(data);
      if (match && matchScore(match, a, b) >= 8) return match;
    } catch {
      // Candidate slugs are best-effort. A 404 just means try the next orientation/provider.
    }
  }
  return null;
}

function eventDateMs(match) {
  const raw = clean(firstValue(match, ["strTimestamp", "dateEventLocal", "dateEvent"]));
  if (!raw) return NaN;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00Z` : raw;
  return Date.parse(iso);
}

function isCurrentEnough(match, bet) {
  const eventMs = eventDateMs(match);
  if (!Number.isFinite(eventMs)) return true;
  if (bet.eventDate) {
    const wanted = Date.parse(`${bet.eventDate}T12:00:00Z`);
    if (Number.isFinite(wanted)) return Math.abs(eventMs - wanted) <= 2 * 86400000;
  }
  return Math.abs(eventMs - Date.now()) <= 30 * 86400000;
}

async function fetchSportsDbEvent(bet) {
  const [a, b] = splitMatchup(bet.matchup);
  const url = new URL(SPORTS_DB_SEARCH);
  url.searchParams.set("e", `${a}_vs_${b}`.replace(/\s+/g, "_"));
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean(bet.eventDate))) url.searchParams.set("d", clean(bet.eventDate));
  const data = await fetchJson(url, "TheSportsDB", 10000);
  const events = data?.event ?? data?.events ?? [];
  const list = Array.isArray(events) ? events : events ? [events] : [];
  let best = null;
  let bestScore = -1;
  for (const event of list) {
    if (!isCurrentEnough(event, bet)) continue;
    const score = matchScore(event, a, b);
    if (score > bestScore) {
      bestScore = score;
      best = event;
    }
  }
  return best && bestScore >= 8 ? best : null;
}

function statusPriority(kind) {
  if (kind === "FINAL") return 100;
  if (kind === "LIVE") return 95;
  if (SPECIAL_STATUS_KINDS.has(kind)) return 90;
  if (kind === "UPCOMING") return 50;
  return 0;
}

function mergeNorms(a, b) {
  if (!a) return b;
  if (!b) return a;
  const statusSource = statusPriority(b.statusKind) > statusPriority(a.statusKind) ? b : a;
  const scoreSource = (a.player1Score || a.player2Score || a.setsText) ? a : b;
  const providerNames = [...new Set([a.provider, b.provider].filter(Boolean))];
  return {
    ...statusSource,
    player1: scoreSource.player1 || statusSource.player1,
    player2: scoreSource.player2 || statusSource.player2,
    player1Score: scoreSource.player1Score || statusSource.player1Score,
    player2Score: scoreSource.player2Score || statusSource.player2Score,
    scoreText: scoreSource.scoreText || statusSource.scoreText,
    setsText: scoreSource.setsText || statusSource.setsText,
    competition: statusSource.competition || scoreSource.competition,
    startTime: statusSource.startTime || scoreSource.startTime,
    provider: providerNames.join(" + "),
    winner: statusSource.winner || scoreSource.winner
  };
}

function findBestMatch(matches, bet) {
  const [a, b] = splitMatchup(bet.matchup);
  let best = null;
  let bestScore = -1;
  for (const match of matches) {
    const score = matchScore(match, a, b);
    if (score > bestScore) {
      bestScore = score;
      best = match;
    }
  }
  return best && bestScore >= 8 ? best : null;
}

async function checkOneBet(bet, sport, sportScoreMatches, sportScoreListError) {
  const [a, b] = splitMatchup(bet.matchup);
  const sourcesChecked = [];
  const notes = [];
  let sportScoreNorm = null;
  let sportsDbNorm = null;

  if (SPORT_SCORE_SPORTS.has(sport)) {
    sourcesChecked.push("SportScore");
    if (sportScoreListError) notes.push(sportScoreListError);
    const listMatch = findBestMatch(sportScoreMatches, bet);
    let sportScoreMatch = listMatch;
    if (!sportScoreMatch) sportScoreMatch = await fetchSportScoreDirect(sport, bet);
    if (sportScoreMatch) sportScoreNorm = normalizeMatch(sportScoreMatch, bet, "SportScore", sport);
  }

  // TheSportsDB is a broad fallback. We use it when SportScore cannot identify the event,
  // or when SportScore only says upcoming/unknown and a disruption may explain the lack of score movement.
  if (!sportScoreNorm || ["UNKNOWN", "UPCOMING"].includes(sportScoreNorm.statusKind)) {
    sourcesChecked.push("TheSportsDB");
    try {
      const sportsDbEvent = await fetchSportsDbEvent(bet);
      if (sportsDbEvent) sportsDbNorm = normalizeMatch(sportsDbEvent, bet, "TheSportsDB", sport);
    } catch (error) {
      notes.push(clean(error?.message || error));
    }
  }

  const norm = mergeNorms(sportScoreNorm, sportsDbNorm);
  const found = Boolean(norm);
  const result = settleResult(bet, norm);

  if (!found) {
    if (!notes.length) notes.push("No confident current match was found in the available score/status sources.");
  } else if (SPECIAL_STATUS_KINDS.has(norm.statusKind)) {
    notes.push(`Event status detected: ${norm.status}.`);
  } else if (norm.statusKind === "FINAL" && result === "UNKNOWN" && !isMoneylineMarket(bet.market)) {
    notes.push("Final score found, but this market is not auto-settled by v0.2; use the displayed score and win condition.");
  } else {
    notes.push(`Latest match data returned by ${norm.provider}.`);
  }

  return {
    eventId: clean(bet.eventId),
    eventDate: clean(bet.eventDate),
    sport,
    matchup: clean(bet.matchup),
    pick: clean(bet.pick),
    market: clean(bet.market || "ML"),
    odds: Number(bet.odds),
    stake: Number(bet.stake),
    winCondition: clean(bet.winCondition || `${bet.pick} must win the match.`),
    found,
    status: norm?.status || (notes.some(n => /returned HTTP|error/i.test(n)) ? "Source error" : "Not found"),
    statusKind: norm?.statusKind || "UNKNOWN",
    player1: norm?.player1 || a,
    player2: norm?.player2 || b,
    player1Score: norm?.player1Score || "",
    player2Score: norm?.player2Score || "",
    scoreText: norm?.scoreText || "",
    setsText: norm?.setsText || "",
    competition: norm?.competition || "",
    startTime: norm?.startTime || "",
    sourceUrl: norm?.sourceUrl || (SPORT_SCORE_SPORTS.has(sport) ? `${SPORT_SCORE_BASE}/${sport}/` : SPORTS_DB_BASE),
    provider: norm?.provider || "",
    sourcesChecked: [...new Set(sourcesChecked)],
    result,
    note: notes.join(" ")
  };
}

async function checkBets(inputBets) {
  const bets = inputBets?.length ? inputBets : DEFAULT_BETS;
  const bySport = new Map();
  for (const bet of bets) {
    const sport = sportKey(bet.sport || "tennis");
    if (!bySport.has(sport)) bySport.set(sport, []);
    bySport.get(sport).push(bet);
  }

  const checked = [];
  for (const [sport, sportBets] of bySport) {
    let sportScoreMatches = [];
    let sportScoreListError = "";
    if (SPORT_SCORE_SPORTS.has(sport)) {
      try {
        sportScoreMatches = await fetchSportScoreMatches(sport);
      } catch (error) {
        sportScoreListError = clean(error?.message || error);
      }
    }
    for (const bet of sportBets) {
      checked.push(await checkOneBet(bet, sport, sportScoreMatches, sportScoreListError));
    }
  }

  const summary = {
    pending: checked.filter(b => b.result === "PENDING" || b.result === "UNKNOWN").length,
    wins: checked.filter(b => b.result === "WIN").length,
    losses: checked.filter(b => b.result === "LOSS").length,
    totalStake: checked.reduce((sum, b) => sum + b.stake, 0),
    potentialReturn: checked.filter(b => b.result === "PENDING" || b.result === "UNKNOWN").reduce((sum, b) => sum + b.stake * b.odds, 0)
  };

  return {
    checkedAt: new Date().toISOString(),
    source: "SportScore + TheSportsDB",
    sourceUrl: SPORT_SCORE_BASE,
    bets: checked,
    summary
  };
}

const widgetHtml = readFileSync(new URL("./widget.html", import.meta.url), "utf8").trim();

function createServer() {
  const server = new McpServer(
    { name: "Torn Bookie Score Tracker", version: VERSION },
    { instructions: "Use render_score_tracker to display pending Torn Bookie bets. The widget's Check Scores Now button calls check_scores directly for fresh read-only score and event-status data. The checker uses SportScore first where supported and TheSportsDB as a broad fallback." }
  );

  server.registerResource("torn-bookie-score-widget", TEMPLATE_URI, {}, async () => ({
    contents: [{
      uri: TEMPLATE_URI,
      mimeType: "text/html;profile=mcp-app",
      text: widgetHtml,
      _meta: {
        ui: {
          prefersBorder: true,
          csp: {
            connectDomains: [],
            resourceDomains: ["https://sportscore.com", "https://www.thesportsdb.com"]
          }
        }
      }
    }]
  }));

  server.registerTool(
    "check_scores",
    {
      title: "Check pending bet scores and statuses",
      description: "Fetch current/recent scores and event statuses for supplied Torn Bookie bets. Detects delay/suspension/postponement/cancellation states when a provider exposes them. SportScore is primary for tennis, football, basketball and cricket; TheSportsDB is used as a broad multi-sport fallback. Read-only.",
      inputSchema: { bets: z.array(betSchema).max(25).optional().default(DEFAULT_BETS) },
      outputSchema: trackerOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
      _meta: {
        "openai/toolInvocation/invoking": "Checking scores and event status…",
        "openai/toolInvocation/invoked": "Scores and statuses checked."
      }
    },
    async ({ bets }) => {
      const result = await checkBets(bets);
      return {
        structuredContent: result,
        content: [{ type: "text", text: `Checked ${result.bets.length} pending bet(s) at ${result.checkedAt}.` }]
      };
    }
  );

  server.registerTool(
    "render_score_tracker",
    {
      title: "Show Torn Bookie score tracker",
      description: "Render the one-click Torn Bookie pending-bet score tracker. Pass the user's current pending bets when known; otherwise the two August 12 tennis bets are used as defaults.",
      inputSchema: { bets: z.array(betSchema).max(25).optional().default(DEFAULT_BETS) },
      outputSchema: trackerOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Opening score tracker…",
        "openai/toolInvocation/invoked": "Score tracker ready."
      }
    },
    async ({ bets }) => {
      const chosen = bets?.length ? bets : DEFAULT_BETS;
      const initial = {
        checkedAt: "",
        source: "SportScore + TheSportsDB",
        sourceUrl: SPORT_SCORE_BASE,
        bets: chosen.map(bet => {
          const [player1, player2] = splitMatchup(bet.matchup);
          return {
            eventId: clean(bet.eventId),
            eventDate: clean(bet.eventDate),
            sport: sportKey(bet.sport || "tennis"),
            matchup: clean(bet.matchup),
            pick: clean(bet.pick),
            market: clean(bet.market || "ML"),
            odds: Number(bet.odds),
            stake: Number(bet.stake),
            winCondition: clean(bet.winCondition || `${bet.pick} must win the match.`),
            found: false,
            status: "Ready to check",
            statusKind: "UNKNOWN",
            player1,
            player2,
            player1Score: "",
            player2Score: "",
            scoreText: "",
            setsText: "",
            competition: "",
            startTime: "",
            sourceUrl: SPORT_SCORE_SPORTS.has(sportKey(bet.sport || "tennis")) ? `${SPORT_SCORE_BASE}/${sportKey(bet.sport || "tennis")}/` : SPORTS_DB_BASE,
            provider: "",
            sourcesChecked: [],
            result: "PENDING",
            note: "Tap Check Scores Now for a fresh multi-source lookup."
          };
        }),
        summary: {
          pending: chosen.length,
          wins: 0,
          losses: 0,
          totalStake: chosen.reduce((s,b) => s + Number(b.stake || 0), 0),
          potentialReturn: chosen.reduce((s,b) => s + Number(b.stake || 0) * Number(b.odds || 0), 0)
        }
      };
      return {
        structuredContent: initial,
        content: [{ type: "text", text: `Showing ${initial.bets.length} pending Torn Bookie bet(s). Use the button to refresh scores and statuses.` }]
      };
    }
  );

  return server;
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, app: "Torn Bookie Score Tracker", version: VERSION }));
    return;
  }
  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
    return;
  }

  const mcp = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: false
  });
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "MCP request failed" }));
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    try { await transport.close(); } catch {}
    try { await mcp.close(); } catch {}
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Torn Bookie Score Tracker v${VERSION} listening on :${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
