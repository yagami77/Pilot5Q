/**
 * Barème de points d'un TN (réforme 2026-2027) et points attribués à chaque joueur.
 *
 * Règles déduites de l'outil Excel de référence (onglet CLASSEMENTS, bloc « Pts Ranking ») et
 * confirmées sur le TN 2 2026-2027 (76 joueurs, test `season.test.ts`) :
 * - Masters (16 joueurs) : 80 / 54 / 38 ×2 / 26 ×4 / 18 ×4 (3es de poule) / 13 ×4 (4es de poule).
 * - National (32 joueurs) : 25 / 17 / 11 ×2 / 9 ×4 / 7 ×8 (huitièmes) / 5 ×8 (3es de poule) /
 *   4 ×8 (4es de poule).
 * - Hors tableaux (places 41 et suivantes du vendredi) : vainqueur de la consolante 3 ; sinon
 *   selon le rang dans la poule du vendredi : 2e → 2, 3e → 2, 4e → 1 (formule
 *   `IF(rang=2, 2, 4 − rang + 1)`).
 * - Décimale de départage : points de set / matchs joués / 100, cumulés sur les poules du
 *   vendredi (sans la compensation « poule de 3 »), le barrage, les poules du samedi et le
 *   tableau final ; la consolante n'entre pas dans ce cumul.
 * - Un joueur forfait ou ayant abandonné hors consolante marque 0 (barème et décimale), mais le
 *   TN compte comme joué dans sa fenêtre glissante (points faits/subis conservés).
 * - Classement final du TN : points + décimale, puis moyenne (faits / subis).
 */
import type { TournamentAward, TournamentResult } from "./types.js";

export interface Bareme {
  masters: readonly number[];
  national: readonly number[];
  consolanteWinner: number;
  /** Points selon le rang dans la poule du vendredi pour les joueurs hors tableaux. */
  preqPouleRank: (rank: number) => number;
}

/** Barème de la réforme 2026-2027. */
export const BAREME_2026: Bareme = {
  masters: [80, 54, 38, 38, 26, 26, 26, 26, 18, 18, 18, 18, 13, 13, 13, 13],
  national: [
    25, 17, 11, 11, 9, 9, 9, 9, 7, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4,
    4,
  ],
  consolanteWinner: 3,
  preqPouleRank: (rank) => (rank <= 0 ? 0 : rank === 2 ? 2 : Math.max(0, 4 - rank + 1)),
};

/** Lignes du barème pour affichage (rang → points Masters / National). */
export function baremeTable(bareme: Bareme = BAREME_2026): {
  label: string;
  masters: number | null;
  national: number | null;
}[] {
  return [
    {
      label: "Vainqueur",
      masters: bareme.masters[0] ?? null,
      national: bareme.national[0] ?? null,
    },
    {
      label: "Finaliste",
      masters: bareme.masters[1] ?? null,
      national: bareme.national[1] ?? null,
    },
    {
      label: "Demi-finalistes",
      masters: bareme.masters[2] ?? null,
      national: bareme.national[2] ?? null,
    },
    {
      label: "Quarts de finale",
      masters: bareme.masters[4] ?? null,
      national: bareme.national[4] ?? null,
    },
    { label: "Huitièmes de finale", masters: null, national: bareme.national[8] ?? null },
    {
      label: "3es de poule",
      masters: bareme.masters[8] ?? null,
      national: bareme.national[16] ?? null,
    },
    {
      label: "4es de poule",
      masters: bareme.masters[12] ?? null,
      national: bareme.national[24] ?? null,
    },
  ];
}

/** Points du barème pour un résultat (sans la décimale). */
export function basePoints(
  r: TournamentResult,
  consolanteHeld: boolean,
  bareme: Bareme = BAREME_2026,
): number {
  if (r.table === "M") return bareme.masters[r.rank - 1] ?? 0;
  if (r.table === "N") return bareme.national[r.rank - 1] ?? 0;
  if (consolanteHeld && r.rank === 1) return bareme.consolanteWinner;
  return r.preqPouleRank === null ? 0 : bareme.preqPouleRank(r.preqPouleRank);
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
 * Points attribués à chaque joueur d'un TN, dans l'ordre du classement final du tournoi
 * (points + décimale, puis moyenne, puis ordre fourni).
 */
export function awardPoints(
  results: TournamentResult[],
  consolanteHeld: boolean,
  bareme: Bareme = BAREME_2026,
): TournamentAward[] {
  const awards = results.map((r, index) => {
    const abandon = abandonCancelsPoints(r.abandon);
    const points = abandon ? 0 : basePoints(r, consolanteHeld, bareme);
    const decimal = abandon ? 0 : decimalPoints(r.setPoints, r.matches);
    const award: TournamentAward = {
      name: r.name,
      licence: r.licence ?? "",
      club: r.club ?? "",
      points,
      decimal,
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

/** Total d'un joueur pour un TN : points + décimale. */
export function awardTotal(a: TournamentAward): number {
  return a.abandon ? 0 : a.points + a.decimal;
}
