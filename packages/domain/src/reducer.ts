/**
 * Réducteur pur du journal d'événements (event sourcing) et sélecteurs dérivés.
 *
 * Règles implémentées (voir `TournamentEvent` dans types.ts) :
 * - `tournament.created` : info, billards et paramètres.
 * - `players.imported` : remplace les joueurs (triés par `seed`) et calcule `masters` =
 *   les `rules.mastersPrequalified` premiers (SPEC §2).
 * - `billards.assigned` : mémorise les billards par phase (clé = numéro de poule pour PREQ/QN/QM,
 *   id de match pour B/N/M/CLS) et les applique aux structures existantes ; ils sont aussi
 *   appliqués aux structures dérivées plus tard.
 * - `poules.drawn` : remplace les poules de la phase (les matchs manquants sont générés).
 * - `score.entered` : modifie le match dans la bonne phase (poules PREQ/QN/QM, `barrages`,
 *   `brackets` N/M/CLS) ; sur un tableau, les vainqueurs avancent (`advanceBracket`).
 * - `forfait.declared` : enregistre le forfait ; pour un barrage ou un tableau, le match en
 *   attente du joueur est marqué `forfait` et ses points sont écrits comme le fait l'outil Excel
 *   (SPEC §5) : la distance pour l'adversaire, et pour le forfait la moyenne des points subis par
 *   l'adversaire dans les phases précédentes, ramenée à la distance en cours (`walkoverPoints`).
 *   Dans une phase de poules, le même barème est fourni à `rankPhase` (`forfaitSubisOf`).
 * - `phase.closed` : `closed[phase] = true` et dérivation : PREQ → `barrages` (rankPhase +
 *   barragePairs) ; B → `poules.QM` (composeMasters) et `poules.QN` (composeNational, perdants
 *   ordonnés par le classement cumulé des barrages, puis places 17 à 40) ; QN → `brackets.N`
 *   (nationalR16 puis advanceBracket) ; QM → `brackets.M` (mastersQF puis advanceBracket) ;
 *   CLS → `brackets.CLS` est laissé tel quel. Fermer une phase déjà fermée ne fait rien.
 * - `phase.reopened` : efface `closed[phase]` et les structures dérivées en aval (PREQ →
 *   barrages, poules QN/QM, tableaux N/M ; B → poules QN/QM et tableaux N/M ; QN → tableau N ;
 *   QM → tableau M), ainsi que leurs fermetures.
 * - `consolante.created` : `brackets.CLS` (au plus `rules.consolanteMax` joueurs, les suivants
 *   sont ignorés).
 * - `arbitre.set` : numéro de licence de l'arbitre sur le match.
 *
 * Sélecteurs dérivés : `phaseRanking` (classement d'une phase de poules, l'ordre d'arrivée
 * étant l'ordre d'entrée dans la phase, cf. `entryArrivee`), `barrageRanking`, `bracketRanking`
 * (classement d'une phase finale N/M/CLS), `playerTotals` (cumuls hors consolante),
 * `finalRanking` (classement final du tournoi, SPEC §7) et `primesOf` (SPEC §6).
 *
 * Choix : le réducteur est tolérant (phase ou match inconnu → événement ignoré ; dérivation
 * impossible, par ex. classement incomplet → structure laissée vide) et ne mute jamais l'état
 * reçu. Les distances par tour d'un tableau : National R16 = `huitiemes`, puis `final` ;
 * Masters = `final` ; consolante = `cls`. L'appelant doit vérifier `phaseComplete` avant
 * d'émettre `phase.closed`.
 */
import { pouleMatches, serpentinOrder } from "./draw.js";
import {
  advanceBracket,
  barragePairs,
  composeMasters,
  composeNational,
  consolanteBracket,
  mastersQF,
  nationalR16,
} from "./phases.js";
import { primesTable, rankTournamentPhase, tournamentRanking } from "./results.js";
import { cloneRules, DEFAULT_RULES } from "./rules.js";
import { matchOutcome, rankBarrages, rankPhase, rankPoule, rankPouleInPhase } from "./scoring.js";
import type {
  BracketMatch,
  BracketRound,
  Distance,
  Match,
  PhaseId,
  PhaseRankRow,
  Player,
  PlayerTotals,
  Poule,
  PrimesTable,
  Rules,
  TournamentEvent,
  TournamentPhaseRow,
  TournamentRankRow,
  TournamentState,
} from "./types.js";

