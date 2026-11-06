/**
 * Vue billards en direct du vendredi : charge de chaque billard, billards libres ou bientôt
 * libres, poules en retard et déplacements proposés (retours du 6 novembre).
 *
 * Choix (non fixés par SPEC, à confirmer avec le client) :
 * - Matchs restants d'une poule : matchs non validés, hors matchs d'un joueur forfait ou abandon.
 * - Charge d'un billard : somme des matchs restants de ses poules ; une poule jouée sur deux
 *   billards liés compte pour moitié sur chacun.
 * - Billard « libre » : plus aucun match à jouer (ou aucune poule) ; « bientôt libre » : au plus
 *   un match restant.
 * - Poule « en retard » : au moins `LATE_GAP` matchs restants de plus que la moyenne des poules,
 *   une fois la phase commencée (relatif à la moyenne : en début de phase, personne n'est en
 *   retard).
 * - Déplacement proposé : vers un billard libre du même format, une poule non terminée d'un
 *   billard qui porte encore au moins deux matchs et une autre poule non terminée (sinon le
 *   déplacement ne fait rien gagner). Les poules en retard passent en premier, puis les billards
 *   les plus chargés.
 */
import type { BillardType, Poule, TournamentState } from "@pilot5q/domain";

import { forfaitsOf, isValidScore } from "./engine";
import { phaseDistance, pouleBillards } from "./tournament";

type PoulePhase = "PREQ" | "QN" | "QM";

/** Écart à la moyenne (en matchs restants) à partir duquel une poule est en retard. */
export const LATE_GAP = 2;

export interface LivePoule {
  num: number;
  size: number;
  /** Matchs à jouer au total (hors forfaits). */
  total: number;
  remaining: number;
  billards: number[];
  late: boolean;
}

export type LiveStatus = "libre" | "bientot" | "occupe";

export interface LiveBillard {
  num: number;
  type: BillardType;
  poules: LivePoule[];
  /** Matchs restants sur le billard. */
  load: number;
  status: LiveStatus;
}

export interface MoveSuggestion {
  poule: number;
  from: number[];
  to: number;
  type: BillardType;
  late: boolean;
}

export interface LiveBillards {
  billards: LiveBillard[];
  poules: LivePoule[];
  /** Moyenne des matchs restants par poule. */
  average: number;
  started: boolean;
  suggestions: MoveSuggestion[];
}

/** Matchs restants et matchs à jouer d'une poule. */
export function pouleRemaining(
  state: TournamentState,
  phase: PoulePhase,
  poule: Poule,
): { total: number; remaining: number } {
  const d = phaseDistance(state, phase);
  const ff = new Set(forfaitsOf(state, phase));
  let total = 0;
  let remaining = 0;
  for (const m of poule.matches) {
    if (ff.has(m.a) || ff.has(m.b) || m.forfait) continue;
    total++;
    if (!isValidScore(m, d)) remaining++;
  }
  return { total, remaining };
}

/** État en direct des billards d'une phase de poules. */
export function liveBillards(state: TournamentState, phase: PoulePhase = "PREQ"): LiveBillards {
  const base = state.poules[phase].map((p) => {
    const { total, remaining } = pouleRemaining(state, phase, p);
    return {
      num: p.num,
      size: p.players.length,
      total,
      remaining,
      billards: pouleBillards(state, phase, p),
    };
  });
  const totalAll = base.reduce((s, p) => s + p.total, 0);
  const remainingAll = base.reduce((s, p) => s + p.remaining, 0);
  const average = base.length ? remainingAll / base.length : 0;
  const started = remainingAll < totalAll;
  const poules: LivePoule[] = base.map((p) => ({
    ...p,
    late: started && p.remaining > 0 && p.remaining - average >= LATE_GAP,
  }));

  const billards: LiveBillard[] = [...state.billards]
    .sort((a, b) => a.num - b.num)
    .map((b) => {
      const on = poules.filter((p) => p.billards.includes(b.num));
      const load = on.reduce((s, p) => s + p.remaining / Math.max(1, p.billards.length), 0);
      const status: LiveStatus = load === 0 ? "libre" : load <= 1 ? "bientot" : "occupe";
      return { num: b.num, type: b.type, poules: on, load, status };
    });

  // Déplacements : billards libres → poules d'un billard encore chargé, même format
  const byNum = new Map(billards.map((b) => [b.num, b]));
  const suggestions: MoveSuggestion[] = [];
  const used = new Set<number>();
  for (const free of billards.filter((b) => b.status === "libre")) {
    const candidates = poules
      .filter((p) => p.remaining > 0 && !used.has(p.num) && !p.billards.includes(free.num))
      .map((p) => {
        const hosts = p.billards
          .map((n) => byNum.get(n))
          .filter((x): x is LiveBillard => x !== undefined);
        const sameType = hosts.length > 0 && hosts.every((h) => h.type === free.type);
        const load = Math.max(0, ...hosts.map((h) => h.load));
        const shared = hosts.some((h) => h.poules.some((o) => o.num !== p.num && o.remaining > 0));
        return { p, sameType, load, shared };
      })
      .filter((c) => c.sameType && c.shared && c.load >= 2)
      .sort(
        (x, y) =>
          Number(y.p.late) - Number(x.p.late) ||
          y.load - x.load ||
          y.p.remaining - x.p.remaining ||
          x.p.num - y.p.num,
      );
    const best = candidates[0];
    if (!best) continue;
    used.add(best.p.num);
    suggestions.push({
      poule: best.p.num,
      from: best.p.billards,
      to: free.num,
      type: free.type,
      late: best.p.late,
    });
  }
  return { billards, poules, average, started, suggestions };
}

/** Affectation complète de la phase après le déplacement d'une poule sur un billard. */
export function movePouleAssignments(
  state: TournamentState,
  phase: PoulePhase,
  poule: number,
  to: number,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const p of state.poules[phase]) out[String(p.num)] = [...pouleBillards(state, phase, p)];
  out[String(poule)] = [to];
  return out;
}
