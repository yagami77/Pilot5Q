/**
 * Optimiseur « Proposer » de l'affectation des billards du vendredi (retours des 6 et 7 novembre).
 *
 * Critères, dans l'ordre :
 * 1. occuper tous les billards disponibles (ou un billard par poule s'il y a moins de poules) ;
 * 2. minimiser la charge maximale d'un billard, en nombre de matchs (poule de 4 = 6 matchs,
 *    poule de 3 = 3 matchs ; un groupe de 3 poules sur 2 billards liés partage sa charge) ;
 * 3. équilibrer les charges (somme des carrés minimale), puis le moins de billards liés possible ;
 * 4. répartir les poules de 3 entre les formats (règle du client, 7 novembre) :
 *    - 1 poule de 3 : de préférence sur un 3m10 (un 2m80 reste acceptable) ;
 *    - 2 poules de 3 : une sur un 3m10, une sur un 2m80 ;
 *    - 3 poules de 3 : deux sur des 3m10 et une sur un 2m80 quand les deux formats sont en
 *      nombre comparable ; l'inverse s'il y a au moins 1,5 fois plus de 2m80 que de 3m10 ;
 *    les poules de 3 allègent les emplacements les plus chargés (elles rejoignent une poule de
 *    4 sur un billard partagé plutôt que d'occuper un billard seul) ;
 * 5. les groupes de 3 poules sur 2 billards liés du même format et voisins (numéros consécutifs) ;
 * 6. aucune priorité aux poules fortes sur les 3m10 (SPEC §3) : numéros de poule tirés au sort.
 *
 * Fonction pure : le hasard vient d'une graine, le même appel donne le même résultat ; une autre
 * graine donne une autre proposition de même qualité.
 */
import type { Billard, BillardType } from "@pilot5q/domain";

import { emptyPlan, tablesOf, type TablePlan } from "./assign";
import { shuffle } from "./draw";

/** Poule à placer : numéro et nombre de joueurs. */
export interface PouleSize {
  num: number;
  size: number;
}

