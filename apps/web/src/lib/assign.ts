/**
 * Affectation des billards aux poules du vendredi, vue « par billard » (retours du 5 novembre) :
 * on part des billards et on y place 1 à 3 poules ; deux billards du même format peuvent être
 * liés pour accueillir 3 poules ensemble. Le résultat alimente `billards.assigned` (clé =
 * numéro de poule, valeur = billard(s) ; une poule sur deux billards liés porte les deux
 * numéros).
 */
import type { Billard } from "@pilot5q/domain";

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