type PoulePhase = "PREQ" | "QN" | "QM";
type BracketPhase = "N" | "M" | "CLS";

const POULE_PHASES: readonly PhaseId[] = ["PREQ", "QN", "QM"];
const BRACKET_PHASES: readonly PhaseId[] = ["N", "M", "CLS"];

function isPoulePhase(p: PhaseId): p is PoulePhase {
  return POULE_PHASES.includes(p);
}
function isBracketPhase(p: PhaseId): p is BracketPhase {
  return BRACKET_PHASES.includes(p);
}

/** État initial d'un tournoi vide. */
export function initialState(): TournamentState {
  return {
    info: null,
    billards: [],
    rules: cloneRules(DEFAULT_RULES),
    players: [],
    masters: [],
    poules: { PREQ: [], QN: [], QM: [] },
    barrages: [],
    brackets: { N: [], M: [], CLS: [] },
    closed: {},
    forfaits: [],
    billardAssignments: {},
  };
}

/** Rejoue un journal d'événements depuis l'état initial. */
export function replay(events: TournamentEvent[]): TournamentState {
  return events.reduce(reduce, initialState());
}

/** Distance des poules d'une phase. */
export function pouleDistance(rules: Rules, phase: PoulePhase): Distance {
  return phase === "PREQ"
    ? rules.distances.preq
    : phase === "QN"
      ? rules.distances.qn
      : rules.distances.qm;
}

/** Distance d'un tour de tableau selon la phase. */
export function bracketDistance(rules: Rules, phase: BracketPhase, round: BracketRound): Distance {
  if (phase === "CLS") return rules.distances.cls;
  if (phase === "N" && round === "R16") return rules.distances.huitiemes;
  return rules.distances.final;
}

/** Distances par tour pour `advanceBracket`. */
function distancesByRound(
  rules: Rules,
  phase: BracketPhase,
): Partial<Record<BracketRound, Distance>> {
  const rounds: BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];
  const out: Partial<Record<BracketRound, Distance>> = {};
  for (const r of rounds) out[r] = bracketDistance(rules, phase, r);
  return out;
}

/** Ordre d'arrivée : `seed` de chaque joueur. */
export function arriveeOf(state: TournamentState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state.players) out[p.name] = p.seed;
  return out;
}

/** Club de chaque joueur. */
export function clubOf(state: TournamentState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of state.players) out[p.name] = p.club;
  return out;
}

/** Noms des joueurs forfait/abandon d'une phase. */
export function forfaitsOf(state: TournamentState, phase: PhaseId): string[] {
  return state.forfaits.filter((f) => f.phase === phase).map((f) => f.player);
}

/**
 * Ordre d'arrivée d'une phase de poules : pour le vendredi et les Masters, la place dans la
 * liste ordonnée (`seed`) ; pour le National du samedi, l'ordre d'entrée dans la phase (perdants
 * de barrage dans l'ordre du classement cumulé, puis places 17 à 40), reconstitué à partir du
 * serpentin des poules (colonne « Rang arrivée dans les QN » de l'outil Excel).
 */
export function entryArrivee(state: TournamentState, phase: PoulePhase): Record<string, number> {
  const out = arriveeOf(state);
  if (phase !== "QN") return out;
  serpentinOrder(state.poules.QN.map((p) => p.players)).forEach((name, i) => {
    out[name] = i + 1;
  });
  return out;
}

/** Points subis moyens par set (ramenés à 60) d'un joueur sur une liste de matchs. */
function subisPerSet60(
  name: string,
  matches: Match[],
  d: (m: Match) => Distance,
): { subis60: number; sets: number } {
  let subis = 0;
  let sets = 0;
  for (const m of matches) {
    if (m.a !== name && m.b !== name) continue;
    const dist = d(m);
    const o = matchOutcome(m, dist);
    if (!o) continue;
    const played = o.setsWinner + o.setsLoser;
    subis += ((o.winner === name ? o.pointsLoser : o.pointsWinner) * 60) / dist.pointsParSet;
    sets += played;
  }
  return { subis60: subis, sets };
}

