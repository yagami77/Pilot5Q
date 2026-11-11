/**
 * Géométrie d'un tableau à élimination directe : position de chaque carte de match.
 *
 * Chaque match est placé d'après sa place dans son tour (`slot`), comme sur un tableau papier,
 * et non d'après son rang parmi les matchs présents : un tour incomplet garde ses trous. Cas de
 * la consolante avec matchs préliminaires (SPEC §5 : 19 joueurs → tableau de 16 et 3 matchs
 * avant les huitièmes) : le premier tour ne compte que quelques matchs, chacun alimentant un
 * huitième différent. La hauteur du tableau est alors celle du tour suivant, complet, et chaque
 * préliminaire est posé en face du match qu'il alimente. Sans cela, les cartes des huitièmes se
 * chevauchaient et masquaient leur deuxième joueur (retours du 11 novembre).
 */
import type { BracketMatch, BracketRound } from "@pilot5q/domain";
import { roundSize } from "@pilot5q/domain";

import { roundShort } from "./tournament";

/**
 * Libellé d'un joueur attendu, avec le nom du match tel qu'il est affiché sur sa carte :
 * « Vainqueur R32-2 » → « Vainqueur S2 », « Vainqueur QF1 » → « Vainqueur Q1 ».
 */
export function waitingLabel(label: string | undefined): string {
  return (label ?? "").replace(
    /\b(R64|R32|R16|QF|SF)-?(\d+)\b/,
    (_, r: BracketRound, n: string) => `${roundShort(r)}${n}`,
  );
}

export interface BracketBox {
  /** Largeur et hauteur d'une carte, écart horizontal entre deux tours. */
  w: number;
  h: number;
  gap: number;
  /** Hauteur réservée à une carte dans le tour de base. */
  rowH: (rows: number) => number;
}

export interface BracketLayout {
  pos: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  /** Index du tour qui fixe la hauteur (1 quand le premier tour est préliminaire). */
  base: number;
}

/** Nombre de matchs d'un tour complet (huitièmes : 8). */
const fullCount = (round: BracketRound): number => roundSize(round) / 2;

/**
 * Le premier tour est-il fait de matchs préliminaires : tour incomplet dont aucun match du tour
 * suivant ne reçoit deux vainqueurs ?
 */
export function isPreliminaryRound(first: BracketMatch[], next: BracketMatch[] | undefined) {
  const round = first[0]?.round;
  if (!round || !next || next.length === 0) return false;
  if (first.length >= fullCount(round)) return false;
  const targets = new Set(first.map((m) => Math.ceil(m.slot / 2)));
  return targets.size === first.length;
}

/** Positions des matchs, tour par tour (`byRound[i]` = matchs du tour `rounds[i]`). */
export function bracketLayout(
  byRound: BracketMatch[][],
  rounds: BracketRound[],
  box: BracketBox,
): BracketLayout {
  const pos = new Map<string, { x: number; y: number }>();
  const base = isPreliminaryRound(byRound[0] ?? [], byRound[1]) ? 1 : 0;
  const baseRound = rounds[base];
  const rows = baseRound ? fullCount(baseRound) : 0;
  const totalH = rows * box.rowH(rows);
  const yOf = (round: BracketRound, slot: number) =>
    (slot - 0.5) * (totalH / fullCount(round)) - box.h / 2;
  byRound.forEach((ms, ri) => {
    const x = ri * (box.w + box.gap);
    const next = rounds[ri + 1];
    for (const m of ms) {
      // Préliminaire : en face du match qu'il alimente
      const y = ri < base && next ? yOf(next, Math.ceil(m.slot / 2)) : yOf(m.round, m.slot);
      pos.set(m.id, { x, y });
    }
  });
  return {
    pos,
    width: rounds.length * box.w + Math.max(0, rounds.length - 1) * box.gap,
    height: totalH,
    base,
  };
}
