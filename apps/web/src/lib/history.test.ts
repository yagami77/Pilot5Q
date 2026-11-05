import type { TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { describeEvent, matchPlace, undoableHistory } from "./history";

const at = "2026-10-30T10:00:00.000Z";

describe("historique lisible", () => {
  it("décrit un score avec sa poule", () => {
    expect(
      describeEvent({
        type: "score.entered",
        at,
        payload: { phase: "PREQ", matchId: "P3-M2", sa: 100, sb: 64 },
      }),
    ).toBe("Score 100–64 · poule 3");
    expect(matchPlace("QM", "P2-M1")).toBe("poule Masters 2");
    expect(matchPlace("B", "B4")).toBe("barrage B4");
  });

  it("liste les actions annulables, la plus récente d'abord, jusqu'à l'import", () => {
    const events: TournamentEvent[] = [
      { type: "players.imported", at, payload: { players: [] } },
      { type: "phase.closed", at, payload: { phase: "PREQ" } },
      {
        type: "forfait.declared",
        at,
        payload: { phase: "PREQ", player: "DUPONT JEAN", kind: "forfait" },
      },
    ];
    const h = undoableHistory(events, ["tournament.created", "players.imported"]);
    expect(h.map((x) => x.label)).toEqual([
      "Forfait de Dupont J.",
      "Classement · préqualifications",
    ]);
    expect(h[1]?.index).toBe(1);
  });
});