/**
 * Points par set crédités au joueur forfait d'un match non joué contre `opponent` (SPEC §5) :
 * moyenne des points subis par set par l'adversaire dans les phases précédentes (vendredi et
 * barrage réunis, puis poules du samedi), ramenée à la distance en cours et plafonnée à la
 * distance − 1 ; sans historique, 66 % de la distance (100 → 66, 80 → 53, 60 → 40). Pour le
 * vendredi, l'historique est celui des autres matchs de l'adversaire dans sa poule.
 */
export function walkoverPoints(
  state: TournamentState,
  phase: PhaseId,
  opponent: string,
  d: Distance,
): number {
  const { rules } = state;
  const samples: { subis60: number; sets: number }[] = [];
  const pouleMatchesOf = (p: PoulePhase, only?: (poule: Poule) => boolean): Match[] =>
    state.poules[p].filter((x) => only?.(x) ?? true).flatMap((x) => x.matches);
  if (phase === "PREQ") {
    samples.push(
      subisPerSet60(
        opponent,
        pouleMatchesOf("PREQ", (x) => x.players.includes(opponent)),
        () => rules.distances.preq,
      ),
    );
  } else {
    const friday = subisPerSet60(opponent, [...pouleMatchesOf("PREQ"), ...state.barrages], (m) =>
      state.barrages.includes(m) ? rules.distances.barrage : rules.distances.preq,
    );
    samples.push(friday);
    if (phase === "N") {
      samples.push(subisPerSet60(opponent, pouleMatchesOf("QN"), () => rules.distances.qn));
    } else if (phase === "M") {
      samples.push(subisPerSet60(opponent, pouleMatchesOf("QM"), () => rules.distances.qm));
    }
  }
  const valid = samples.filter((x) => x.sets > 0);
  if (valid.length === 0) return Math.round(0.66 * d.pointsParSet);
  const avg60 = valid.reduce((acc, x) => acc + x.subis60 / x.sets, 0) / valid.length;
  return Math.min(Math.floor((avg60 / 60) * d.pointsParSet), d.pointsParSet - 1);
}

/** Points subis crédités à l'adversaire d'un forfait pour un match entier (sélecteur). */
export function forfaitSubisOf(state: TournamentState, phase: PoulePhase): Record<string, number> {
  const out: Record<string, number> = {};
  if (forfaitsOf(state, phase).length === 0) return out;
  const d = pouleDistance(state.rules, phase);
  for (const p of state.poules[phase]) {
    for (const name of p.players) {
      out[name] = walkoverPoints(state, phase, name, d) * d.setsGagnants;
    }
  }
  return out;
}

/** Classement de phase d'une phase de poules (sélecteur). */
export function phaseRanking(state: TournamentState, phase: PoulePhase): PhaseRankRow[] {
  return rankPhase(
    state.poules[phase],
    pouleDistance(state.rules, phase),
    entryArrivee(state, phase),
    forfaitsOf(state, phase),
    forfaitSubisOf(state, phase),
  );
}

/** Cumuls par joueur (Pm, Ps, points, matchs) sur le vendredi, le barrage, le samedi et les
 * tableaux N/M, sans compensation « poule de 3 » et hors consolante (sélecteur, SPEC §7). */
