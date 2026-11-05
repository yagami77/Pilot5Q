import { describe, expect, it } from "vitest";

import {
  clubConflicts,
  pouleMatches,
  resolveClubConflicts,
  serpentin,
  serpentinOrder,
} from "../src/index.js";

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `J${i + 1}`);

describe("serpentin", () => {
  it("68 joueurs → 17 poules de 4 en zigzag", () => {
    const p = serpentin(names(68), 3);
    expect(p).toHaveLength(17);
    expect(p.every((x) => x.length === 4)).toBe(true);
    expect(p[0]).toEqual(["J1", "J34", "J35", "J68"]);
    expect(p[16]).toEqual(["J17", "J18", "J51", "J52"]);
  });

  it("67 → 16×4 + 1×3, la poule de 3 en dernier", () => {
    const p = serpentin(names(67), 3);
    expect(p.map((x) => x.length)).toEqual([...Array<number>(16).fill(4), 3]);
    expect(p[16]).toEqual(["J17", "J18", "J51"]);
    expect(p[15]).toEqual(["J16", "J19", "J50", "J52"]);
  });

  it("61 → 13×4 + 3×3 ; 65 → 14×4 + 3×3 ; 60 → 15×4", () => {
    expect(serpentin(names(61), 3).map((x) => x.length)).toEqual([
      ...Array<number>(13).fill(4),
      3,
      3,
      3,
    ]);
    expect(serpentin(names(65), 3).map((x) => x.length)).toEqual([
      ...Array<number>(14).fill(4),
      3,
      3,
      3,
    ]);
    expect(serpentin(names(60), 3).map((x) => x.length)).toEqual(Array<number>(15).fill(4));
  });

  it("lève une erreur explicite quand il faudrait trop de poules de 3", () => {
    expect(() => serpentin(names(61), 2)).toThrow(/poule\(s\) de 3/);
    expect(() => serpentin(names(5), 3)).toThrow();
    expect(() => serpentin(names(2), 3)).toThrow();
  });

  it("serpentinOrder reconstitue la liste linéaire", () => {
    for (const n of [67, 61, 16, 3]) {
      expect(serpentinOrder(serpentin(names(n), 3))).toEqual(names(n));
    }
  });
});

describe("resolveClubConflicts", () => {
  it("décale le moins bien classé des trois d'un cran vers le bas", () => {
    // 16 joueurs, 4 poules ; poule 1 reçoit J1, J8, J9, J16 : mettons-les au même club.
    const clubOf: Record<string, string> = Object.fromEntries(
      names(16).map((n) => [n, `club-${n}`]),
    );
    clubOf.J1 = "X";
    clubOf.J8 = "X";
    clubOf.J9 = "X";
    const drawn = serpentin(names(16), 0);
    expect(clubConflicts(drawn, clubOf)).toEqual([1]);
    const { poules, unresolved } = resolveClubConflicts(drawn, clubOf);
    expect(unresolved).toEqual([]);
    expect(clubConflicts(poules, clubOf)).toEqual([]);
    // J9 (le moins bien classé) a échangé sa place avec J10 : il passe en poule 2.
    expect(poules[0]).toEqual(["J1", "J8", "J10", "J16"]);
    expect(poules[1]).toEqual(["J2", "J7", "J9", "J15"]);
    // Les poules sans conflit ne bougent pas.
    expect(poules[2]).toEqual(drawn[2]);
    expect(poules[3]).toEqual(drawn[3]);
  });

  it("signale les poules non résolues quand c'est impossible", () => {
    const clubOf: Record<string, string> = Object.fromEntries(names(4).map((n) => [n, "X"]));
    const { poules, unresolved } = resolveClubConflicts(serpentin(names(4), 0), clubOf);
    expect(unresolved).toEqual([1]);
    expect(poules[0]).toHaveLength(4);
  });
});

describe("pouleMatches", () => {
  it("poule de 4 : 2–3, 1–4, 1–3, 2–4, 1–2, 3–4 avec ids stables", () => {
    const ms = pouleMatches(5, ["A", "B", "C", "D"]);
    expect(ms.map((m) => m.id)).toEqual(["P5-M1", "P5-M2", "P5-M3", "P5-M4", "P5-M5", "P5-M6"]);
    expect(ms.map((m) => [m.a, m.b])).toEqual([
      ["B", "C"],
      ["A", "D"],
      ["A", "C"],
      ["B", "D"],
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(ms.every((m) => m.sa === null && m.sb === null)).toBe(true);
  });

  it("poule de 3 : 2–3, 1–3, 1–2", () => {
    const ms = pouleMatches(17, ["A", "B", "C"]);
    expect(ms.map((m) => [m.id, m.a, m.b])).toEqual([
      ["P17-M1", "B", "C"],
      ["P17-M2", "A", "C"],
      ["P17-M3", "A", "B"],
    ]);
  });
});
