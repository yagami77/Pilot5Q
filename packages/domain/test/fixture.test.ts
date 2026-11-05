import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DEFAULT_RULES } from "../src/index.js";
import type { Billard, Player, Poule } from "../src/index.js";

interface Fixture {
  tournament: { name: string; season: string; mastersPrequalified: number };
  billards: Billard[];
  players: Player[];
  poules: Poule[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures", "tn-exemple.json"), "utf8"),
) as Fixture;

describe("fixture tn-exemple", () => {
  it("contient 76 joueurs", () => {
    expect(fixture.players).toHaveLength(76);
  });

  it("décrit 11 billards dont 4 de 3m10", () => {
    expect(fixture.billards).toHaveLength(11);
    expect(fixture.billards.filter((b) => b.type === "3m10")).toHaveLength(4);
  });

  it("utilise les paramètres par défaut de la spécification", () => {
    expect(fixture.tournament.mastersPrequalified).toBe(DEFAULT_RULES.mastersPrequalified);
    expect(DEFAULT_RULES.distances.preq).toEqual({ pointsParSet: 100, setsGagnants: 1 });
  });
});
