import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoEvents } from "@/lib/demo";

const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    store.delete(k);
  }),
}));

const { TournamentProvider, useTournament } = await import("./tournament");

const wrapper = ({ children }: { children: ReactNode }) => (
  <TournamentProvider>{children}</TournamentProvider>
);

describe("store du tournoi", () => {
  beforeEach(() => store.clear());

  it("ouvre un tournoi, dispatch, annule et persiste le journal", async () => {
    const { result } = renderHook(() => useTournament(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.id).toBeNull();

    act(() => result.current.open("demo-test", demoEvents()));
    expect(result.current.state.players).toHaveLength(76);
    expect(result.current.canUndo).toBe(true);

    act(() =>
      result.current.dispatch({
        type: "billards.assigned",
        payload: { phase: "B", assignments: { B1: [9] } },
      }),
    );
    expect(result.current.state.billardAssignments.B?.B1).toEqual([9]);
    await waitFor(() => expect(store.get("pilot5q:events:demo-test")).toBeDefined());
    await waitFor(() => expect(result.current.savedAt).not.toBeNull());
    const saved = store.get("pilot5q:events:demo-test") as unknown[];
    expect(saved).toHaveLength(result.current.events.length);
    expect(store.get("pilot5q:current")).toBe("demo-test");

    act(() => result.current.undo());
    expect(result.current.state.billardAssignments.B?.B1).not.toEqual([9]);
    await waitFor(() =>
      expect((store.get("pilot5q:events:demo-test") as unknown[]).length).toBe(
        result.current.events.length,
      ),
    );
  });

  it("ne permet pas d'annuler la création ni l'import", async () => {
    const { result } = renderHook(() => useTournament(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.open("t", demoEvents().slice(0, 2)));
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.undo());
    expect(result.current.events).toHaveLength(2);
  });

  it("recharge le tournoi courant depuis IndexedDB", async () => {
    store.set("pilot5q:current", "ancien");
    store.set(
      "pilot5q:events:ancien",
      demoEvents().map((e) => ({ ...e, at: "2026-10-29T10:00:00Z" })),
    );
    const { result } = renderHook(() => useTournament(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.id).toBe("ancien");
    expect(result.current.state.info?.name).toBe("TN 2");
  });
});
