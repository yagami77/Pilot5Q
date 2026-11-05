import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";

import { TournamentProvider, useTournament } from "./tournament";

const wrapper = ({ children }: { children: ReactNode }) => (
  <TournamentProvider persist={false}>{children}</TournamentProvider>
);

describe("consultation seule", () => {
  it("le store ignore toute modification tant qu'il est en lecture seule", () => {
    const { result } = renderHook(() => useTournament(), { wrapper });
    act(() => result.current.open("t-ro", demoEvents()));
    const n = result.current.events.length;
    act(() => result.current.setReadOnly(true));
    act(() => result.current.dispatch({ type: "phase.closed", payload: { phase: "PREQ" } }));
    act(() => result.current.undo());
    expect(result.current.events).toHaveLength(n);
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.setReadOnly(false));
    act(() => result.current.dispatch({ type: "phase.closed", payload: { phase: "PREQ" } }));
    expect(result.current.events).toHaveLength(n + 1);
  });
});
