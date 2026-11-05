/**
 * Affectation des billards aux poules du vendredi, vue « par billard » (retours du 5 novembre) :
 * on part des billards et on y place 1 à 3 poules ; deux billards du même format peuvent être
 * liés pour accueillir 3 poules ensemble. Le résultat alimente `billards.assigned` (clé =
 * numéro de poule, valeur = billard(s) ; une poule sur deux billards liés porte les deux
 * numéros).
 */
import type { Billard } from "@pilot5q/domain";

import { shuffle } from "./draw";

export const MAX_POULES_PER_TABLE = 3;

/** Plan d'affectation : poules posées sur chaque billard (sur le premier d'une paire liée). */
export interface TablePlan {
  /** Billard → poules (pour une paire liée, les poules sont sur le plus petit numéro). */
  place: Record<number, number[]>;
  /** Billard → billard lié (symétrique). */
  links: Record<number, number>;
}

export const emptyPlan = (): TablePlan => ({ place: {}, links: {} });

/** Billard « porteur » d'une paire (le plus petit numéro). */
export function anchorOf(plan: TablePlan, b: number): number {
  const p = plan.links[b];
  return p !== undefined && p < b ? p : b;
}

/** Billards d'un emplacement (un billard, ou les deux d'une paire). */
export function tablesOf(plan: TablePlan, anchor: number): number[] {
  const p = plan.links[anchor];
  return p === undefined ? [anchor] : [anchor, p].sort((a, b) => a - b);
}

/** Plan → événement `billards.assigned` (clé = numéro de poule). */
export function planToAssignments(plan: TablePlan): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [b, poules] of Object.entries(plan.place)) {
    const tables = tablesOf(plan, Number(b));
    for (const n of poules) out[String(n)] = tables;
  }
  return out;
}

/** Affectation mémorisée → plan (une poule sur deux billards = paire liée). */
export function assignmentsToPlan(assign: Record<string, number[]> | undefined): TablePlan {
  const plan = emptyPlan();
  for (const [k, bs] of Object.entries(assign ?? {})) {
    const poule = Number(k);
    const sorted = [...bs].sort((a, b) => a - b);
    const a = sorted[0];
    if (a === undefined) continue;
    const b = sorted[1];
    if (b !== undefined) {
      plan.links[a] = b;
      plan.links[b] = a;
    }
    (plan.place[a] ??= []).push(poule);
  }
  for (const k of Object.keys(plan.place)) plan.place[Number(k)]!.sort((x, y) => x - y);
  return plan;
}

/** Retire une poule de partout. */
export function removePoule(plan: TablePlan, poule: number): TablePlan {
  const place: Record<number, number[]> = {};
  for (const [b, ps] of Object.entries(plan.place)) {
    const rest = ps.filter((p) => p !== poule);
    if (rest.length) place[Number(b)] = rest;
  }
  return { ...plan, place };
}

/** Pose une poule sur un billard (ou sa paire) ; elle quitte son emplacement précédent. */
export function placePoule(plan: TablePlan, poule: number, billard: number): TablePlan {
  const next = removePoule(plan, poule);
  const a = anchorOf(next, billard);
  next.place[a] = [...(next.place[a] ?? []), poule].sort((x, y) => x - y);
  return next;
}

/** Lie deux billards (leurs poules sont réunies sur la paire). */
export function linkTables(plan: TablePlan, a: number, b: number): TablePlan {
  if (a === b || plan.links[a] !== undefined || plan.links[b] !== undefined) return plan;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const place = { ...plan.place };
  const merged = [...(place[lo] ?? []), ...(place[hi] ?? [])].sort((x, y) => x - y);
  delete place[hi];
  if (merged.length) place[lo] = merged;
  else delete place[lo];
  return { place, links: { ...plan.links, [lo]: hi, [hi]: lo } };
}

/** Délie une paire : les poules restent sur le premier billard. */
export function unlinkTables(plan: TablePlan, b: number): TablePlan {
  const p = plan.links[b];
  if (p === undefined) return plan;
  const links = { ...plan.links };
  delete links[b];
  delete links[p];
  return { ...plan, links };
}

