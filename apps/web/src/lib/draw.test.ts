import { describe, expect, it } from "vitest";

import { seededRandom } from "./billardsOptimizer";
import { drawPreqBillards } from "./draw";
import { makeBillards } from "./setup";

describe("tirage par défaut des billards des poules du vendredi", () => {
  it("ne laisse aucun billard vide dès qu'il y a au moins autant de poules que de billards", () => {
    const failures: string[] = [];
    for (let big = 3; big <= 6; big++)
      for (let small = 3; small <= 9; small++) {
        if (big + small < 8) continue;
        const billards = makeBillards(big, small);
        const B = billards.length;
        for (let poules = 8; poules <= 23; poules++)
          for (let seed = 1; seed <= 25; seed++) {
            const assign = drawPreqBillards(poules, billards, seededRandom(seed));
            const perTable = new Map<number, number>();
            for (const [b] of Object.values(assign)) perTable.set(b!, (perTable.get(b!) ?? 0) + 1);
            const counts = billards.map((b) => perTable.get(b.num) ?? 0);
            const expectedUsed = Math.min(B, poules);
            const used = counts.filter((n) => n > 0).length;
            // chaque poule a un billard qui existe ; charge répartie au plus juste
            const ok =
              Object.keys(assign).length === poules &&
              used === expectedUsed &&
              Math.max(...counts) === Math.ceil(poules / B) &&
              Math.max(...counts) <= 3;
            if (!ok) failures.push(`${big}+${small} billards, ${poules} poules, graine ${seed}`);
          }
      }
    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it("tournoi d'exemple (17 poules, 11 billards) : les 11 billards reçoivent 1 ou 2 poules", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const assign = drawPreqBillards(17, makeBillards(4, 7), seededRandom(seed));
      const counts = new Map<number, number>();
      for (const [b] of Object.values(assign)) counts.set(b!, (counts.get(b!) ?? 0) + 1);
      expect(counts.size).toBe(11);
      expect(Math.max(...counts.values())).toBe(2);
    }
  });
});
