import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  advanceBracket,
  consolanteBracket,
  mastersQF,
  nationalR16,
  seedOrder,
  toPoules,
} from "../src/index.js";
import type { BracketMatch, Match, Poule } from "../src/index.js";

const oneSet = DEFAULT_RULES.distances.preq;
const final = DEFAULT_RULES.distances.final;

/** Poule de 4 où le joueur i bat tous les joueurs j > i (ordre = classement). */
const wonPoule = (num: number, players: string[]): Poule => {
  const poule = toPoules([players], num)[0];
  if (!poule) throw new Error("poule");
  const rank = (n: string): number => players.indexOf(n);
  poule.matches = poule.matches.map((m) =>
    rank(m.a) < rank(m.b) ? { ...m, sa: 100, sb: 50 } : { ...m, sa: 50, sb: 100 },
  );
  return poule;
};

describe("croisements prédéfinis", () => {
  it("nationalR16 : les huit croisements de SPEC dans l'ordre du tableau réel (H1 = 1er P1–2e P8, H2 = 1er P7–2e P2, …)", () => {
    const poules = Array.from({ length: 8 }, (_, i) =>
      wonPoule(i + 1, [`P${i + 1}a`, `P${i + 1}b`, `P${i + 1}c`, `P${i + 1}d`]),
    );
    const r16 = nationalR16(poules, oneSet);
    expect(r16.map((m) => [m.id, m.a, m.b, m.labelA, m.labelB])).toEqual([
      ["N-R16-1", "P1a", "P8b", "1er P1", "2e P8"],
      ["N-R16-2", "P7a", "P2b", "1er P7", "2e P2"],
      ["N-R16-3", "P4a", "P5b", "1er P4", "2e P5"],
      ["N-R16-4", "P6a", "P3b", "1er P6", "2e P3"],
      ["N-R16-5", "P8a", "P1b", "1er P8", "2e P1"],
      ["N-R16-6", "P2a", "P7b", "1er P2", "2e P7"],
      ["N-R16-7", "P5a", "P4b", "1er P5", "2e P4"],
      ["N-R16-8", "P3a", "P6b", "1er P3", "2e P6"],
    ]);
    expect(r16.every((m) => m.round === "R16")).toBe(true);
    expect(r16.map((m) => m.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Les deux qualifiés d'une même poule sont dans des moitiés opposées du tableau.
    const half = (slot: number): number => (slot <= 4 ? 1 : 2);
    for (let p = 1; p <= 8; p++) {
      const first = r16.find((m) => m.a === `P${p}a`)?.slot ?? 0;
      const second = r16.find((m) => m.b === `P${p}b`)?.slot ?? 0;
      expect(half(first)).not.toBe(half(second));
    }
  });

  it("mastersQF : Q1 = 1er P1 vs 2e P4, Q2 = 1er P3 vs 2e P2, Q3 = 1er P4 vs 2e P1, Q4 = 1er P2 vs 2e P3", () => {
    const poules = Array.from({ length: 4 }, (_, i) =>
      wonPoule(i + 1, [`P${i + 1}a`, `P${i + 1}b`, `P${i + 1}c`, `P${i + 1}d`]),
    );
    const qf = mastersQF(poules, DEFAULT_RULES.distances.qm);
    expect(qf.map((m) => [m.id, m.a, m.b, m.labelA, m.labelB])).toEqual([
      ["M-QF1", "P1a", "P4b", "1er P1", "2e P4"],
      ["M-QF2", "P3a", "P2b", "1er P3", "2e P2"],
      ["M-QF3", "P4a", "P1b", "1er P4", "2e P1"],
      ["M-QF4", "P2a", "P3b", "1er P2", "2e P3"],
    ]);
  });
});

const score = (ms: BracketMatch[], id: string, patch: Partial<Match>): BracketMatch[] =>
  ms.map((m) => (m.id === id ? { ...m, ...patch } : m));

describe("advanceBracket", () => {
  it("crée les tours suivants et fait avancer les vainqueurs jusqu'à la finale", () => {
    const poules = Array.from({ length: 4 }, (_, i) =>
      wonPoule(i + 1, [`P${i + 1}a`, `P${i + 1}b`, `P${i + 1}c`, `P${i + 1}d`]),
    );
    let ms = advanceBracket(mastersQF(poules, DEFAULT_RULES.distances.qm), final);
    expect(ms.map((m) => m.id)).toEqual([
      "M-QF1",
      "M-QF2",
      "M-QF3",
      "M-QF4",
      "M-SF1",
      "M-SF2",
      "M-F",
    ]);
    const sf1 = ms.find((m) => m.id === "M-SF1");
    expect(sf1).toMatchObject({
      round: "SF",
      slot: 1,
      a: "",
      b: "",
      labelA: "Vainqueur QF1",
      labelB: "Vainqueur QF2",
    });
    ms = score(ms, "M-QF1", { sa: 3, sb: 1 });
    ms = score(ms, "M-QF2", { sa: 0, sb: 3 });
    ms = advanceBracket(ms, final);
    expect(ms.find((m) => m.id === "M-SF1")).toMatchObject({ a: "P1a", b: "P2b" });
    expect(ms.find((m) => m.id === "M-SF2")).toMatchObject({ a: "", b: "" });
    ms = score(ms, "M-QF3", { sa: 3, sb: 2 });
    ms = score(ms, "M-QF4", { forfait: "a" });
    ms = score(ms, "M-SF1", { sa: 3, sb: 0 });
    ms = advanceBracket(ms, final);
    expect(ms.find((m) => m.id === "M-SF2")).toMatchObject({ a: "P4a", b: "P3b" });
    expect(ms.find((m) => m.id === "M-F")).toMatchObject({
      a: "P1a",
      b: "",
      labelA: "Vainqueur SF1",
    });
    ms = score(ms, "M-SF2", { sa: 1, sb: 3 });
    ms = score(ms, "M-F", { sa: 3, sb: 2 });
    ms = advanceBracket(ms, final);
    expect(ms.find((m) => m.id === "M-F")).toMatchObject({ a: "P1a", b: "P3b", sa: 3, sb: 2 });
    expect(ms).toHaveLength(7);
    // Correction d'un quart : le vainqueur change, la demie est remise à zéro.
    ms = score(ms, "M-QF1", { sa: 1, sb: 3 });
    ms = advanceBracket(ms, final);
    expect(ms.find((m) => m.id === "M-SF1")).toMatchObject({
      a: "P4b",
      b: "P2b",
      sa: null,
      sb: null,
    });
    expect(ms.find((m) => m.id === "M-F")).toMatchObject({ a: "", b: "P3b", sa: null });
  });

  it("utilise une distance par tour (huitièmes en 1 set, suite en 3 sets)", () => {
    const poules = Array.from({ length: 8 }, (_, i) =>
      wonPoule(i + 1, [`P${i + 1}a`, `P${i + 1}b`, `P${i + 1}c`, `P${i + 1}d`]),
    );
    let ms = advanceBracket(nationalR16(poules, oneSet), final, {
      R16: DEFAULT_RULES.distances.huitiemes,
    });
    expect(ms).toHaveLength(15);
    expect(ms.find((m) => m.id === "N-F")?.round).toBe("F");
    ms = score(ms, "N-R16-1", { sa: 100, sb: 70 });
    ms = advanceBracket(ms, final, { R16: DEFAULT_RULES.distances.huitiemes });
    expect(ms.find((m) => m.id === "N-QF1")?.a).toBe("P1a");
  });
});

describe("consolanteBracket", () => {
  const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `C${i + 1}`);

  it("têtes de série classiques (1 vs n…) pour une puissance de 2", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const ms = consolanteBracket(names(8), 40);
    expect(ms.filter((m) => m.round === "QF").map((m) => [m.id, m.a, m.b])).toEqual([
      ["CLS-QF1", "C1", "C8"],
      ["CLS-QF2", "C4", "C5"],
      ["CLS-QF3", "C2", "C7"],
      ["CLS-QF4", "C3", "C6"],
    ]);
    expect(ms.map((m) => m.id)).toContain("CLS-F");
    expect(ms).toHaveLength(7);
  });

  it("exemptions pour les meilleures têtes de série si n n'est pas une puissance de 2", () => {
    const ms = consolanteBracket(names(13), 40);
    const r16 = ms.filter((m) => m.round === "R16");
    // 16 places, 13 joueurs : 3 exempts (TS 1, 2, 3), 5 matchs joués.
    expect(r16).toHaveLength(5);
    expect(r16.map((m) => m.slot)).toEqual([2, 3, 4, 6, 8]);
    const qf = ms.filter((m) => m.round === "QF");
    expect(qf).toHaveLength(4);
    expect(qf[0]).toMatchObject({
      id: "CLS-QF1",
      a: "C1",
      labelA: "TS 1 (exempt)",
      b: "",
      labelB: "Vainqueur R16-2",
    });
    expect(qf[2]).toMatchObject({ id: "CLS-QF3", a: "C2", labelA: "TS 2 (exempt)" });
    expect(qf[3]).toMatchObject({ id: "CLS-QF4", a: "C3", labelA: "TS 3 (exempt)" });
    // Les vainqueurs avancent normalement.
    let next = ms.map((m) => (m.id === "CLS-R16-2" ? { ...m, sa: 100, sb: 20 } : m));
    next = advanceBracket(next, oneSet);
    expect(next.find((m) => m.id === "CLS-QF1")).toMatchObject({ a: "C1", b: "C8" });
  });

  it("19 joueurs : tableau de 16 avec 3 barrages (TS 1 ↔ 14–19, TS 2 ↔ 15–18, TS 3 ↔ 16–17)", () => {
    const ms = consolanteBracket(names(19), 40);
    const pre = ms.filter((m) => m.round === "R32");
    expect(pre.map((m) => [m.slot, m.a, m.b])).toEqual([
      [2, "C14", "C19"],
      [10, "C15", "C18"],
      [14, "C16", "C17"],
    ]);
    const r16 = ms.filter((m) => m.round === "R16");
    expect(r16).toHaveLength(8);
    expect(r16.map((m) => [m.a, m.b])).toEqual([
      ["C1", ""],
      ["C8", "C9"],
      ["C4", "C13"],
      ["C5", "C12"],
      ["C2", ""],
      ["C7", "C10"],
      ["C3", ""],
      ["C6", "C11"],
    ]);
    expect(r16[0]?.labelB).toBe("Vainqueur R32-2");
    expect(ms).toHaveLength(3 + 8 + 4 + 2 + 1);
  });

  it("40 joueurs : tableau de 32 avec 8 barrages ; au-delà du maximum → erreur", () => {
    const ms = consolanteBracket(names(40), 40);
    expect(ms.filter((m) => m.round === "R64")).toHaveLength(8);
    expect(ms.filter((m) => m.round === "R32")).toHaveLength(16);
    const seed = (name: string): number => Number(name.slice(1));
    const pre = ms
      .filter((m) => m.round === "R64")
      .map((m) => [m.a, m.b])
      .sort((x, y) => seed(x[0] ?? "") - seed(y[0] ?? ""));
    expect(pre).toEqual([
      ["C25", "C40"],
      ["C26", "C39"],
      ["C27", "C38"],
      ["C28", "C37"],
      ["C29", "C36"],
      ["C30", "C35"],
      ["C31", "C34"],
      ["C32", "C33"],
    ]);
    expect(ms.filter((m) => m.round === "F")).toHaveLength(1);
    expect(() => consolanteBracket(names(41), 40)).toThrow(/maximum/);
    expect(consolanteBracket(names(2), 40).map((m) => m.id)).toEqual(["CLS-F"]);
  });
});
