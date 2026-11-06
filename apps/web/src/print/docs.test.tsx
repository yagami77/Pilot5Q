import type { BracketMatch, TournamentEvent } from "@pilot5q/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";

import { docById } from "./docs";

describe("documents imprimés", () => {
  it("le tableau de la consolante imprime aussi le premier tour (seizièmes, barrages)", () => {
    const at = "2026-10-31T08:00:00.000Z";
    const base = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
    const names = base.players.map((p) => p.name);
    const m = (round: BracketMatch["round"], slot: number, a: string, b: string): BracketMatch => ({
      id: `CLS-${round}-${slot}`,
      round,
      slot,
      a,
      b,
      sa: null,
      sb: null,
    });
    const state = {
      ...base,
      brackets: {
        ...base.brackets,
        CLS: [
          m("R64", 1, names[60]!, names[61]!),
          m("R32", 1, names[40]!, names[41]!),
          m("R32", 2, names[42]!, names[43]!),
          { ...m("R16", 1, "", ""), labelA: "Vainqueur R32-1", labelB: "Vainqueur R32-2" },
        ],
      },
    };
    const doc = docById("tableau-consolante")!;
    expect(doc.available(state)).toBe(true);
    render(<>{doc.render(state)}</>);
    expect(screen.getByText(/Trente-deuxièmes/)).toBeInTheDocument();
    expect(screen.getByText(/Seizièmes/)).toBeInTheDocument();
    expect(screen.getByText(/Huitièmes/)).toBeInTheDocument();
    expect(screen.getByText("Vainqueur S1")).toBeInTheDocument();
  });
});
