/** Sélecteurs et calculs dérivés de l'état du tournoi, utilisés par les vues. */
import type {
  Billard,
  BillardType,
  BracketMatch,
  BracketRound,
  Distance,
  Match,
  PhaseId,
  PhaseRankRow,
  Player,
  Poule,
  TournamentState,
} from "@pilot5q/domain";

import {
  distanceFor,
  forfaitsOf,
  isValidScore,
  matchLabels,
  matchWinner,
  phaseRanking as domainPhaseRanking,
  rankPouleInPhase,
} from "./engine";
import { addDays } from "./format";

export type Day = "jeudi" | "vendredi" | "samedi" | "dimanche";
export const DAYS: Day[] = ["jeudi", "vendredi", "samedi", "dimanche"];

export interface DayStatus {
  unlocked: boolean;
  done: boolean;
  /** Explication quand la journée est verrouillée. */
  reason: string;
  sub: string;
}

export function dayDate(state: TournamentState, day: Day): string {
  const friday = state.info?.dates[0] ?? "2026-01-02";
  const offset = { jeudi: -1, vendredi: 0, samedi: 1, dimanche: 2 }[day];
  return addDays(friday, offset);
}

export function dayStatuses(state: TournamentState): Record<Day, DayStatus> {
  const drawn = state.poules.PREQ.length > 0;
  const bClosed = Boolean(state.closed.B);
  const satClosed = Boolean(state.closed.QN && state.closed.QM);
  const sunClosed = Boolean(state.closed.N && state.closed.M);
  return {
    jeudi: {
      unlocked: true,
      done: drawn,
      reason: "",
      sub: "Billards et tirage des poules",
    },
    vendredi: {
      unlocked: drawn,
      done: bClosed,
      reason: "Après le tirage des poules",
      sub: "Préqualifications et barrages",
    },
    samedi: {
      unlocked: bClosed,
      done: satClosed,
      reason: "Après le classement des barrages",
      sub: "National, Masters, consolante",
    },
    dimanche: {
      unlocked: satClosed,
      done: sunClosed,
      reason: "Après les poules du samedi",
      sub: "Phases finales",
    },
  };
}

export function playerByName(state: TournamentState): Map<string, Player> {
  return new Map(state.players.map((p) => [p.name, p]));
}

export function arriveeOf(state: TournamentState): Record<string, number> {
  return Object.fromEntries(state.players.map((p) => [p.name, p.seed]));
}

export function clubOf(state: TournamentState): Record<string, string> {
  return Object.fromEntries(state.players.map((p) => [p.name, p.club]));
}

export function billardType(state: TournamentState, num: number | null | undefined): BillardType {
  return state.billards.find((b) => b.num === num)?.type ?? "2m80";
}

/** Billards d'une poule : affectation la plus récente, sinon ceux portés par la poule. */
export function pouleBillards(
  state: TournamentState,
  phase: "PREQ" | "QN" | "QM",
  poule: Poule,
): number[] {
  const assigned = state.billardAssignments[phase]?.[String(poule.num)];
  return assigned && assigned.length > 0 ? assigned : poule.billards;
}

export function phaseDistance(state: TournamentState, phase: PhaseId, round?: BracketRound) {
  return distanceFor(state.rules, phase, round);
}

export function distanceLabel(d: Distance): string {
  return d.setsGagnants === 1
    ? `1 set à ${d.pointsParSet}`
    : `${d.setsGagnants} sets gagnants à ${d.pointsParSet}`;
}

export interface Progress {
  /** Matchs touchés (au moins un score saisi). */
  touched: number;
  total: number;
  valid: number;
}

export function matchTouched(m: Match): boolean {
  return m.sa !== null || m.sb !== null || Boolean(m.forfait);
}

/** Progression d'une phase de poules : les matchs des joueurs forfait ne comptent pas. */
export function poulesProgress(state: TournamentState, phase: "PREQ" | "QN" | "QM"): Progress {
  const d = phaseDistance(state, phase);
  const forfaits = new Set(forfaitsOf(state, phase));
  let touched = 0;
  let total = 0;
  let valid = 0;
  for (const p of state.poules[phase])
    for (const m of p.matches) {
      if (forfaits.has(m.a) || forfaits.has(m.b)) continue;
      total++;
      if (matchTouched(m)) touched++;
      if (isValidScore(m, d)) valid++;
    }
  return { touched, total, valid };
}

export function matchesProgress(matches: Match[], d: Distance): Progress {
  let touched = 0;
  let valid = 0;
  for (const m of matches) {
    if (matchTouched(m)) touched++;
    if (isValidScore(m, d)) valid++;
  }
  return { touched, total: matches.length, valid };
}

export interface OrderedMatch {
  match: Match;
  /** Position dans la poule (0-based) selon l'ordre du code sportif. */
  index: number;
  label: string;
  /** Arbitre proposé : un joueur de la poule qui ne joue pas. */
  arbitre: string;
}

/**
 * Matchs d'une poule dans l'ordre du code sportif (SPEC §4). Les matchs 3 à 6 dépendent
 * des résultats des deux premiers : tant qu'ils sont inconnus, l'ordre de création est gardé.
 */
