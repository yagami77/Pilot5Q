/**
 * Points attribués à chaque joueur à l'issue d'un TN, pour le classement glissant.
 *
 * Le barème lui-même (Masters 80 / 54 / 38 ×2 / 26 ×4 / 18 ×4 / 13 ×4 ; National 25 / 17 /
 * 11 ×2 / 9 ×4 / 7 ×8 / 5 ×8 / 4 ×8 ; vainqueur de la consolante 3 ; non-qualifiés selon le
 * rang du vendredi 2e → 2, 3e → 2, 4e → 1 ; décimale = points de set / matchs / 100 hors
 * consolante ; abandon hors consolante → 0) est défini une seule fois dans `../results.ts`
 * (`tournamentRanking`, validé sur l'outil Excel). Ce module le réexpose pour l'affichage et
 * convertit un classement final de tournoi (`finalRanking`) ou des résultats agrégés (saisie
 * manuelle, corrections) en entrées de la fenêtre glissante.
 */
import {
  CONSOLANTE_WINNER_POINTS,
  MASTERS_POINTS,
  NATIONAL_POINTS,
  preqPoints,
} from "../results.js";
import type { TournamentRankRow } from "../types.js";
import type { TournamentAward, TournamentResult } from "./types.js";

/** Lignes du barème pour affichage (palier → points Masters / National). */
export function baremeTable(): {
  label: string;
  masters: number | null;
  national: number | null;
}[] {
  const m = MASTERS_POINTS;
  const n = NATIONAL_POINTS;
  return [
    { label: "Vainqueur", masters: m[0] ?? null, national: n[0] ?? null },
    { label: "Finaliste", masters: m[1] ?? null, national: n[1] ?? null },
    { label: "Demi-finalistes", masters: m[2] ?? null, national: n[2] ?? null },
    { label: "Quarts de finale", masters: m[4] ?? null, national: n[4] ?? null },
    { label: "Huitièmes de finale", masters: null, national: n[8] ?? null },
    { label: "3es de poule", masters: m[8] ?? null, national: n[16] ?? null },
    { label: "4es de poule", masters: m[12] ?? null, national: n[24] ?? null },
  ];
}

/** Points hors tableaux Masters/National (vainqueur de la consolante, rang du vendredi). */
export function otherPointsTable(): { label: string; points: number }[] {
  return [
    { label: "Vainqueur de la consolante", points: CONSOLANTE_WINNER_POINTS },
    { label: "2e ou 3e de poule du vendredi", points: preqPoints(3) },
    { label: "4e de poule du vendredi", points: preqPoints(4) },
  ];
}

/** Points du barème pour un résultat agrégé (sans la décimale). */
export function basePoints(r: TournamentResult, consolanteHeld: boolean): number {
  if (r.table === "M") return MASTERS_POINTS[r.rank - 1] ?? 0;
  if (r.table === "N") return NATIONAL_POINTS[r.rank - 1] ?? 0;
  if (consolanteHeld && r.rank === 1) return CONSOLANTE_WINNER_POINTS;
  return r.preqPouleRank === null ? 0 : preqPoints(r.preqPouleRank);
}

/** Décimale de départage : points de set / matchs joués / 100. */
export function decimalPoints(setPoints: number, matches: number): number {
  return matches > 0 ? setPoints / matches / 100 : 0;
}

/** Un abandon retire les points, sauf s'il a lieu en consolante. */
export function abandonCancelsPoints(abandon: string | undefined): boolean {
  return abandon !== undefined && abandon !== "" && abandon !== "CLS";
}

/**
 * Points attribués à partir de résultats agrégés (placements + cumuls), dans l'ordre du
 * classement final (points + décimale, puis moyenne, puis ordre fourni). Sert aux corrections
 * manuelles et à la validation contre l'outil de référence ; le cockpit passe par
 * `awardsFromRanking`.
 */
export function awardPoints(
  results: TournamentResult[],
  consolanteHeld: boolean,
): TournamentAward[] {
  const awards = results.map((r, index) => {
    const abandon = abandonCancelsPoints(r.abandon);
    const award: TournamentAward = {
      name: r.name,
      licence: r.licence ?? "",
      club: r.club ?? "",
      points: abandon ? 0 : basePoints(r, consolanteHeld),
      decimal: abandon ? 0 : decimalPoints(r.setPoints, r.matches),
      faits: r.faits,
      subis: r.subis,
      abandon,
      origin: r.table === "CLS" ? (consolanteHeld && r.rank === 1 ? "CLS" : "PREQ") : r.table,
    };
    return { award, index, moy: r.subis > 0 ? r.faits / r.subis : r.faits };
  });
  awards.sort(
    (x, y) =>
      Number(x.award.abandon) - Number(y.award.abandon) ||
      y.award.points + y.award.decimal - (x.award.points + x.award.decimal) ||
      y.moy - x.moy ||
      x.index - y.index,
  );
  return awards.map((a) => a.award);
}

/** Entrées du classement glissant à partir du classement final d'un tournoi (`finalRanking`). */
export function awardsFromRanking(
  rows: TournamentRankRow[],
  identity: Record<string, { licence: string; club: string }>,
): TournamentAward[] {
  return rows.map((r) => ({
    name: r.name,
    licence: identity[r.name]?.licence ?? "",
    club: identity[r.name]?.club ?? "",
    points: r.abandon ? 0 : r.points,
    decimal: r.abandon ? 0 : r.decimal,
    faits: r.faits,
    subis: r.subis,
    abandon: r.abandon,
    origin: r.origin,
  }));
}

/** Total d'un joueur pour un TN : points + décimale. */
export function awardTotal(a: TournamentAward): number {
  return a.abandon ? 0 : a.points + a.decimal;
}
