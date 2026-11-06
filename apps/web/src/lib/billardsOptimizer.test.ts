import type { Billard } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { checkPlan, planToAssignments } from "./assign";
import { optimizeBillards, planLoads, pouleMatches, type PouleSize } from "./billardsOptimizer";

const tables = (big: number, small: number): Billard[] => [
  ...Array.from({ length: big }, (_, i) => ({ num: i + 1, type: "3m10" as const })),
  ...Array.from({ length: small }, (_, i) => ({ num: big + i + 1, type: "2m80" as const })),
];

const poules = (fours: number, threes = 0): PouleSize[] =>
  Array.from({ length: fours + threes }, (_, i) => ({ num: i + 1, size: i < fours ? 4 : 3 }));

/** Contrôles communs : toutes les poules placées une fois, paires voisines du même format. */
function expectValid(ps: PouleSize[], billards: Billard[], seed = 1) {
  const res = optimizeBillards(ps, billards, seed);
  if (!res.ok) throw new Error(res.reason);
  expect(checkPlan(res.plan, ps.length, billards).ok).toBe(true);
  const typeOf = new Map(billards.map((b) => [b.num, b.type]));
  for (const [a, b] of Object.entries(res.plan.links)) {
    expect(Math.abs(Number(a) - b)).toBe(1);
    expect(typeOf.get(Number(a))).toBe(typeOf.get(b));
  }
  // Groupes liés : exactement 3 poules
  for (const [anchor, list] of Object.entries(res.plan.place)) {
    if (res.plan.links[Number(anchor)] !== undefined) expect(list).toHaveLength(3);
    expect(list.length).toBeLessThanOrEqual(3);
  }
  return res;
}

describe("optimiseur des billards du vendredi", () => {
  it("compte les matchs : 6 pour une poule de 4, 3 pour une poule de 3", () => {
    expect(pouleMatches(4)).toBe(6);
    expect(pouleMatches(3)).toBe(3);
  });

  it("17 poules sur 11 billards : tous occupés, charge maximale 12 et équilibrée", () => {
    const billards = tables(4, 7);
    for (let seed = 1; seed <= 20; seed++) {
      const res = expectValid(poules(17), billards, seed);
      expect(res.loads.every((l) => l.matches > 0)).toBe(true);
      expect(res.maxLoad).toBe(12);
      // Équilibre : un seul billard à 12 matchs, les autres à 9 (3 poules sur 2 billards)
      expect(res.loads.filter((l) => l.matches === 12)).toHaveLength(1);
      expect(res.linkedGroups).toBe(5);
    }
  });

  it("16 poules sur 8 billards : 2 poules par billard, 12 matchs partout, aucun lien", () => {
    const res = expectValid(poules(16), tables(3, 5));
    expect(res.loads.map((l) => l.matches)).toEqual(Array(8).fill(12));
    expect(res.linkedGroups).toBe(0);
  });

  it("15 poules de 4 et 3 de 3 sur 10 billards : 4 + 3 sur les premiers billards", () => {
    const ps = poules(15, 3);
    const billards = tables(4, 6);
    const res = expectValid(ps, billards, 7);
    expect(res.loads.every((l) => l.matches > 0)).toBe(true);
    expect(res.maxLoad).toBe(12);
    expect(res.mixedTables).toBe(3);
    const size = new Map(ps.map((p) => [p.num, p.size]));
    for (const b of [1, 2, 3]) {
      const sizes = (res.plan.place[b] ?? []).map((n) => size.get(n)).sort();
      expect(sizes).toEqual([3, 4]);
      expect(res.loads[b - 1]?.matches).toBe(9);
    }
  });

  it("des billards liés baissent la charge maximale quand c'est possible", () => {
    // 10 poules de 4 et 2 de 3 sur 8 billards : 9 matchs au plus au lieu de 12
    const res = expectValid(poules(10, 2), tables(4, 4));
    expect(res.maxLoad).toBe(9);
  });

  it("16 poules de 4 et 1 de 3 sur 11 billards : 9 matchs au plus, la 4 + 3 sur le billard resté seul", () => {
    const ps = poules(16, 1);
    const res = expectValid(ps, tables(4, 7));
    expect(res.maxLoad).toBe(9);
    expect(res.linkedGroups).toBe(5);
    expect(res.mixedTables).toBe(1);
    // 3m10 : 1+2 et 3+4 liés ; 2m80 : trois paires et un billard pour la poule de 4 + 3
    const mixed = Object.entries(res.plan.place).find(([, l]) => l.includes(17));
    expect(mixed?.[1]).toHaveLength(2);
    expect(Number(mixed?.[0])).toBeGreaterThanOrEqual(5);
  });

  it("moins de poules que de billards : une poule par billard", () => {
    const res = expectValid(poules(5, 1), tables(3, 5));
    expect(Object.values(res.plan.place).every((p) => p.length === 1)).toBe(true);
    expect(res.loads.filter((l) => l.matches > 0)).toHaveLength(6);
  });

  it("plus de 2 poules par billard : certains billards en reçoivent 3", () => {
    const res = expectValid(poules(20), tables(3, 5));
    expect(res.maxLoad).toBe(18);
    expect(res.loads.every((l) => l.matches >= 12)).toBe(true);
  });

  it("cas impossible : plus de 3 poules par billard", () => {
    const res = optimizeBillards(poules(25), tables(3, 5));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/au plus 3 poules par billard/);
  });

  it("déterministe pour une graine, variable d'une graine à l'autre", () => {
    const billards = tables(4, 7);
    const a = optimizeBillards(poules(17), billards, 3);
    const b = optimizeBillards(poules(17), billards, 3);
    expect(a).toEqual(b);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      const r = optimizeBillards(poules(17), billards, seed);
      if (r.ok) seen.add(JSON.stringify(planToAssignments(r.plan)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("charge d'un plan saisi à la main", () => {
    const billards = tables(3, 5);
    const loads = planLoads(
      { place: { 1: [1, 2], 4: [3, 4, 5] }, links: { 4: 5, 5: 4 } },
      poules(4, 1),
      billards,
    );
    expect(loads.map((l) => l.matches)).toEqual([12, 0, 0, 7.5, 7.5, 0, 0, 0]);
  });
});
