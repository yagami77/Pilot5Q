import { describe, expect, it } from "vitest";

import { isValidScore, matchOutcome, rankPoule, rankPhase, setPoints } from "../src/index.js";
import type { Distance, Match, Poule } from "../src/index.js";

const oneSet: Distance = { pointsParSet: 100, setsGagnants: 1 };
const twoSets: Distance = { pointsParSet: 60, setsGagnants: 2 };
const threeSets: Distance = { pointsParSet: 60, setsGagnants: 3 };

const m = (
  a: string,
  b: string,
  sa: number | null,
  sb: number | null,
  extra: Partial<Match> = {},
): Match => ({
  id: `${a}-${b}`,
  a,
  b,
  sa,
  sb,
  ...extra,
});

const sets = (a: string, b: string, setsA: number[], setsB: number[]): Match => {
  let sa = 0;
  let sb = 0;
  setsA.forEach((x, i) => {
    if (x > (setsB[i] ?? 0)) sa++;
    else sb++;
  });
  return m(a, b, sa, sb, { setsA, setsB });
};

describe("isValidScore", () => {
  it("1 set : un joueur à 100, l'autre entre 0 et 99", () => {
    expect(isValidScore(m("A", "B", 100, 83), oneSet)).toBe(true);
    expect(isValidScore(m("A", "B", 0, 100), oneSet)).toBe(true);
    expect(isValidScore(m("A", "B", 100, 100), oneSet)).toBe(false);
    expect(isValidScore(m("A", "B", 101, 50), oneSet)).toBe(false);
    expect(isValidScore(m("A", "B", 90, 80), oneSet)).toBe(false);
    expect(isValidScore(m("A", "B", null, 80), oneSet)).toBe(false);
    expect(isValidScore(m("A", "B", 100, -1), oneSet)).toBe(false);
  });

  it("plusieurs sets : chaque set valide, arrêt dès le nombre de sets gagnants", () => {
    expect(isValidScore(sets("A", "B", [60, 60], [40, 12]), twoSets)).toBe(true);
    expect(isValidScore(sets("A", "B", [60, 30, 60], [40, 60, 12]), twoSets)).toBe(true);
    // Un set de trop après la victoire acquise
    expect(isValidScore(sets("A", "B", [60, 60, 60], [40, 12, 1]), twoSets)).toBe(false);
    // Set invalide
    expect(isValidScore(sets("A", "B", [60, 59], [40, 12]), twoSets)).toBe(false);
    // Match inachevé
    expect(isValidScore(sets("A", "B", [60], [40]), twoSets)).toBe(false);
    // Décompte incohérent avec les sets
    expect(isValidScore(m("A", "B", 2, 1, { setsA: [60, 60], setsB: [40, 12] }), twoSets)).toBe(
      false,
    );
    // Décompte seul accepté
    expect(isValidScore(m("A", "B", 3, 1), threeSets)).toBe(true);
    expect(isValidScore(m("A", "B", 3, 3), threeSets)).toBe(false);
  });

  it("forfait : toujours valide, l'adversaire vainqueur", () => {
    const f = m("A", "B", null, null, { forfait: "a" });
    expect(isValidScore(f, oneSet)).toBe(true);
    expect(matchOutcome(f, oneSet)?.winner).toBe("B");
  });
});

describe("points de set", () => {
  const ps = (match: Match, d: Distance): [number, number] => {
    const o = matchOutcome(match, d);
    if (!o) throw new Error("match non décidé");
    return setPoints(o, d);
  };
  it("1 set : 1 / 0", () => {
    expect(ps(m("A", "B", 100, 20), oneSet)).toEqual([1, 0]);
  });
  it("2 sets gagnants : 2-0 → 3/0, 2-1 → 2/1", () => {
    expect(ps(sets("A", "B", [60, 60], [1, 2]), twoSets)).toEqual([3, 0]);
    expect(ps(sets("A", "B", [60, 10, 60], [1, 60, 2]), twoSets)).toEqual([2, 1]);
  });
  it("3 sets gagnants : 3-0 → 5/0, 3-1 → 4/1, 3-2 → 3/2", () => {
    expect(ps(m("A", "B", 3, 0), threeSets)).toEqual([5, 0]);
    expect(ps(m("A", "B", 1, 3), threeSets)).toEqual([4, 1]);
    expect(ps(m("A", "B", 3, 2), threeSets)).toEqual([3, 2]);
  });
});