/** Nombre de matchs d'une poule (4 joueurs = 6 matchs, 3 joueurs = 3 matchs). */
export function pouleMatches(size: number): number {
  return size < 2 ? 0 : (size * (size - 1)) / 2;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Nombre de poules de 3 à placer sur des 3m10 (critère 4). `nBig` et `nSmall` sont les nombres
 * de billards 3m10 et 2m80 du club.
 */
export function threesOnBigTarget(threes: number, nBig: number, nSmall: number): number {
  if (threes <= 0 || nBig === 0) return 0;
  if (nSmall === 0) return Math.min(threes, nBig);
  let target: number;
  if (threes === 1) target = 1;
  else target = nSmall >= 1.5 * nBig ? Math.floor(threes / 2) : Math.ceil(threes / 2);
  target = Math.min(target, nBig, threes);
  // Les poules de 3 restantes doivent tenir sur les 2m80
  return Math.max(target, threes - nSmall);
}

/** Charge d'un billard. */
export interface BillardLoad {
  billard: number;
  type: BillardType;
  /** Matchs à jouer sur ce billard (moitié du groupe pour deux billards liés). */
  matches: number;
  /** Poules de l'emplacement (billard seul ou paire liée). */
  poules: number[];
  /** Billard lié, s'il y en a un. */
  linkedWith?: number;
}

/** Charge de chaque billard pour un plan donné (billards dans l'ordre des numéros). */
export function planLoads(
  plan: TablePlan,
  poules: PouleSize[],
  billards: Billard[],
): BillardLoad[] {
  const sizeOf = new Map(poules.map((p) => [p.num, p.size]));
  const byTable = new Map<number, { matches: number; poules: number[] }>();
  for (const [anchor, ps] of Object.entries(plan.place)) {
    const tables = tablesOf(plan, Number(anchor));
    const total = ps.reduce((n, p) => n + pouleMatches(sizeOf.get(p) ?? 4), 0);
    for (const t of tables) byTable.set(t, { matches: total / tables.length, poules: ps });
  }
  return [...billards]
    .sort((a, b) => a.num - b.num)
    .map((b) => {
      const l = byTable.get(b.num);
      const linked = plan.links[b.num];
      return {
        billard: b.num,
        type: b.type,
        matches: l?.matches ?? 0,
        poules: l?.poules ?? [],
        ...(linked !== undefined ? { linkedWith: linked } : {}),
      };
    });
}

export type Proposal =
  | {
      ok: true;
      plan: TablePlan;
      loads: BillardLoad[];
      /** Charge maximale d'un billard (en matchs). */
      maxLoad: number;
      /** Nombre de groupes de 3 poules sur 2 billards liés. */
      linkedGroups: number;
      /** Poules de 3 placées sur des 3m10 et sur des 2m80. */
      threesOnBig: number;
      threesOnSmall: number;
      /** Répartition des poules de 3 visée par la règle (critère 4). */
      threesOnBigTarget: number;
    }
  | { ok: false; reason: string };

type SlotKind = "double" | "single" | "linked" | "triple";

interface Slot {
  kind: SlotKind;
  sizes: number[];
}

interface Structure {
  /** Groupes de 3 poules sur 2 billards liés. */
  x: number;
  /** Billards à 2 poules. */
  y: number;
  /** Billards à 1 poule. */
  z: number;
  /** Billards à 3 poules (seulement s'il manque des billards). */
  w: number;
}

const cap = (k: SlotKind) => (k === "single" ? 1 : k === "double" ? 2 : 3);
const tablesNeeded = (k: SlotKind) => (k === "linked" ? 2 : 1);

/**
 * Répartit les tailles de poules dans une structure : les poules de 3 allègent d'abord les
 * emplacements les plus chargés (billards à 3 poules, puis à 2, puis groupes liés, puis
 * billards seuls), les poules de 4 complètent.
 */
function compose(s: Structure, fours: number, threes: number): Slot[] | null {
  let n3 = threes;
  let n4 = fours;
  const slots: Slot[] = [
    ...Array.from({ length: s.w }, () => ({ kind: "triple" as const, sizes: [] as number[] })),
    ...Array.from({ length: s.y }, () => ({ kind: "double" as const, sizes: [] as number[] })),
    ...Array.from({ length: s.x }, () => ({ kind: "linked" as const, sizes: [] as number[] })),
    ...Array.from({ length: s.z }, () => ({ kind: "single" as const, sizes: [] as number[] })),
  ];
  let progress = true;
  while (n3 > 0 && progress) {
    progress = false;
    for (const slot of slots) {
      if (n3 > 0 && slot.sizes.length < cap(slot.kind)) {
        slot.sizes.push(3);
        n3--;
        progress = true;
      }
    }
  }
  for (const slot of slots) {
    while (slot.sizes.length < cap(slot.kind) && n4 > 0) {
      slot.sizes.push(4);
      n4--;
    }
  }
  if (n3 || n4 || slots.some((o) => o.sizes.length !== cap(o.kind))) return null;
  for (const slot of slots) slot.sizes.sort((a, b) => b - a);
  return slots;
}

/** Charges par billard d'une composition (pour comparer les structures). */
function slotLoads(slots: Slot[]): number[] {
  const out: number[] = [];
  for (const s of slots) {
    const total = s.sizes.reduce((n, size) => n + pouleMatches(size), 0);
    if (s.kind === "linked") out.push(total / 2, total / 2);
    else out.push(total);
  }
  return out;
}

/** Paires de billards voisins (numéros consécutifs) du même format, sans chevauchement. */
function neighbourPairs(billards: Billard[]): [Billard, Billard][] {
  const sorted = [...billards].sort((a, b) => a.num - b.num);
  const out: [Billard, Billard][] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b.num === a.num + 1 && a.type === b.type) out.push([a, b]);
  }
  return out;
}

/** Nombre maximal de paires disjointes (glouton de gauche à droite, optimal sur une chaîne). */
function maxDisjointPairs(billards: Billard[]): number {
  let n = 0;
  let last = -Infinity;
  for (const [a, b] of neighbourPairs(billards)) {
    if (a.num > last) {
      n++;
      last = b.num;
    }
  }
  return n;
}

