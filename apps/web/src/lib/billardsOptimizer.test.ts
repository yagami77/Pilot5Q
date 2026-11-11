import type { Billard } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { checkPlan, planToAssignments } from "./assign";
import {
  optimizeBillards,
  planLoads,
  pouleMatches,
  threesOnBigTarget,
  type PouleSize,
} from "./billardsOptimizer";

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

  it("3 poules de 3, 4 × 3m10 et 6 × 2m80 (1,5 fois plus de 2m80) : une sur 3m10, deux sur 2m80", () => {
    const ps = poules(15, 3);
    const billards = tables(4, 6);
    const res = expectValid(ps, billards, 7);
    expect(res.loads.every((l) => l.matches > 0)).toBe(true);
    expect(res.maxLoad).toBe(12);
    expect(res.threesOnBigTarget).toBe(1);
    expect(res.threesOnBig).toBe(1);
    expect(res.threesOnSmall).toBe(2);
    // chaque poule de 3 allège un billard partagé avec une poule de 4 (9 matchs)
    const size = new Map(ps.map((p) => [p.num, p.size]));
    for (const [anchor, list] of Object.entries(res.plan.place)) {
      if (list.some((n) => size.get(n) === 3)) {
        expect(res.loads[Number(anchor) - 1]?.matches).toBe(9);
      }
    }
  });

  it("3 poules de 3, 4 × 3m10 et 4 × 2m80 (formats comparables) : deux sur 3m10, une sur 2m80", () => {
    const res = expectValid(poules(13, 3), tables(4, 4), 2);
    expect(res.threesOnBigTarget).toBe(2);
    expect(res.threesOnBig).toBe(2);
    expect(res.threesOnSmall).toBe(1);
  });

  it("2 poules de 3 : une sur 3m10, une sur 2m80", () => {
    const res = expectValid(poules(14, 2), tables(3, 5), 4);
    expect(res.threesOnBigTarget).toBe(1);
    expect(res.threesOnBig).toBe(1);
    expect(res.threesOnSmall).toBe(1);
  });

  it("1 poule de 3 : de préférence sur un 3m10", () => {
    const res = expectValid(poules(15, 1), tables(4, 4), 5);
    expect(res.threesOnBigTarget).toBe(1);
    expect(res.threesOnBig).toBe(1);
  });

  it("répartition visée des poules de 3 (règle du client)", () => {
    expect(threesOnBigTarget(0, 4, 7)).toBe(0);
    expect(threesOnBigTarget(1, 4, 7)).toBe(1);
    expect(threesOnBigTarget(2, 4, 7)).toBe(1);
    expect(threesOnBigTarget(3, 4, 4)).toBe(2);
    expect(threesOnBigTarget(3, 4, 5)).toBe(2);
    expect(threesOnBigTarget(3, 4, 6)).toBe(1);
    expect(threesOnBigTarget(3, 4, 7)).toBe(1);
    expect(threesOnBigTarget(2, 0, 8)).toBe(0);
    expect(threesOnBigTarget(2, 8, 0)).toBe(2);
  });

  it("des billards liés baissent la charge maximale quand c'est possible", () => {
    // 10 poules de 4 et 2 de 3 sur 8 billards : 9 matchs au plus au lieu de 12
    const res = expectValid(poules(10, 2), tables(4, 4));
    expect(res.maxLoad).toBe(9);
  });

  it("16 poules de 4 et 1 de 3 sur 11 billards : 9 matchs au plus, la poule de 3 avec une poule de 4", () => {
    const ps = poules(16, 1);
    const res = expectValid(ps, tables(4, 7));
    expect(res.maxLoad).toBe(9);
    expect(res.linkedGroups).toBe(5);
    // la charge prime : les 3m10 forment deux paires liées, la poule de 3 partage un 2m80
    // avec une poule de 4 (acceptable : « on peut la mettre sur un 2m80 »)
    const shared = Object.entries(res.plan.place).find(([, l]) => l.includes(17));
    expect(shared?.[1]).toHaveLength(2);
    expect(Number(shared?.[0])).toBeGreaterThanOrEqual(5);
    expect(res.threesOnSmall).toBe(1);
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

/* ---------- Propriétés sur toutes les configurations réalistes ---------- */

type Layout = (big: number, small: number) => Billard[];

/** Dispositions de salle : 3m10 d'abord, formats alternés, numéros non consécutifs. */
const LAYOUTS: Record<string, Layout> = {
  "3m10 puis 2m80": tables,
  "formats alternés": (big, small) => {
    const out: Billard[] = [];
    let b = big;
    let s = small;
    while (b > 0 || s > 0) {
      if (b-- > 0) out.push({ num: out.length + 1, type: "3m10" });
      if (s-- > 0) out.push({ num: out.length + 1, type: "2m80" });
    }
    return out;
  },
  "numéros non consécutifs": (big, small) =>
    tables(big, small).map((b) => ({ ...b, num: b.num * 2 })),
};

/**
 * Référence indépendante de l'optimiseur : meilleure charge possible (charge maximale, somme des
 * carrés, groupes liés, billards à 3 poules) en occupant tous les billards, et meilleur écart à
 * la règle des poules de 3 parmi les plans qui atteignent cette charge. Programmation dynamique
 * par format, plafond de charge par plafond de charge.
 */
type Cost = [squares: number, linked: number, triples: number];
const better = (a: Cost, b: Cost) => {
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  return false;
};
const sameCost = (a: Cost, b: Cost) => !better(a, b) && !better(b, a);

interface SlotType {
  tables: number;
  pairs: number;
  poules: number;
  threes: number;
  load: number;
  cost: Cost;
}
const SLOT_TYPES: SlotType[] = (
  [
    ["seul", 1, 1],
    ["double", 2, 1],
    ["triple", 3, 1],
    ["lié", 3, 2],
  ] as const
).flatMap(([kind, capacity, nbTables]) =>
  Array.from({ length: capacity + 1 }, (_, k3) => {
    const load = ((capacity - k3) * 6 + k3 * 3) / nbTables;
    return {
      tables: nbTables,
      pairs: kind === "lié" ? 1 : 0,
      poules: capacity,
      threes: k3,
      load,
      cost: [nbTables * load * load, kind === "lié" ? 1 : 0, kind === "triple" ? 1 : 0] as Cost,
    };
  }),
);
const LOAD_CAPS = [...new Set(SLOT_TYPES.map((t) => t.load))].sort((a, b) => a - b);

/** Paires disjointes de billards voisins (déjà filtrés sur un format). */
function disjointPairs(billards: Billard[]): number {
  const nums = billards.map((b) => b.num).sort((a, b) => a - b);
  let n = 0;
  for (let i = 0; i + 1 < nums.length; i++)
    if (nums[i + 1] === nums[i]! + 1) {
      n++;
      i++;
    }
  return n;
}

/** Meilleur coût pour occuper exactement `n` billards d'un format : « poules,poules de 3 » → coût. */
function formatCosts(n: number, pairs: number, cap: number, maxThrees: number) {
  let frontier = new Map<string, Cost>([["0,0,0,0", [0, 0, 0]]]);
  const seen = new Map(frontier);
  for (let step = 0; step < n; step++) {
    const next = new Map<string, Cost>();
    for (const [key, cost] of frontier) {
      const [t, p, q, k] = key.split(",").map(Number) as [number, number, number, number];
      for (const s of SLOT_TYPES) {
        if (s.load > cap || t + s.tables > n || p + s.pairs > pairs || k + s.threes > maxThrees)
          continue;
        const nk = `${t + s.tables},${p + s.pairs},${q + s.poules},${k + s.threes}`;
        const nc: Cost = [cost[0] + s.cost[0], cost[1] + s.cost[1], cost[2] + s.cost[2]];
        const old = seen.get(nk);
        if (!old || better(nc, old)) {
          seen.set(nk, nc);
          next.set(nk, nc);
        }
      }
    }
    frontier = next;
  }
  const out = new Map<string, Cost>();
  for (const [key, cost] of seen) {
    const [t, , q, k] = key.split(",").map(Number) as [number, number, number, number];
    if (t !== n) continue;
    const old = out.get(`${q},${k}`);
    if (!old || better(cost, old)) out.set(`${q},${k}`, cost);
  }
  return out;
}

function reference(billards: Billard[], maxThrees: number) {
  const big = billards.filter((b) => b.type === "3m10");
  const small = billards.filter((b) => b.type !== "3m10");
  const byCap = LOAD_CAPS.map((cap) => ({
    cap,
    big: formatCosts(big.length, disjointPairs(big), cap, maxThrees),
    small: formatCosts(small.length, disjointPairs(small), cap, maxThrees),
  }));
  /** Tous les billards occupés par `P` poules dont `T` poules de 3. */
  return (P: number, T: number, target: number) => {
    for (const { cap, big: bigCosts, small: smallCosts } of byCap) {
      const byThreesOnBig = new Map<number, Cost>();
      for (const [key, costBig] of bigCosts) {
        const [q, c] = key.split(",").map(Number) as [number, number];
        const costSmall = smallCosts.get(`${P - q},${T - c}`);
        if (!costSmall) continue;
        const cost: Cost = [
          costBig[0] + costSmall[0],
          costBig[1] + costSmall[1],
          costBig[2] + costSmall[2],
        ];
        const old = byThreesOnBig.get(c);
        if (!old || better(cost, old)) byThreesOnBig.set(c, cost);
      }
      if (byThreesOnBig.size === 0) continue;
      const best = [...byThreesOnBig.values()].reduce((a, b) => (better(b, a) ? b : a));
      const gap = Math.min(
        ...[...byThreesOnBig]
          .filter(([, cost]) => sameCost(cost, best))
          .map(([c]) => Math.abs(c - target)),
      );
      return { maxLoad: cap, cost: best, gap };
    }
    return null;
  };
}

describe("optimiseur : propriétés sur toutes les configurations réalistes", () => {
  // 3 à 6 billards 3m10, 3 à 9 billards 2m80 (au moins 8 en tout), 8 à 23 poules dont 0 à 3
  // poules de 3, trois dispositions de salle, plusieurs graines
  it("aucun billard vide, chaque poule placée, charge la plus basse, règle des poules de 3", () => {
    const failures: string[] = [];
    let cases = 0;
    for (const [layoutName, layout] of Object.entries(LAYOUTS))
      for (let big = 3; big <= 6; big++)
        for (let small = 3; small <= 9; small++) {
          if (big + small < 8) continue;
          const billards = layout(big, small);
          const B = billards.length;
          const typeOf = new Map(billards.map((b) => [b.num, b.type]));
          const best = reference(billards, 3);
          for (let P = 8; P <= 23; P++)
            for (let T = 0; T <= 3; T++) {
              const ps = poules(P - T, T);
              const target = threesOnBigTarget(T, big, small);
              const ref = P >= B ? best(P, T, target) : null;
              for (let seed = 1; seed <= 3; seed++) {
                cases++;
                const where = `${layoutName}, ${big} × 3m10 + ${small} × 2m80, ${P} poules dont ${T} de 3, graine ${seed}`;
                const fail = (why: string) => failures.push(`${where} : ${why}`);
                const res = optimizeBillards(ps, billards, seed);
                if (!res.ok) {
                  fail(res.reason);
                  continue;
                }
                // Chaque poule est placée une fois, sur des billards qui existent
                const issues = checkPlan(res.plan, P, billards);
                if (!issues.ok || issues.mixedLinks.length) fail("plan invalide");
                const placed = Object.entries(res.plan.place);
                if (placed.some(([a]) => !typeOf.has(Number(a)))) fail("billard inconnu");
                // Au plus 3 poules par billard seul ; une paire liée (voisine, même format) en a 3
                for (const [anchor, list] of placed) {
                  const pair = res.plan.links[Number(anchor)];
                  if (pair === undefined ? list.length > 3 : list.length !== 3)
                    fail(`${list.length} poules sur B${anchor}`);
                  if (pair !== undefined && Math.abs(pair - Number(anchor)) !== 1)
                    fail(`paire non voisine B${anchor}-B${pair}`);
                }
                const empty = res.loads.filter((l) => l.poules.length === 0).map((l) => l.billard);
                if (String(empty) !== String(res.emptyBillards)) fail("emptyBillards faux");
                const threesOnBig = ps
                  .filter((p) => p.size === 3)
                  .filter((p) => {
                    const at = placed.find(([, list]) => list.includes(p.num));
                    return at !== undefined && typeOf.get(Number(at[0])) === "3m10";
                  }).length;
                if (threesOnBig !== res.threesOnBig) fail("threesOnBig faux");
                const gap = Math.abs(res.threesOnBig - res.threesOnBigTarget);
                const saysThrees = res.notes.some((n) => n.startsWith("Poules de 3"));
                if (gap > 0 !== saysThrees) fail("écart à la règle des poules de 3 non annoncé");

                if (P < B) {
                  // Moins de poules que de billards : une poule par billard utilisé, sans lien,
                  // et les billards libres sont annoncés
                  if (placed.length !== P || placed.some(([, list]) => list.length !== 1))
                    fail("pas une poule par billard");
                  if (Object.keys(res.plan.links).length) fail("lien inutile");
                  if (empty.length !== B - P) fail(`${empty.length} billards libres`);
                  if (
                    !res.notes.some(
                      (n) => n.includes("restent libres") || n.includes("reste libre"),
                    )
                  )
                    fail("billards libres non annoncés");
                  // Règle des poules de 3 : toujours atteignable quand on choisit ses billards
                  const feasible = [];
                  for (let bt = Math.max(0, P - small); bt <= Math.min(big, P); bt++)
                    for (let c = Math.max(0, T - (P - bt)); c <= Math.min(T, bt); c++)
                      feasible.push(Math.abs(c - target));
                  if (gap !== Math.min(...feasible)) fail(`poules de 3 : écart ${gap}`);
                  continue;
                }
                // Au moins autant de poules que de billards : aucun billard vide
                if (empty.length) fail(`billards vides : ${empty.join(", ")}`);
                if (res.notes.some((n) => n.includes("libre")))
                  fail("note de billard libre à tort");
                if (!ref) {
                  fail("référence introuvable");
                  continue;
                }
                // Charge : identique à la meilleure possible (critères 2 et 3)
                const triples = placed.filter(
                  ([a, list]) => res.plan.links[Number(a)] === undefined && list.length === 3,
                ).length;
                const cost: Cost = [
                  res.loads.reduce((n, l) => n + l.matches * l.matches, 0),
                  res.linkedGroups,
                  triples,
                ];
                if (res.maxLoad !== ref.maxLoad || !sameCost(cost, ref.cost))
                  fail(`charge ${res.maxLoad}/${cost} au lieu de ${ref.maxLoad}/${ref.cost}`);
                // Règle des poules de 3 : respectée chaque fois qu'un plan de même charge le permet
                else if (gap !== ref.gap) fail(`poules de 3 : écart ${gap} au lieu de ${ref.gap}`);
              }
            }
        }
    expect(cases).toBeGreaterThan(10000);
    expect(failures.slice(0, 8)).toEqual([]);
    expect(failures).toHaveLength(0);
  }, 60_000);

  it("deux poules de 3 et un seul billard à 2 poules : réunies, 6 matchs partout", () => {
    // 9 poules sur 8 billards : avant, une poule de 3 restait seule (3 matchs) et l'autre
    // partageait un billard avec une poule de 4 (9 matchs)
    const res = expectValid(poules(7, 2), tables(3, 5));
    expect(res.loads.map((l) => l.matches)).toEqual(Array(8).fill(6));
    expect(res.linkedGroups).toBe(0);
    // la règle « une sur 3m10, une sur 2m80 » ne peut pas être tenue : le résultat le dit
    expect(Math.abs(res.threesOnBig - res.threesOnBigTarget)).toBe(1);
    expect(res.notes).toHaveLength(1);
    expect(res.notes[0]).toMatch(/^Poules de 3 : .* la charge des billards passe avant/);
  });

  it("moins de poules que de billards : les billards libres sont annoncés", () => {
    const res = expectValid(poules(8), tables(4, 7));
    expect(res.emptyBillards).toHaveLength(3);
    expect(res.notes).toEqual([
      `8 poules pour 11 billards : une poule par billard, 3 billards restent libres (B${res.emptyBillards.join(", B")}).`,
    ]);
    // tournoi d'exemple : rien à signaler
    const full = expectValid(poules(17), tables(4, 7));
    expect(full.emptyBillards).toEqual([]);
    expect(full.notes).toEqual([]);
  });
});