describe("rankPoule", () => {
  it("égalité à deux → match direct", () => {
    // A bat B, B bat C, C bat D, A bat C, A bat D, D bat B : A 6, B 2, C 2, D 2 → triangulaire.
    // Variante : A bat B, A bat C, A bat D ; B bat C ; C bat D ; B bat D → A 6, B 4, C 2, D 0.
    // Pour l'égalité à deux : A bat B, B bat C, C bat A ? non (3). Prenons :
    // A bat B, A bat C, A bat D, B bat C, D bat B, C bat D → A 6, B 2, C 2, D 2 (3) ;
    // Donc : A bat B, A bat C, A bat D, B bat C, B bat D, C bat D → pas d'égalité.
    // Égalité à deux : A bat B, A bat C, D bat A, B bat C, B bat D, C bat D → A 4, B 4, C 2, D 2.
    const matches = [
      m("A", "B", 100, 50),
      m("A", "C", 100, 50),
      m("D", "A", 100, 90),
      m("B", "C", 100, 50),
      m("B", "D", 100, 50),
      m("C", "D", 100, 50),
    ];
    const { rows, complete } = rankPoule(["A", "B", "C", "D"], matches, oneSet);
    expect(complete).toBe(true);
    // A et B à 4 points : A a battu B → A devant malgré une moyenne... vérifions C/D : C a battu D.
    expect(rows.map((r) => r.name)).toEqual(["A", "B", "C", "D"]);
    expect(rows.map((r) => r.rang)).toEqual([1, 2, 3, 4]);
    // Avec un score différent, la moyenne ne doit pas compter pour une égalité à deux.
    const matches2 = [
      m("A", "B", 100, 99),
      m("A", "C", 100, 99),
      m("D", "A", 100, 0),
      m("B", "C", 100, 0),
      m("B", "D", 100, 0),
      m("C", "D", 100, 50),
    ];
    const r2 = rankPoule(["A", "B", "C", "D"], matches2, oneSet).rows;
    expect(r2[0]?.name).toBe("A");
    expect(r2[1]?.name).toBe("B");
    expect(r2[0]!.moy).toBeLessThan(r2[1]!.moy);
  });

  it("triangulaire : égalité à trois → Ps puis moyenne puis ordre d'arrivée", () => {
    // A bat B, B bat C, C bat A ; tous battent D → A, B, C à 4 Pm.
    const matches = [
      m("A", "B", 100, 80),
      m("B", "C", 100, 80),
      m("C", "A", 100, 80),
      m("A", "D", 100, 20),
      m("B", "D", 100, 40),
      m("C", "D", 100, 60),
    ];
    const { rows } = rankPoule(["A", "B", "C", "D"], matches, oneSet);
    // Ps identiques (2) ; moyennes : A 200/100 = 2, B 200/120, C 200/140 → A, B, C, D.
    expect(rows.map((r) => r.name)).toEqual(["A", "B", "C", "D"]);
    expect(rows[0]?.ptm).toBe(4);
    expect(rows[0]?.pts).toBe(2);
    // Égalité parfaite de Ps et de moyenne → ordre d'arrivée.
    const tie = [
      m("A", "B", 100, 50),
      m("B", "C", 100, 50),
      m("C", "A", 100, 50),
      m("A", "D", 100, 50),
      m("B", "D", 100, 50),
      m("C", "D", 100, 50),
    ];
    const r = rankPoule(["A", "B", "C", "D"], tie, oneSet, {
      arrivee: { A: 30, B: 10, C: 20, D: 40 },
    }).rows;
    expect(r.map((x) => x.name)).toEqual(["B", "C", "A", "D"]);
    // Ps prime sur la moyenne en 2 sets gagnants.
    const s = [
      sets("A", "B", [60, 60], [10, 10]),
      sets("B", "C", [60, 1, 60], [50, 60, 50]),
      sets("C", "A", [60, 60], [59, 59]),
    ];
    const r3 = rankPoule(["A", "B", "C"], s, twoSets).rows;
    // Ps : A 3 (gagnant 2-0) + 0 = 3 ; B 0 + 2 = 2 ; C 1 + 3 = 4 → C, A, B.
    expect(r3.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });

  it("poule de 3 avec compensation : +2 Pm et +1 Ps en 1 set, +3 Ps en 2 sets gagnants", () => {
    const matches = [m("B", "C", 100, 10), m("A", "C", 100, 10), m("A", "B", 100, 10)];
    const { rows } = rankPoule(["A", "B", "C"], matches, oneSet, { compensate3: true });
    expect(rows.map((r) => [r.name, r.ptm, r.pts])).toEqual([
      ["A", 6, 3],
      ["B", 4, 2],
      ["C", 2, 1],
    ]);
    expect(rows[0]?.moy).toBeCloseTo(200 / 20, 9);
    const s = [
      sets("B", "C", [60, 60], [1, 1]),
      sets("A", "C", [60, 60], [1, 1]),
      sets("A", "B", [60, 60], [1, 1]),
    ];
    const r2 = rankPoule(["A", "B", "C"], s, twoSets, { compensate3: true }).rows;
    expect(r2.map((r) => [r.name, r.ptm, r.pts])).toEqual([
      ["A", 6, 9],
      ["B", 4, 6],
      ["C", 2, 3],
    ]);
  });

  it("rang null tant que la poule n'est pas complète", () => {
    const { rows, complete } = rankPoule(["A", "B", "C"], [m("B", "C", 100, 10)], oneSet);
    expect(complete).toBe(false);
    expect(rows.every((r) => r.rang === null)).toBe(true);
    expect(rows[0]?.name).toBe("B");
  });

  it("forfait : dernier avec 0 partout, matchs non joués gagnés par l'adversaire", () => {
    const matches = [m("B", "C", 100, 10), m("A", "C", null, null), m("A", "B", null, null)];
    const { rows, complete } = rankPoule(["A", "B", "C"], matches, oneSet, { forfaits: ["A"] });
    expect(complete).toBe(true);
    expect(rows.map((r) => r.name)).toEqual(["B", "C", "A"]);
    expect(rows[0]).toMatchObject({ ptm: 4, pts: 2, faits: 200, subis: 10, rang: 1 });
    expect(rows[1]).toMatchObject({ ptm: 2, pts: 1, faits: 110, subis: 100, rang: 2 });
    expect(rows[2]).toMatchObject({ ptm: 0, pts: 0, faits: 0, subis: 0, rang: 3 });
    // Points subis crédités à l'adversaire (SPEC §5)
    const r2 = rankPoule(["A", "B", "C"], matches, oneSet, {
      forfaits: ["A"],
      forfaitSubis: { B: 40, C: 55 },
    }).rows;
    expect(r2[0]?.subis).toBe(50);
    expect(r2[1]?.subis).toBe(155);
  });
});

describe("rankPhase", () => {
  it("classe par rang de poule, Pm, Ps, moyenne, arrivée ; forfaits en fin ; compense les poules de 3", () => {
    const p1: Poule = {
      num: 1,
      players: ["A", "B", "C", "D"],
      billards: [],
      matches: [
        m("B", "C", 100, 50),
        m("A", "D", 100, 50),
        m("A", "C", 100, 50),
        m("B", "D", 100, 50),
        m("A", "B", 100, 50),
        m("C", "D", 100, 50),
      ],
    };
    const p2: Poule = {
      num: 2,
      players: ["E", "F", "G"],
      billards: [],
      matches: [m("F", "G", 100, 50), m("E", "G", 100, 80), m("E", "F", 100, 80)],
    };
    const p3: Poule = {
      num: 3,
      players: ["H", "I", "J", "K"],
      billards: [],
      matches: [m("I", "J", 100, 50), m("H", "J", 100, 50), m("H", "I", 100, 50)],
    };
    const arrivee = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11 };
    const rows = rankPhase([p1, p2, p3], oneSet, arrivee, ["K"]);
    // Rang 1 : A, E, H à 6 Pm et 3 Ps (E et H compensés) ; moyennes 2,0 / 1,25 / 2,0 → A, H, E.
    expect(rows.map((r) => r.name)).toEqual([
      "A",
      "H",
      "E",
      "B",
      "F",
      "I",
      "C",
      "G",
      "J",
      "D",
      "K",
    ]);
    expect(rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // E : poule de 3 tirée → 4 + 2 = 6 Pm ; H : forfait de K avant le début → 4 + 2 Pm.
    expect(rows[2]).toMatchObject({ name: "E", ptm: 6, pts: 3, poule: 2, rang: 1 });
    expect(rows[1]).toMatchObject({ name: "H", ptm: 6, pts: 3, poule: 3, rang: 1 });
    expect(rows[10]).toMatchObject({ name: "K", ptm: 0, rang: 4 });
  });
});
