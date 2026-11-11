/**
 * Géométrie d'un tableau à élimination directe : position de chaque carte de match.
 *
 * Chaque match est placé d'après sa place dans son tour (`slot`), comme sur un tableau papier,
 * et non d'après son rang parmi les matchs présents : un tour incomplet garde ses trous. Cas de
 * la consolante avec barrages (SPEC §5 : 19 joueurs → tableau de 16 et 3 barrages avant les
 * huitièmes ; `preliminaryRound` du domaine) : le premier tour ne compte que quelques matchs,
 * chacun alimentant un huitième différent. La hauteur du tableau est alors celle du tour
 * suivant, complet, et chaque barrage est posé en face du match qu'il alimente. Sans cela, les
 * cartes des huitièmes se chevauchaient et masquaient leur deuxième joueur (retours du
 * 11 novembre). Les noms des tours et les codes des matchs sont dans `bracketNaming`.
 */
import type { BracketMatch, BracketRound } from "@pilot5q/domain";
import { preliminaryRound, roundSize } from "@pilot5q/domain";

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
  /** Index du tour qui fixe la hauteur (1 quand le premier tour est un tour de barrages). */
  base: number;
}

/** Nombre de matchs d'un tour complet (huitièmes : 8). */
const fullCount = (round: BracketRound): number => roundSize(round) / 2;

/**
 * Le premier tour affiché est-il le tour de barrages du tableau, chaque barrage alimentant un
 * match différent du tour suivant (condition pour les poser en face de ce match) ?
 */
function startsWithBarrages(byRound: BracketMatch[][]): boolean {
  const first = byRound[0] ?? [];
  if (byRound.length < 2 || first.length === 0) return false;
  if (preliminaryRound(byRound.flat()) !== first[0]?.round) return false;
  return new Set(first.map((m) => Math.ceil(m.slot / 2))).size === first.length;
}

/** Positions des matchs, tour par tour (`byRound[i]` = matchs du tour `rounds[i]`). */
export function bracketLayout(
  byRound: BracketMatch[][],
  rounds: BracketRound[],
  box: BracketBox,
): BracketLayout {
  const pos = new Map<string, { x: number; y: number }>();
  const base = startsWithBarrages(byRound) ? 1 : 0;
  const baseRound = rounds[base];
  const rows = baseRound ? fullCount(baseRound) : 0;
  const totalH = rows * box.rowH(rows);
  const yOf = (round: BracketRound, slot: number) =>
    (slot - 0.5) * (totalH / fullCount(round)) - box.h / 2;
  byRound.forEach((ms, ri) => {
    const x = ri * (box.w + box.gap);
    const next = rounds[ri + 1];
    for (const m of ms) {
      // Barrage : en face du match qu'il alimente
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