export interface PlanIssues {
  unplaced: number[];
  duplicated: number[];
  /** Emplacements (billard porteur) avec plus de 3 poules. */
  overloaded: number[];
  /** Paires liées de formats différents. */
  mixedLinks: number[];
  ok: boolean;
}

/** Contrôle : poules non placées, en double, billard (ou paire) de plus de 3 poules. */
export function checkPlan(plan: TablePlan, pouleCount: number, billards: Billard[]): PlanIssues {
  const seen = new Map<number, number>();
  const overloaded: number[] = [];
  for (const [b, ps] of Object.entries(plan.place)) {
    if (ps.length > MAX_POULES_PER_TABLE) overloaded.push(Number(b));
    for (const p of ps) seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  const unplaced: number[] = [];
  for (let n = 1; n <= pouleCount; n++) if (!seen.has(n)) unplaced.push(n);
  const duplicated = [...seen.entries()].filter(([, c]) => c > 1).map(([p]) => p);
  const typeOf = (n: number) => billards.find((b) => b.num === n)?.type;
  const mixedLinks = Object.entries(plan.links)
    .map(([a, b]) => [Number(a), b] as const)
    .filter(([a, b]) => a < b && typeOf(a) !== typeOf(b))
    .map(([a]) => a);
  return {
    unplaced,
    duplicated,
    overloaded: overloaded.sort((a, b) => a - b),
    mixedLinks,
    ok: unplaced.length === 0 && duplicated.length === 0 && overloaded.length === 0,
  };
}

/**
 * Affectation de départ : 2 poules par billard ; un nombre impair de poules donne un groupe de
 * 3 poules sur 2 billards liés du même format (voisins si possible). Tirage aléatoire, sans
 * priorité des poules fortes sur les 3m10 (SPEC §3). S'il n'y a pas assez de billards, certains
 * en reçoivent 3.
 */
export function proposePlan(
  pouleCount: number,
  billards: Billard[],
  random: () => number = Math.random,
): TablePlan {
  const plan = emptyPlan();
  if (pouleCount <= 0 || billards.length === 0) return plan;
  const poules = shuffle(
    Array.from({ length: pouleCount }, (_, i) => i + 1),
    random,
  );
  const tables = shuffle(billards, random);
  const pairs = pouleCount % 2 === 1 && pouleCount >= 3;
  let link: [number, number] | null = null;
  if (pairs) {
    // Deux billards voisins du même format, choisis au hasard
    const sorted = [...billards].sort((a, b) => a.num - b.num);
    const candidates: [number, number][] = [];
    for (let i = 0; i + 1 < sorted.length; i++) {
      const x = sorted[i]!;
      const y = sorted[i + 1]!;
      if (x.type === y.type) candidates.push([x.num, y.num]);
    }
    link = candidates.length ? candidates[Math.floor(random() * candidates.length)]! : null;
  }
  const slots: { anchor: number; size: number }[] = [];
  if (link) {
    plan.links[link[0]] = link[1];
    plan.links[link[1]] = link[0];
    slots.push({ anchor: link[0], size: 3 });
  }
  const free = tables.filter((t) => !link || !link.includes(t.num));
  const remaining = pouleCount - (link ? 3 : 0);
  const needed = Math.ceil(remaining / 2);
  const singles = free.slice(0, Math.min(free.length, needed));
  // 2 poules par billard ; 3 si les billards manquent
  const per = singles.map((_, i) => Math.max(0, Math.min(2, remaining - 2 * i)));
  let leftover = remaining - per.reduce((x, y) => x + y, 0);
  for (let i = 0; leftover > 0 && i < per.length; i++, leftover--) per[i]!++;
  singles.forEach((t, i) => slots.push({ anchor: t.num, size: per[i]! }));
  let p = 0;
  for (const s of slots) {
    for (let i = 0; i < s.size && p < poules.length; i++) {
      (plan.place[s.anchor] ??= []).push(poules[p++]!);
    }
    plan.place[s.anchor]?.sort((a, b) => a - b);
  }
  return plan;
}
