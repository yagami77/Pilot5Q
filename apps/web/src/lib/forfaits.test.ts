import type { TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { demoEvents } from "./demo";
import { replay } from "./engine";
import { drawFridayPoules, forfaitImpact, fridayPlayers, preqStarted } from "./forfaits";

const at = "2026-10-30T10:00:00.000Z";
const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
const s0 = replay(base);
const drawn = replay([
  ...base,
  { type: "poules.drawn", at, payload: { phase: "PREQ", poules: drawFridayPoules(s0).poules } },
]);

describe("forfaits de dernière minute", () => {
  it("poule de 4 → poule de 3 sans toucher aux autres", () => {
    expect(preqStarted(drawn)).toBe(false);
    const p1 = drawn.poules.PREQ[0]!;
    const impact = forfaitImpact(drawn, p1.players[2]!);
    expect(impact.kind).toBe("poule3");
    expect(impact.poule).toBe(1);
    expect(impact.remaining).toHaveLength(3);
    expect(impact.summary).toContain("Poule 1 passe à 3 joueurs");
  });

  it("deuxième forfait dans la même poule → nouveau tirage, nombre de poules recalculé", () => {
    const p1 = drawn.poules.PREQ[0]!;
    const after = replay([
      ...base,
      { type: "poules.drawn", at, payload: { phase: "PREQ", poules: drawn.poules.PREQ } },
      {
        type: "forfait.declared",
        at,
        payload: { phase: "PREQ", player: p1.players[2]!, kind: "forfait" },
      },
    ]);
    const impact = forfaitImpact(after, p1.players[1]!);
    expect(impact.kind).toBe("retirage");
    // 68 joueurs du vendredi - 2 forfaits = 66 → 17 poules (15 de 4, 2 de 3) : pas de changement
    expect(impact.newPouleCount).toBe(17);
    expect(impact.pouleCountChanges).toBe(false);
    const redraw = drawFridayPoules(after, [p1.players[1]!]).poules;
    const names = redraw.flatMap((p) => p.players);
    expect(names).toHaveLength(66);
    expect(names).not.toContain(p1.players[1]);
    expect(names).not.toContain(p1.players[2]);
    expect(fridayPlayers(after)).toHaveLength(67);
  });

  it("forfait dans une poule de 3 → nouveau tirage", () => {
    const three = replay([
      ...base,
      {
        type: "poules.drawn",
        at,
        payload: {
          phase: "PREQ",
          poules: drawn.poules.PREQ.map((p, i) =>
            i === 0 ? { ...p, players: p.players.slice(0, 3), matches: [] } : p,
          ),
        },
      },
    ]);
    expect(forfaitImpact(three, three.poules.PREQ[0]!.players[0]!).kind).toBe("retirage");
  });
});
