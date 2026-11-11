/** Tirages des billards (SPEC §3) : aléatoires, modifiables à la main. */
import type { Billard } from "@pilot5q/domain";

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const x = a[i];
    const y = a[j];
    if (x !== undefined && y !== undefined) {
      a[i] = y;
      a[j] = x;
    }
  }
  return a;
}

/**
 * Poules du vendredi : en général deux poules par billard, sans priorité des poules
 * fortes sur les 3m10. Clés : numéro de poule.
 *
 * Les poules, prises dans un ordre tiré au sort, sont distribuées par tours complets de
 * billards (chaque tour dans un ordre tiré au sort) : aucun billard ne reste vide dès qu'il y a
 * au moins autant de poules que de billards, et l'écart entre deux billards est d'une poule au
 * plus. (Tirer au hasard parmi « 2 places par billard » laissait un billard vide près d'une fois
 * sur deux avec 17 poules et 11 billards.)
 */
export function drawPreqBillards(
  pouleCount: number,
  billards: Billard[],
  random?: () => number,
): Record<string, number[]> {
  const poules = shuffle(
    Array.from({ length: pouleCount }, (_, i) => i + 1),
    random,
  );
  const out: Record<string, number[]> = {};
  let round: number[] = [];
  for (const poule of poules) {
    if (round.length === 0)
      round = shuffle(
        billards.map((b) => b.num),
        random,
      );
    out[String(poule)] = [round.pop() ?? 1];
  }
  return out;
}

/** Barrages B1–B8 : un billard par match, aléatoire. */
export function drawBarrageBillards(
  count: number,
  billards: Billard[],
  random?: () => number,
): Record<string, number[]> {
  const pool = shuffle(
    billards.map((b) => b.num),
    random,
  );
  const out: Record<string, number[]> = {};
  for (let i = 0; i < count; i++) out[`B${i + 1}`] = [pool[i % pool.length] ?? 1];
  return out;
}

/** Poules Masters : 3m10 uniquement (cycliquement s'il n'y en a que trois). */
export function drawMastersBillards(
  billards: Billard[],
  random?: () => number,
): Record<string, number[]> {
  const big = shuffle(
    billards.filter((b) => b.type === "3m10").map((b) => b.num),
    random,
  );
  const pool = big.length > 0 ? big : billards.map((b) => b.num);
  const out: Record<string, number[]> = {};
  for (let i = 0; i < 4; i++) out[String(i + 1)] = [pool[i % pool.length] ?? 1];
  return out;
}

/** Poules National : P1 & P8, P2 & P7, P3 & P6, P4 & P5 partagent un billard (hors 3m10 des Masters). */
export function drawNationalBillards(
  billards: Billard[],
  taken: number[],
  random?: () => number,
): Record<string, number[]> {
  const free = billards.filter((b) => !taken.includes(b.num)).map((b) => b.num);
  const pool = shuffle(free.length >= 4 ? free : billards.map((b) => b.num), random);
  const out: Record<string, number[]> = {};
  for (let i = 0; i < 4; i++) {
    const b = pool[i % pool.length] ?? 1;
    out[String(i + 1)] = [b];
    out[String(8 - i)] = [b];
  }
  return out;
}

/** Quarts : clés = ids des matchs (`M-QF1`…). Masters sur les 3m10, National sur les autres. */
export function drawQuarterBillards(
  billards: Billard[],
  phase: "N" | "M",
  prefer: "3m10" | "2m80",
  random?: () => number,
): Record<string, number[]> {
  const preferred = shuffle(
    billards.filter((b) => b.type === prefer).map((b) => b.num),
    random,
  );
  const rest = shuffle(
    billards.filter((b) => b.type !== prefer).map((b) => b.num),
    random,
  );
  const pool = [...preferred, ...rest];
  const out: Record<string, number[]> = {};
  for (let i = 0; i < 4; i++) out[`${phase}-QF${i + 1}`] = [pool[i % pool.length] ?? 1];
  return out;
}