/**
 * Choisit, pour chaque emplacement, le format de billard (3m10 ou 2m80) : les billards de
 * chaque format doivent suffire (en nombre et en paires voisines pour les groupes liés), et le
 * nombre de poules de 3 placées sur des 3m10 doit être le plus proche possible de la cible
 * (critère 4). Null si aucune répartition ne tient.
 */
function assignFormats(
  slots: Slot[],
  big: Billard[],
  small: Billard[],
  target: number,
  used: number,
): boolean[] | null {
  const nBig = big.length;
  const nSmall = small.length;
  const pairsBig = maxDisjointPairs(big);
  const pairsSmall = maxDisjointPairs(small);
  const totalPairs = slots.filter((s) => s.kind === "linked").length;
  const minBigTables = Math.max(0, used - nSmall);
  // Programmation dynamique sur les emplacements : état = (billards 3m10 pris, paires 3m10
  // prises, poules de 3 sur 3m10) → choix (true = 3m10) de chaque emplacement.
  let states = new Map<string, boolean[]>([["0,0,0", []]]);
  for (const slot of slots) {
    const next = new Map<string, boolean[]>();
    const t = tablesNeeded(slot.kind);
    const p = slot.kind === "linked" ? 1 : 0;
    const c3 = slot.sizes.filter((s) => s < 4).length;
    for (const [key, choice] of states) {
      const [bt, bp, c] = key.split(",").map(Number) as [number, number, number];
      // sur un 3m10
      if (bt + t <= nBig && bp + p <= pairsBig) {
        const k = `${bt + t},${bp + p},${c + c3}`;
        if (!next.has(k)) next.set(k, [...choice, true]);
      }
      // sur un 2m80
      next.set(`${bt},${bp},${c}`, next.get(`${bt},${bp},${c}`) ?? [...choice, false]);
    }
    states = next;
  }
  let best: { choice: boolean[]; score: number[] } | null = null;
  for (const [key, choice] of states) {
    const [bt, bp, c] = key.split(",").map(Number) as [number, number, number];
    const smallTables = used - bt;
    const smallPairs = totalPairs - bp;
    if (bt < minBigTables || smallTables > nSmall || smallPairs > pairsSmall) continue;
    // Cible des poules de 3, puis tous les 3m10 occupés (quand il y a assez de poules)
    const score = [Math.abs(c - target), Math.abs(bt - Math.min(nBig, used))];
    if (!best || compareScores(score, best.score) < 0) best = { choice, score };
  }
  return best?.choice ?? null;
}

/** Choisit `count` paires disjointes au hasard (repli : glouton de gauche à droite). */
function pickPairs(billards: Billard[], count: number, random: () => number): [Billard, Billard][] {
  if (count === 0) return [];
  const all = neighbourPairs(billards);
  const pick = (list: [Billard, Billard][]) => {
    const used = new Set<number>();
    const out: [Billard, Billard][] = [];
    for (const [a, b] of list) {
      if (out.length === count) break;
      if (used.has(a.num) || used.has(b.num)) continue;
      used.add(a.num);
      used.add(b.num);
      out.push([a, b]);
    }
    return out;
  };
  const random1 = pick(shuffle(all, random));
  return random1.length === count ? random1 : pick(all);
}

/**
 * Propose une affectation des poules du vendredi aux billards (voir les critères en tête de
 * fichier). Impossible s'il y a plus de 3 poules par billard en moyenne.
 */