export function playerTotals(state: TournamentState): Record<string, PlayerTotals> {
  const out: Record<string, PlayerTotals> = {};
  const totals = (name: string): PlayerTotals => {
    const t = out[name] ?? { ptm: 0, pts: 0, faits: 0, subis: 0, joues: 0 };
    out[name] = t;
    return t;
  };
  for (const phase of ["PREQ", "QN", "QM"] as const) {
    const d = pouleDistance(state.rules, phase);
    const forfaits = forfaitsOf(state, phase);
    const subis = forfaitSubisOf(state, phase);
    for (const p of state.poules[phase]) {
      const { rows } = rankPoule(p.players, p.matches, d, {
        compensate3: false,
        forfaits,
        forfaitSubis: subis,
      });
      for (const r of rows) {
        const t = totals(r.name);
        t.ptm += r.ptm;
        t.pts += r.pts;
        t.faits += r.faits;
        t.subis += r.subis;
        t.joues += r.joues;
      }
    }
  }
  const credit = (m: Match, d: Distance): void => {
    const o = matchOutcome(m, d);
    if (!o) return;
    const w = totals(o.winner);
    const l = totals(o.loser);
    const maxSets = 2 * d.setsGagnants - 1;
    w.ptm += 2;
    w.pts += maxSets - o.setsLoser;
    w.faits += o.pointsWinner;
    w.subis += o.pointsLoser;
    w.joues += 1;
    l.pts += o.setsLoser;
    l.faits += o.pointsLoser;
    l.subis += o.pointsWinner;
    l.joues += 1;
  };
  for (const m of state.barrages) credit(m, state.rules.distances.barrage);
  for (const phase of ["N", "M"] as const) {
    for (const m of state.brackets[phase]) {
      if (m.a !== "" && m.b !== "") credit(m, bracketDistance(state.rules, phase, m.round));
    }
  }
  return out;
}

/** Classement d'une phase finale N, M ou CLS (sélecteur ; cf. `rankTournamentPhase`). */
export function bracketRanking(state: TournamentState, phase: BracketPhase): TournamentPhaseRow[] {
  const qualif =
    phase === "N" ? phaseRanking(state, "QN") : phase === "M" ? phaseRanking(state, "QM") : [];
  return rankTournamentPhase(
    qualif,
    state.brackets[phase],
    (round) => bracketDistance(state.rules, phase, round),
    arriveeOf(state),
  );
}

/** Classement final du tournoi (sélecteur, SPEC §7). */
export function finalRanking(state: TournamentState): TournamentRankRow[] {
  return tournamentRanking({
    masters: bracketRanking(state, "M"),
    national: bracketRanking(state, "N"),
    consolante: bracketRanking(state, "CLS"),
    preq: phaseRanking(state, "PREQ"),
    prequalified: state.masters,
    totals: playerTotals(state),
    abandons: state.forfaits.filter((f) => f.phase !== "CLS").map((f) => f.player),
    arrivee: arriveeOf(state),
  });
}

/** Tableau des primes (sélecteur, SPEC §6). Les places du tableau non encore jouées restent
 * sans nom ; les 3es et 4es de poule Masters sont connus dès la fin des poules. */
export function primesOf(state: TournamentState): PrimesTable {
  const blank = (rows: TournamentPhaseRow[]): TournamentPhaseRow[] =>
    rows.map((r) => (r.reached === null && r.place <= 8 ? { ...r, name: "" } : r));
  return primesTable(
    state.players.length,
    state.players.filter((p) => p.junior).length,
    state.rules.inscriptionFee,
    blank(bracketRanking(state, "M")),
    blank(bracketRanking(state, "N")),
  );
}

/** Classement cumulé des barrages (poules + barrage), vainqueurs puis perdants (sélecteur). */
export function barrageRanking(state: TournamentState): PhaseRankRow[] {
  return rankBarrages(phaseRanking(state, "PREQ"), state.barrages, state.rules.distances.barrage);
}

/** Vainqueurs et perdants des barrages décidés. */
export function barrageResults(state: TournamentState): { winners: string[]; losers: string[] } {
  const winners: string[] = [];
  const losers: string[] = [];
  for (const m of state.barrages) {
    const o = matchOutcome(m, state.rules.distances.barrage);
    if (o) {
      winners.push(o.winner);
      losers.push(o.loser);
    }
  }
  return { winners, losers };
}

/** Une phase est complète quand tous ses matchs sont décidés (sélecteur). */
export function phaseComplete(state: TournamentState, phase: PhaseId): boolean {
  if (isPoulePhase(phase)) {
    const poules = state.poules[phase];
    const d = pouleDistance(state.rules, phase);
    const forfaits = forfaitsOf(state, phase);
    return (
      poules.length > 0 && poules.every((p) => rankPouleInPhase(p, d, undefined, forfaits).complete)
    );
  }
  if (phase === "B") {
    return (
      state.barrages.length > 0 &&
      state.barrages.every((m) => matchOutcome(m, state.rules.distances.barrage) !== null)
    );
  }
  const matches = state.brackets[phase];
  return (
    matches.length > 0 &&
    matches.every(
      (m) =>
        m.a !== "" &&
        m.b !== "" &&
        matchOutcome(m, bracketDistance(state.rules, phase, m.round)) !== null,
    )
  );
}

