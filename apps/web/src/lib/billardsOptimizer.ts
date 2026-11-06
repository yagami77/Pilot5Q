/**
 * Optimiseur « Proposer » de l'affectation des billards du vendredi (retours du 6 novembre).
 *
 * Critères, dans l'ordre :
 * 1. occuper tous les billards disponibles (ou un billard par poule s'il y a moins de poules) ;
 * 2. minimiser la charge maximale d'un billard, en nombre de matchs (poule de 4 = 6 matchs,
 *    poule de 3 = 3 matchs ; un groupe de 3 poules sur 2 billards liés partage sa charge) ;
 * 3. équilibrer les charges (somme des carrés minimale), puis le moins de billards liés possible ;
 * 4. une poule de 4 et une poule de 3 ensemble sur les premiers billards (livret, « Tirage au
 *    sort des billards ») ;
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
      /** Nombre de billards « poule de 4 + poule de 3 ». */
      mixedTables: number;
    }
  | { ok: false; reason: string };

type SlotKind = "mixed" | "double" | "single" | "linked" | "triple";

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

/** Répartit les tailles de poules dans une structure (poules de 3 d'abord avec une poule de 4). */
function compose(s: Structure, fours: number, threes: number): Slot[] | null {
  const slots: Slot[] = [];
  let n3 = threes;
  let n4 = fours;
  // 1. Une poule de 4 et une poule de 3 sur un même billard (livret)
  const mixed = Math.min(s.y, n3, n4);
  for (let i = 0; i < mixed; i++) slots.push({ kind: "mixed", sizes: [4, 3] });
  n3 -= mixed;
  n4 -= mixed;
  const others: Slot[] = [
    ...Array.from({ length: s.w }, () => ({ kind: "triple" as const, sizes: [] as number[] })),
    ...Array.from({ length: s.y - mixed }, () => ({
      kind: "double" as const,
      sizes: [] as number[],
    })),
    ...Array.from({ length: s.x }, () => ({ kind: "linked" as const, sizes: [] as number[] })),
    ...Array.from({ length: s.z }, () => ({ kind: "single" as const, sizes: [] as number[] })),
  ];
  const cap = (k: SlotKind) => (k === "single" ? 1 : k === "double" ? 2 : 3);
  // 2. Les poules de 3 restantes allègent les emplacements les plus chargés
  let progress = true;
  while (n3 > 0 && progress) {
    progress = false;
    for (const slot of others) {
      if (n3 > 0 && slot.sizes.length < cap(slot.kind)) {
        slot.sizes.push(3);
        n3--;
        progress = true;
      }
    }
  }
  // 3. Les poules de 4 complètent
  for (const slot of others) {
    while (slot.sizes.length < cap(slot.kind) && n4 > 0) {
      slot.sizes.push(4);
      n4--;
    }
  }
  if (n3 || n4 || others.some((o) => o.sizes.length !== cap(o.kind))) return null;
  return [...slots, ...others];
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
    return { ok: true, plan: emptyPlan(), loads: [], maxLoad: 0, linkedGroups: 0, mixedTables: 0 };
  if (B === 0) return { ok: false, reason: "Aucun billard n'est défini." };
  if (P > 3 * B) {
    return {
      ok: false,
      reason: `${P} poules pour ${B} billards : impossible, au plus 3 poules par billard (${3 * B}).`,
    };
  }
  const random = seededRandom(seed);
  const sorted = [...billards].sort((a, b) => a.num - b.num);
  const threes = poules.filter((p) => p.size < 4).length;
  const fours = P - threes;
  const used = Math.min(B, P);

  // Énumération des structures possibles, meilleure selon les critères
  let best: { s: Structure; slots: Slot[]; score: number[] } | null = null;
  for (let w = 0; w <= used; w++) {
    for (let x = 0; 2 * x <= used; x++) {
      const y = P - used - x - 2 * w;
      const z = used - 2 * x - y - w;
      if (y < 0 || z < 0) continue;
      const s = { x, y, z, w };
      const slots = compose(s, fours, threes);
      if (!slots) continue;
      const mixed = slots.filter((sl) => sl.kind === "mixed").length;
      // Les premiers billards accueillent les poules de 4 + 3 ; les paires se forment après
      if (x > maxDisjointPairs(sorted.slice(mixed))) continue;
      const loads = slotLoads(slots);
      const score = [Math.max(...loads), loads.reduce((n, l) => n + l * l, 0), x, w];
      if (!best || compareScores(score, best.score) < 0) best = { s, slots, score };
    }
  }
  if (!best) {
    return {
      ok: false,
      reason: "Aucune répartition possible avec ces billards (paires voisines du même format).",
    };
  }

  // Placement concret : billards et numéros de poule tirés avec la graine
  const plan = emptyPlan();
  const mixedSlots = best.slots.filter((s) => s.kind === "mixed");
  const linkedSlots = best.slots.filter((s) => s.kind === "linked");
  const restSlots = best.slots.filter((s) => s.kind !== "mixed" && s.kind !== "linked");
  const firstTables = sorted.slice(0, mixedSlots.length);
  const pairs = pickPairs(sorted.slice(mixedSlots.length), linkedSlots.length, random);
  const inPairs = new Set(pairs.flat().map((b) => b.num));
  const freeTables = shuffle(
    sorted.slice(mixedSlots.length).filter((b) => !inPairs.has(b.num)),
    random,
  );
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
  mixedSlots.forEach((s, i) => put(firstTables[i]!.num, s.sizes));
  linkedSlots.forEach((s, i) => {
    const [a, b] = pairs[i]!;
    plan.links[a.num] = b.num;
    plan.links[b.num] = a.num;
    put(a.num, s.sizes);
  });
  restSlots.forEach((s, i) => put(freeTables[i]!.num, s.sizes));

  const loads = planLoads(plan, poules, billards);
  return {
    ok: true,
    plan,
    loads,
    maxLoad: Math.max(0, ...loads.map((l) => l.matches)),
    linkedGroups: linkedSlots.length,
    mixedTables: mixedSlots.length,
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
  "Tous les billards occupés, charge maximale la plus basse puis équilibrée (6 matchs par poule de 4, 3 par poule de 3), une poule de 4 avec une poule de 3 sur les premiers billards, 3 poules sur 2 billards voisins du même format, sans priorité aux poules fortes sur les 3m10.";
