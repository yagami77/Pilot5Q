import { describe, expect, it } from "vitest";

import { allRanked, sundayStart } from "@/test/weekend";

import { replay } from "./engine";
import { podiumOf } from "./podium";

describe("podium d'un tableau final", () => {
  it("3e et 4e distincts, dans l'ordre du classement final du tournoi", () => {
    const state = replay(allRanked());
    // Classement final de référence du TN 2 : Guerin (38,030) devant Duvernoy (38,016)
    expect(podiumOf(state, "M").places).toEqual([
      "COUPADE JULES",
      "DAVID NICOLAS",
      "GUERIN XAVIER",
      "DUVERNOY CHRISTOPHE",
    ]);
    // National : Hervelin (11,012) devant Wallart (11,010)
    expect(podiumOf(state, "N").places).toEqual([
      "ANDRIA FABRIZIO",
      "DELORME RONAN",
      "HERVELIN GABRIEL",
      "WALLART JEAN CHARLES",
    ]);
  });

  it("reste vide tant que les matchs ne sont pas joués", () => {
    expect(podiumOf(replay(sundayStart()), "M").places).toEqual(["", "", "", ""]);
  });
});