/** Copie d'un match. */
function copyMatch<M extends Match>(m: M): M {
  const out: M = { ...m };
  if (m.setsA) out.setsA = [...m.setsA];
  if (m.setsB) out.setsB = [...m.setsB];
  return out;
}

/** Copie d'une poule (matchs générés si absents). */
function copyPoule(p: Poule): Poule {
  return {
    num: p.num,
    players: [...p.players],
    billards: [...p.billards],
    matches: (p.matches.length > 0 ? p.matches : pouleMatches(p.num, p.players)).map(copyMatch),
  };
}

/** Applique les billards mémorisés d'une phase à ses poules. */
function assignPoules(poules: Poule[], assignments: Record<string, number[]> | undefined): Poule[] {
  if (!assignments) return poules;
  return poules.map((p) => {
    const b = assignments[String(p.num)];
    return b === undefined ? p : { ...p, billards: [...b] };
  });
}

/** Applique les billards mémorisés d'une phase à ses matchs. */
function assignMatches<M extends Match>(
  matches: M[],
  assignments: Record<string, number[]> | undefined,
): M[] {
  if (!assignments) return matches;
  return matches.map((m) => {
    const b = assignments[m.id]?.[0];
    return b === undefined ? m : { ...m, billard: b };
  });
}

/** Remplace un match (par id) dans une liste ; null si introuvable. */
function patchMatch<M extends Match>(matches: M[], id: string, patch: (m: M) => M): M[] | null {
  const i = matches.findIndex((m) => m.id === id);
  const m = matches[i];
  if (m === undefined) return null;
  const out = [...matches];
  out[i] = patch(copyMatch(m));
  return out;
}

/** Applique une modification au match `id` de la phase, où qu'il soit. */
function updateMatch(
  state: TournamentState,
  phase: PhaseId,
  id: string,
  patch: <M extends Match>(m: M) => M,
): TournamentState {
  if (isPoulePhase(phase)) {
    const poules = state.poules[phase];
    const i = poules.findIndex((p) => p.matches.some((m) => m.id === id));
    const poule = poules[i];
    if (poule === undefined) return state;
    const matches = patchMatch(poule.matches, id, patch);
    if (!matches) return state;
    const next = [...poules];
    next[i] = { ...poule, matches };
    return { ...state, poules: { ...state.poules, [phase]: next } };
  }
  if (phase === "B") {
    const matches = patchMatch(state.barrages, id, patch);
    return matches ? { ...state, barrages: matches } : state;
  }
  if (isBracketPhase(phase)) {
    const matches = patchMatch(state.brackets[phase], id, patch);
    if (!matches) return state;
    return {
      ...state,
      brackets: { ...state.brackets, [phase]: advance(state.rules, phase, matches) },
    };
  }
  return state;
}

/** Avance un tableau avec les distances de sa phase. */
function advance(rules: Rules, phase: BracketPhase, matches: BracketMatch[]): BracketMatch[] {
  return advanceBracket(
    matches,
    bracketDistance(rules, phase, "F"),
    distancesByRound(rules, phase),
  );
}

/** Exécute une dérivation, ou rend `fallback` si elle échoue (classement incomplet, etc.). */
function derive<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Efface les structures dérivées en aval d'une phase (et leurs fermetures). */
function clearDownstream(state: TournamentState, phase: PhaseId): TournamentState {
  const closed = { ...state.closed };
  let next = { ...state, closed };
  const clearBracket = (p: BracketPhase): void => {
    next = { ...next, brackets: { ...next.brackets, [p]: [] } };
    delete closed[p];
  };
  const clearSaturday = (): void => {
    next = { ...next, poules: { ...next.poules, QN: [], QM: [] } };
    delete closed.QN;
    delete closed.QM;
    clearBracket("N");
    clearBracket("M");
  };
  if (phase === "PREQ") {
    next = { ...next, barrages: [] };
    delete closed.B;
    clearSaturday();
  } else if (phase === "B") {
    clearSaturday();
  } else if (phase === "QN") {
    clearBracket("N");
  } else if (phase === "QM") {
    clearBracket("M");
  }
  return next;
}

