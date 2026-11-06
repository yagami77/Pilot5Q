/** Comparaison du classement glissant courant avec le classement « après TN 2 » du classeur de référence. */
import type { RankingRow } from "@pilot5q/domain";

import { SEASON_FIXTURE } from "./demo";

export interface ReferenceComparison {
  /** Joueurs classés des deux côtés. */
  common: number;
  expected: number;
  received: number;
  /** Même total au centième près (barème identique, décimale au plus 1/100 d'écart). */
  sameBarème: number;
  /** Total identique (barème et décimale). */
  identical: number;
  /** Même position. */
  samePosition: number;
  /** Joueurs dont seule la décimale diffère. */
  decimalOnly: { name: string; got: number; expected: number }[];
}

export function compareWithReference(rows: RankingRow[]): ReferenceComparison {
  const exp = SEASON_FIXTURE.expectedAfter;
  const byName = new Map(exp.map((e) => [e.name, e]));
  let common = 0;
  let sameBareme = 0;
  let identical = 0;
  let samePosition = 0;
  const decimalOnly: ReferenceComparison["decimalOnly"] = [];
  for (const r of rows) {
    const e = byName.get(r.name);
    if (!e) continue;
    common++;
    if (e.position === r.position) samePosition++;
    if (Math.abs(e.pts - r.pts) < 1e-9) identical++;
    else if (Math.floor(e.pts + 1e-9) === Math.floor(r.pts + 1e-9)) {
      sameBareme++;
      decimalOnly.push({ name: r.name, got: r.pts, expected: e.pts });
    }
  }
  return {
    common,
    expected: exp.length,
    received: rows.length,
    sameBarème: sameBareme + identical,
    identical,
    samePosition,
    decimalOnly,
  };
}

/** Le classement courant est-il exactement celui du classeur de référence ? */
export function matchesReference(rows: RankingRow[]): boolean {
  const c = compareWithReference(rows);
  return c.identical === c.expected && c.received === c.expected && c.samePosition === c.expected;
}

/** Le classement courant correspond-il au classement « après TN 2 » (même joueurs, même barème) ? */
export function isAfterReference(rows: RankingRow[]): boolean {
  const c = compareWithReference(rows);
  return c.common === c.expected && c.received === c.expected && c.sameBarème === c.expected;
}
