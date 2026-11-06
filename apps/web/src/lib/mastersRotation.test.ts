import type { Billard, Distance, Poule } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { pouleMatches } from "./engine";
import { mastersRotation } from "./mastersRotation";

const d: Distance = { pointsParSet: 100, setsGagnants: 1 };

function poule(num: number, size = 4): Poule {
  const players = Array.from({ length: size }, (_, i) => `P${num} J${i + 1}`);
  return { num, players, billards: [], matches: pouleMatches(num, players) };
}

const big = (nums: number[]): Billard[] => nums.map((num) => ({ num, type: "3m10" }));

describe("tours de jeu Masters", () => {
  it("3 billards : les poules 1 à 3 commencent, la poule 4 prend le premier billard libéré", () => {
    const poules = [1, 2, 3, 4].map((n) => poule(n));
    const assign: Record<number, number[]> = { 1: [2], 2: [3], 3: [1], 4: [2] };
    const r = mastersRotation(poules, (p) => assign[p.num] ?? [], big([1, 2, 3]), d);
    expect(r.needed).toBe(true);
    expect(r.rows).toHaveLength(24);
    expect(r.rows.slice(0, 8).map((x) => `P${x.poule}M${x.match}`)).toEqual([
      "P1M1",
      "P2M1",
      "P3M1",
      "P4M1",
      "P1M2",
      "P2M2",
      "P3M2",
      "P4M2",
    ]);
    // Billards de départ des poules 1 à 3 ; ensuite « premier billard libéré »
    expect(r.rows.slice(0, 3).map((x) => x.billard)).toEqual([2, 3, 1]);
    expect(r.rows[3]?.billard).toBeNull();
    // Indication à durée égale : le billard de la poule 1 se libère le premier
    expect(r.rows[3]?.billardHint).toBe(2);
    expect(r.rows[4]?.billardHint).toBe(3);
    // Tours indicatifs : 3 matchs par tour
    expect(r.rows.map((x) => x.tour)).toEqual(
      Array.from({ length: 24 }, (_, k) => Math.floor(k / 3) + 1),
    );
    // Les 2 premiers matchs d'une poule de 4 sont connus : 2 contre 3, puis 1 contre 4
    expect(r.rows[0]).toMatchObject({ a: "P1 J2", b: "P1 J3", known: true });
    expect(r.rows[4]).toMatchObject({ a: "P1 J1", b: "P1 J4", known: true });
    expect(r.rows[8]).toMatchObject({ a: "Perdant du 2 c. 3", known: false, arbitre: null });
  });

  it("jamais deux matchs d'une même poule dans le même tour", () => {
    const r = mastersRotation(
      [1, 2, 3, 4].map((n) => poule(n)),
      () => [],
      big([5, 6, 7]),
      d,
    );
    for (let t = 1; t <= 8; t++) {
      const poules = r.rows.filter((x) => x.tour === t).map((x) => x.poule);
      expect(new Set(poules).size).toBe(poules.length);
    }
    expect(r.billards).toEqual([5, 6, 7]);
  });

  it("les joueurs des matchs 3 à 6 apparaissent quand les deux premiers sont joués", () => {
    const p1 = poule(1);
    const set = (a: string, b: string, sa: number, sb: number) => {
      const m = p1.matches.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))!;
      m.sa = m.a === a ? sa : sb;
      m.sb = m.a === a ? sb : sa;
    };
    set("P1 J2", "P1 J3", 100, 40); // gagnant J2
    set("P1 J1", "P1 J4", 30, 100); // gagnant J4
    const r = mastersRotation([p1, poule(2), poule(3), poule(4)], () => [], big([1, 2, 3]), d);
    const m3 = r.rows.find((x) => x.poule === 1 && x.match === 3)!;
    expect(m3.known).toBe(true);
    expect([m3.a, m3.b].sort()).toEqual(["P1 J1", "P1 J3"]);
    expect(r.rows.filter((x) => x.played)).toHaveLength(2);
  });

  it("4 billards : chaque poule garde son billard, pas de rotation", () => {
    const assign: Record<number, number[]> = { 1: [4], 2: [3], 3: [2], 4: [1] };
    const r = mastersRotation(
      [1, 2, 3, 4].map((n) => poule(n)),
      (p) => assign[p.num] ?? [],
      big([1, 2, 3, 4]),
      d,
    );
    expect(r.needed).toBe(false);
    expect(r.rows.filter((x) => x.poule === 1).every((x) => x.billard === 4)).toBe(true);
    expect(r.rows.map((x) => x.tour).slice(0, 8)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("poule de 3 après un forfait : 3 matchs dans la rotation", () => {
    const r = mastersRotation(
      [poule(1), poule(2), poule(3, 3), poule(4)],
      () => [],
      big([1, 2, 3]),
      d,
    );
    expect(r.rows).toHaveLength(21);
    expect(r.rows.filter((x) => x.poule === 3).map((x) => x.match)).toEqual([1, 2, 3]);
  });
});