/** Dérive les structures de la phase suivante à la fermeture d'une phase. */
function deriveNext(state: TournamentState, phase: PhaseId): TournamentState {
  const { rules } = state;
  const arrivee = arriveeOf(state);
  if (phase === "PREQ") {
    const barrages = derive(
      () => barragePairs(phaseRanking(state, "PREQ"), rules.barrageSize).map((m) => ({ ...m })),
      [],
    );
    return { ...state, barrages: assignMatches(barrages, state.billardAssignments.B) };
  }
  if (phase === "B") {
    const d = rules.distances.barrage;
    const ranking = phaseRanking(state, "PREQ");
    const { winners } = barrageResults(state);
    const winnerSet = new Set(winners);
    const cumul = rankBarrages(ranking, state.barrages, d);
    const losers = cumul
      .map((r) => r.name)
      .filter(
        (n) =>
          !winnerSet.has(n) &&
          state.barrages.some((m) => (m.a === n || m.b === n) && matchOutcome(m, d)),
      );
    const QM = derive(() => composeMasters(state.masters, winners, arrivee, clubOf(state)), []);
    const from = rules.barrageSize + 1;
    const to = rules.barrageSize + (rules.nationalSize - rules.barrageSize / 2);
    const QN = derive(() => composeNational(losers, ranking, from, to), []);
    return {
      ...state,
      poules: {
        ...state.poules,
        QM: assignPoules(QM, state.billardAssignments.QM),
        QN: assignPoules(QN, state.billardAssignments.QN),
      },
    };
  }
  if (phase === "QN") {
    const N = derive(
      () =>
        advance(
          rules,
          "N",
          nationalR16(state.poules.QN, rules.distances.qn, forfaitsOf(state, "QN")),
        ),
      [],
    );
    return {
      ...state,
      brackets: { ...state.brackets, N: assignMatches(N, state.billardAssignments.N) },
    };
  }
  if (phase === "QM") {
    const M = derive(
      () =>
        advance(
          rules,
          "M",
          mastersQF(state.poules.QM, rules.distances.qm, forfaitsOf(state, "QM")),
        ),
      [],
    );
    return {
      ...state,
      brackets: { ...state.brackets, M: assignMatches(M, state.billardAssignments.M) },
    };
  }
  return state;
}

/** Match en attente d'un joueur dans une liste (sans résultat). */
function pendingMatchOf<M extends Match>(
  matches: M[],
  player: string,
  d: (m: M) => Distance,
): M | undefined {
  return matches.find((m) => (m.a === player || m.b === player) && matchOutcome(m, d(m)) === null);
}