export function orderedMatches(poule: Poule, d: Distance): OrderedMatch[] {
  const labels = matchLabels(poule.players.length);
  const [p1, p2, p3, p4] = poule.players;
  const find = (x: string | undefined, y: string | undefined) =>
    poule.matches.find((m) => (m.a === x && m.b === y) || (m.a === y && m.b === x));
  let ordered: (Match | undefined)[];
  if (poule.players.length === 4) {
    const m1 = find(p2, p3);
    const m2 = find(p1, p4);
    const w1 = m1 ? matchWinner(m1, d) : null;
    const w2 = m2 ? matchWinner(m2, d) : null;
    if (m1 && m2 && w1 && w2) {
      const l1 = w1 === m1.a ? m1.b : m1.a;
      const l2 = w2 === m2.a ? m2.b : m2.a;
      const m3 = find(l1, l2);
      const m4 = find(w1, w2);
      const rest = poule.matches.filter((m) => ![m1, m2, m3, m4].includes(m));
      const m5 = rest.find((m) => m.a === p4 || m.b === p4);
      const m6 = rest.find((m) => m !== m5);
      ordered = [m1, m2, m3, m4, m5, m6];
    } else {
      ordered = [m1, m2, ...poule.matches.filter((m) => m !== m1 && m !== m2)];
    }
  } else if (poule.players.length === 3) {
    const m1 = find(p2, p3);
    const w1 = m1 ? matchWinner(m1, d) : null;
    if (m1 && w1) {
      const m2 = find(p1, w1);
      const m3 = poule.matches.find((m) => m !== m1 && m !== m2);
      ordered = [m1, m2, m3];
    } else ordered = [m1, ...poule.matches.filter((m) => m !== m1)];
  } else ordered = poule.matches;
  const seen = new Set<Match>();
  const out: OrderedMatch[] = [];
  const final = ordered.filter((m): m is Match => Boolean(m));
  for (const m of poule.matches) if (!final.includes(m)) final.push(m);
  final.forEach((m, i) => {
    if (seen.has(m)) return;
    seen.add(m);
    const others = poule.players.filter((n) => n !== m.a && n !== m.b);
    out.push({
      match: m,
      index: i,
      label: labels[i] ?? `Match ${i + 1}`,
      arbitre: others[i % Math.max(1, others.length)] ?? "",
    });
  });
  return out;
}

export function preqRanking(state: TournamentState): PhaseRankRow[] {
  return domainPhaseRanking(state, "PREQ");
}

export function phaseRanking(state: TournamentState, phase: "QN" | "QM"): PhaseRankRow[] {
  return domainPhaseRanking(state, phase);
}

export interface Qualifiers {
  winners: string[];
  losers: string[];
  masters: string[];
  national: string[];
  consolante: string[];
}

export function barragesDone(state: TournamentState): boolean {
  const d = state.rules.distances.barrage;
  return state.barrages.length > 0 && state.barrages.every((m) => isValidScore(m, d));
}

export function qualifiers(state: TournamentState): Qualifiers {
  const d = state.rules.distances.barrage;
  const winners: string[] = [];
  const losers: string[] = [];
  for (const m of state.barrages) {
    const w = matchWinner(m, d);
    if (!w) continue;
    winners.push(w);
    losers.push(w === m.a ? m.b : m.a);
  }
  const ranking = preqRanking(state);
  const size = state.rules.barrageSize;
  const natTo = size + state.rules.nationalSize - size / 2;
  return {
    winners,
    losers,
    masters: [...state.masters, ...winners],
    national: [...losers, ...ranking.slice(size, natTo).map((r) => r.name)],
    consolante: ranking.slice(natTo).map((r) => r.name),
  };
}

/** Classement d'une poule dans sa phase (forfaits et compensation déduits). */
export function pouleState(state: TournamentState, phase: "PREQ" | "QN" | "QM", poule: Poule) {
  return rankPouleInPhase(
    poule,
    phaseDistance(state, phase),
    arriveeOf(state),
    forfaitsOf(state, phase),
  );
}

export function smallTables(billards: Billard[]): number {
  return billards.filter((b) => b.type === "2m80").length;
}

export function bigTables(billards: Billard[]): number {
  return billards.filter((b) => b.type === "3m10").length;
}

/** Billards libres pour la consolante : ceux non pris par Masters et National. */
export function consolanteAllowed(state: TournamentState): boolean {
  return smallTables(state.billards) >= state.rules.consolanteMinSmallTables;
}

export function roundLabel(round: BracketRound): string {
  return {
    R64: "Trente-deuxièmes",
    R32: "Seizièmes",
    R16: "Huitièmes",
    QF: "Quarts",
    SF: "Demi-finales",
    F: "Finale",
  }[round];
}

export function roundShort(round: BracketRound): string {
  return { R64: "T", R32: "S", R16: "H", QF: "Q", SF: "D", F: "F" }[round];
}

/** Vainqueur d'un tableau (finale jouée), sinon null. */
export function bracketWinner(state: TournamentState, phase: "N" | "M" | "CLS"): string | null {
  const f = state.brackets[phase].find((m) => m.round === "F");
  if (!f) return null;
  return matchWinner(f, phaseDistance(state, phase, "F"));
}

export function bracketComplete(state: TournamentState, phase: "N" | "M" | "CLS"): boolean {
  const b = state.brackets[phase];
  if (b.length === 0) return false;
  return b.every(
    (m) => !m.a || !m.b || Boolean(matchWinner(m, phaseDistance(state, phase, m.round))),
  );
}

/** Rang final d'un joueur dans un tableau : 1, 2, 3 (demi), 5 (quart), 9 (huitième). */
export function bracketPlacement(state: TournamentState, phase: "N" | "M"): Map<string, number> {
  const out = new Map<string, number>();
  const b = state.brackets[phase];
  const d = (m: BracketMatch) => phaseDistance(state, phase, m.round);
  const loserRank: Record<BracketRound, number> = { R64: 33, R32: 17, R16: 9, QF: 5, SF: 3, F: 2 };
  for (const m of b) {
    if (!m.a || !m.b) continue;
    const w = matchWinner(m, d(m));
    if (!w) continue;
    const l = w === m.a ? m.b : m.a;
    out.set(l, loserRank[m.round]);
    if (m.round === "F") out.set(w, 1);
  }
  return out;
}
