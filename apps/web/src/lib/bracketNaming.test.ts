import type { BracketMatch } from "@pilot5q/domain";
import { consolanteBracket } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { bracketNaming } from "./bracketNaming";

const players = (n: number) => Array.from({ length: n }, (_, i) => `JOUEUR ${i + 1}`);
const bracket = (n: number) => consolanteBracket(players(n), 40);
const round = (ms: BracketMatch[], r: BracketMatch["round"]) =>
  ms.filter((m) => m.round === r).sort((x, y) => x.slot - y.slot);

describe("noms des tours et codes des matchs (B, S, H, Q, D, F)", () => {
  it("19 joueurs : trois barrages B1 à B3 dans l'ordre du tableau, puis H, Q, D, F", () => {
    const ms = bracket(19);
    const n = bracketNaming(ms);
    expect(n.barrages).toBe("R32");
    // Les identifiants du domaine ne changent pas (R32-2, R32-10, R32-14) ; seuls les codes
    // affichés sont B1, B2, B3, comme dans le classeur Excel
    expect(round(ms, "R32").map((m) => [m.id, n.code(m)])).toEqual([
      ["CLS-R32-2", "B1"],
      ["CLS-R32-10", "B2"],
      ["CLS-R32-14", "B3"],
    ]);
    expect(round(ms, "R16").map(n.code)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"]);
    expect(round(ms, "QF").map(n.code)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(round(ms, "SF").map(n.code)).toEqual(["D1", "D2"]);
    expect(round(ms, "F").map(n.code)).toEqual(["F"]);
    expect((["R32", "R16", "QF", "SF", "F"] as const).map(n.round)).toEqual([
      "Barrages",
      "Huitièmes",
      "Quarts",
      "Demi-finales",
      "Finale",
    ]);
    expect(n.match({ round: "R32", slot: 10 })).toBe("Barrage 2");
    expect(n.match({ round: "R16", slot: 3 })).toBe("Huitième 3");
    expect(n.match({ round: "F", slot: 1 })).toBe("Finale");
  });

  it("19 joueurs : le joueur attendu est désigné par le code de son barrage", () => {
    const ms = bracket(19);
    const n = bracketNaming(ms);
    const waiting = round(ms, "R16").map((m) => n.waiting(m.labelB));
    expect(waiting[0]).toBe("Vainqueur B1");
    expect(waiting[4]).toBe("Vainqueur B2");
    expect(waiting[6]).toBe("Vainqueur B3");
    expect(n.waiting("Vainqueur R16-8")).toBe("Vainqueur H8");
    expect(n.waiting("Vainqueur QF1")).toBe("Vainqueur Q1");
    expect(n.waiting("Vainqueur SF2")).toBe("Vainqueur D2");
    expect(n.waiting("TS 14")).toBe("TS 14");
    expect(n.waiting("TS 1 (exempt)")).toBe("TS 1 (exempt)");
    expect(n.waiting(undefined)).toBe("");
  });

  it("25 joueurs et plus : vrai tour de seizièmes, codes S par place dans le tableau", () => {
    const ms = bracket(28);
    const n = bracketNaming(ms);
    expect(n.barrages).toBeNull();
    expect(n.round("R32")).toBe("Seizièmes");
    expect(round(ms, "R32").map(n.code)).toEqual(round(ms, "R32").map((m) => `S${m.slot}`));
    expect(n.waiting("Vainqueur R32-2")).toBe("Vainqueur S2");
    const full = bracketNaming(bracket(32));
    expect(round(bracket(32), "R32").map(full.code)).toEqual(
      Array.from({ length: 16 }, (_, i) => `S${i + 1}`),
    );
  });

  it("33 à 40 joueurs : barrages avant de vrais seizièmes", () => {
    const ms = bracket(40);
    const n = bracketNaming(ms);
    expect(n.barrages).toBe("R64");
    expect(round(ms, "R64").map(n.code)).toEqual(["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]);
    expect(n.round("R64")).toBe("Barrages");
    expect(n.round("R32")).toBe("Seizièmes");
    expect(round(ms, "R32").map(n.code)).toEqual(Array.from({ length: 16 }, (_, i) => `S${i + 1}`));
    const firstWaiting = round(ms, "R32").find((m) => !m.b)?.labelB;
    expect(n.waiting(firstWaiting)).toBe("Vainqueur B1");
  });

  it("tableaux sans barrages (Masters, National, puissances de 2) : codes inchangés", () => {
    const ms = bracket(8);
    const n = bracketNaming(ms);
    expect(n.barrages).toBeNull();
    expect(round(ms, "QF").map(n.code)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(n.waiting("Vainqueur QF3")).toBe("Vainqueur Q3");
  });
});