/** Réducteur : applique un événement à l'état. */
export function reduce(state: TournamentState, event: TournamentEvent): TournamentState {
  switch (event.type) {
    case "tournament.created": {
      const { name, season, city, club, dates, billards, rules } = event.payload;
      return {
        ...state,
        info: { name, season, city, club, dates: [dates[0], dates[1]] },
        billards: billards.map((b) => ({ ...b })),
        rules: cloneRules(rules),
      };
    }
    case "players.imported": {
      const players: Player[] = event.payload.players
        .map((p) => ({ ...p }))
        .sort((x, y) => x.seed - y.seed);
      const masters = players.slice(0, state.rules.mastersPrequalified).map((p) => p.name);
      return { ...state, players, masters };
    }
    case "billards.assigned": {
      const { phase, assignments } = event.payload;
      const copy: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(assignments)) copy[k] = [...v];
      let next: TournamentState = {
        ...state,
        billardAssignments: { ...state.billardAssignments, [phase]: copy },
      };
      if (isPoulePhase(phase)) {
        next = {
          ...next,
          poules: { ...next.poules, [phase]: assignPoules(next.poules[phase], copy) },
        };
      } else if (phase === "B") {
        next = { ...next, barrages: assignMatches(next.barrages, copy) };
      } else if (isBracketPhase(phase)) {
        next = {
          ...next,
          brackets: { ...next.brackets, [phase]: assignMatches(next.brackets[phase], copy) },
        };
      }
      return next;
    }
    case "poules.drawn": {
      const { phase } = event.payload;
      const poules = assignPoules(
        event.payload.poules.map(copyPoule),
        state.billardAssignments[phase],
      );
      return { ...state, poules: { ...state.poules, [phase]: poules } };
    }
    case "score.entered": {
      const { phase, matchId, sa, sb, setsA, setsB } = event.payload;
      return updateMatch(state, phase, matchId, (m) => {
        const out = { ...m, sa, sb, forfait: null };
        if (setsA) out.setsA = [...setsA];
        else delete out.setsA;
        if (setsB) out.setsB = [...setsB];
        else delete out.setsB;
        return out;
      });
    }
    case "forfait.declared": {
      const { phase, player, kind } = event.payload;
      const already = state.forfaits.some((f) => f.phase === phase && f.player === player);
      let next: TournamentState = already
        ? state
        : { ...state, forfaits: [...state.forfaits, { phase, player, kind }] };
      const side = (m: Match): "a" | "b" | null =>
        m.a === player ? "a" : m.b === player ? "b" : null;
      /** Match perdu par forfait : distance pour l'adversaire, points subis moyens pour le forfait. */
      const walkover = <M extends Match>(m: M, d: Distance): M => {
        const s = side(m);
        if (s === null || m.a === "" || m.b === "") return { ...m, forfait: s };
        const opponent = s === "a" ? m.b : m.a;
        const ps = walkoverPoints(state, phase, opponent, d);
        const winner = Array.from({ length: d.setsGagnants }, () => d.pointsParSet);
        const loser = Array.from({ length: d.setsGagnants }, () => ps);
        const out: M = { ...m, forfait: s };
        if (d.setsGagnants <= 1) {
          out.sa = s === "a" ? ps : d.pointsParSet;
          out.sb = s === "a" ? d.pointsParSet : ps;
          delete out.setsA;
          delete out.setsB;
        } else {
          out.sa = s === "a" ? 0 : d.setsGagnants;
          out.sb = s === "a" ? d.setsGagnants : 0;
          out.setsA = s === "a" ? loser : winner;
          out.setsB = s === "a" ? winner : loser;
        }
        return out;
      };
      if (phase === "B") {
        const d = state.rules.distances.barrage;
        const m = pendingMatchOf(state.barrages, player, () => d);
        if (m) next = updateMatch(next, "B", m.id, (x) => walkover(x, d));
      } else if (isBracketPhase(phase)) {
        const m = pendingMatchOf(state.brackets[phase], player, (x) =>
          bracketDistance(state.rules, phase, x.round),
        );
        if (m) {
          const d = bracketDistance(state.rules, phase, m.round);
          next = updateMatch(next, phase, m.id, (x) => walkover(x, d));
        }
      }
      return next;
    }
    case "phase.closed": {
      const { phase } = event.payload;
      if (state.closed[phase]) return state;
      const next: TournamentState = { ...state, closed: { ...state.closed, [phase]: true } };
      return deriveNext(next, phase);
    }
    case "phase.reopened": {
      const { phase } = event.payload;
      const next = clearDownstream(state, phase);
      const closed = { ...next.closed };
      delete closed[phase];
      return { ...next, closed };
    }
    case "consolante.created": {
      const players = event.payload.players.slice(0, state.rules.consolanteMax);
      const CLS = derive(
        () => advance(state.rules, "CLS", consolanteBracket(players, state.rules.consolanteMax)),
        [],
      );
      return {
        ...state,
        brackets: { ...state.brackets, CLS: assignMatches(CLS, state.billardAssignments.CLS) },
      };
    }
    case "arbitre.set": {
      const { phase, matchId, licence } = event.payload;
      return updateMatch(state, phase, matchId, (m) => ({ ...m, arbitre: licence }));
    }
    default:
      return state;
  }
}