export function optimizeBillards(poules: PouleSize[], billards: Billard[], seed = 1): Proposal {
  const P = poules.length;
  const B = billards.length;
  if (P === 0)
    return {
      ok: true,
      plan: emptyPlan(),
      loads: [],
      maxLoad: 0,
      linkedGroups: 0,
      threesOnBig: 0,
      threesOnSmall: 0,
      threesOnBigTarget: 0,
    };
  if (B === 0) return { ok: false, reason: "Aucun billard n'est défini." };
  if (P > 3 * B) {
    return {
      ok: false,
      reason: `${P} poules pour ${B} billards : impossible, au plus 3 poules par billard (${3 * B}).`,
    };
  }
  const random = seededRandom(seed);
  const big = billards.filter((b) => b.type === "3m10").sort((a, b) => a.num - b.num);
  const small = billards.filter((b) => b.type !== "3m10").sort((a, b) => a.num - b.num);
  const threes = poules.filter((p) => p.size < 4).length;
  const fours = P - threes;
  const used = Math.min(B, P);
  const target = threesOnBigTarget(threes, big.length, small.length);

  // Structures possibles, de la meilleure à la moins bonne selon les critères 1 à 3
  const candidates: { slots: Slot[]; score: number[] }[] = [];
  const maxPairs = maxDisjointPairs(big) + maxDisjointPairs(small);
  for (let w = 0; w <= used; w++) {
    for (let x = 0; 2 * x <= used && x <= maxPairs; x++) {
      const y = P - used - x - 2 * w;
      const z = used - 2 * x - y - w;
      if (y < 0 || z < 0) continue;
      const slots = compose({ x, y, z, w }, fours, threes);
      if (!slots) continue;
      const loads = slotLoads(slots);
      candidates.push({ slots, score: [Math.max(...loads), loads.reduce((n, l) => n + l * l, 0), x, w] });
    }
  }
  candidates.sort((a, b) => compareScores(a.score, b.score));

  // Première structure dont les emplacements tiennent dans les deux formats
  let chosen: { slots: Slot[]; onBig: boolean[] } | null = null;
  for (const c of candidates) {
    const onBig = assignFormats(c.slots, big, small, target, used);
    if (onBig) {
      chosen = { slots: c.slots, onBig };
      break;
    }
  }
  if (!chosen) {
    return {
      ok: false,
      reason: "Aucune répartition possible avec ces billards (paires voisines du même format).",
    };
  }

  // Placement concret : billards et numéros de poule tirés avec la graine
  const plan = emptyPlan();
  const fourNums = shuffle(
    poules.filter((p) => p.size >= 4).map((p) => p.num),
    random,
  );
  const threeNums = shuffle(
    poules.filter((p) => p.size < 4).map((p) => p.num),
    random,
  );
  const take = (size: number) => (size >= 4 ? fourNums.shift() : threeNums.shift()) ?? 0;
  const put = (anchor: number, sizes: number[]) => {
    plan.place[anchor] = sizes.map(take).sort((a, b) => a - b);
  };
  let threesOnBig = 0;
  for (const [tables, isBig] of [
    [big, true],
    [small, false],
  ] as const) {
    const mine = chosen.slots.filter((_, i) => chosen!.onBig[i] === isBig);
    const linked = mine.filter((s) => s.kind === "linked");
    const rest = mine.filter((s) => s.kind !== "linked");
    const pairs = pickPairs(tables, linked.length, random);
    const inPairs = new Set(pairs.flat().map((b) => b.num));
    const free = shuffle(
      tables.filter((b) => !inPairs.has(b.num)),
      random,
    );
    linked.forEach((s, i) => {
      const [a, b] = pairs[i]!;
      plan.links[a.num] = b.num;
      plan.links[b.num] = a.num;
      put(a.num, s.sizes);
    });
    rest.forEach((s, i) => put(free[i]!.num, s.sizes));
    if (isBig) threesOnBig = mine.reduce((n, s) => n + s.sizes.filter((z) => z < 4).length, 0);
  }

  const loads = planLoads(plan, poules, billards);
  return {
    ok: true,
    plan,
    loads,
    maxLoad: Math.max(0, ...loads.map((l) => l.matches)),
    linkedGroups: chosen.slots.filter((s) => s.kind === "linked").length,
    threesOnBig,
    threesOnSmall: threes - threesOnBig,
    threesOnBigTarget: target,
  };
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Les critères de l'optimiseur, en une phrase. */
export const OPTIMIZER_CRITERIA =
  "Tous les billards occupés, charge maximale la plus basse puis équilibrée (6 matchs par poule de 4, 3 par poule de 3), poules de 3 réparties entre 3m10 et 2m80 (1 : plutôt un 3m10 ; 2 : une de chaque ; 3 : deux sur 3m10 et une sur 2m80, l'inverse s'il y a 1,5 fois plus de 2m80), 3 poules sur 2 billards voisins du même format, sans priorité aux poules fortes sur les 3m10.";
