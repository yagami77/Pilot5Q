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

  it("une annulation ne perd rien : « Rétablir » remet les actions telles quelles", async () => {
    const { result } = renderHook(() => useTournament(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.open("redo-test", demoEvents()));
    const assign = (b: number) =>
      act(() =>
        result.current.dispatch({
          type: "billards.assigned",
          payload: { phase: "B", assignments: { B1: [b] } },
        }),
      );
    assign(9);
    assign(10);
    assign(11);
    const full = result.current.events;
    expect(result.current.canRedo).toBe(false);

    // Retour deux actions en arrière, puis une de plus : deux groupes à rétablir
    act(() => result.current.undoTo(full.length - 2));
    act(() => result.current.undo());
    expect(result.current.events).toHaveLength(full.length - 3);
    expect(result.current.redoStack.map((g) => g.length)).toEqual([2, 1]);
    expect(result.current.canRedo).toBe(true);
    await waitFor(() => expect(store.get("pilot5q:redo:redo-test")).toHaveLength(2));

    // Rétablir remet le dernier groupe, puis l'autre : journal identique, horodatages compris
    act(() => result.current.redo());
    expect(result.current.events).toHaveLength(full.length - 2);
    act(() => result.current.redo());
    expect(result.current.events).toEqual(full);
    expect(result.current.state.billardAssignments.B?.B1).toEqual([11]);
    expect(result.current.canRedo).toBe(false);
    await waitFor(() => expect(store.get("pilot5q:redo:redo-test")).toBeUndefined());

    // « Tout rétablir » d'un coup
    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.redo(true));
    expect(result.current.events).toEqual(full);

    // Une nouvelle action après une annulation vide la pile
    act(() => result.current.undo());
    assign(12);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state.billardAssignments.B?.B1).toEqual([12]);
  });

  it("recharge les actions annulées avec le tournoi", async () => {
    const at = "2026-10-29T10:00:00Z";
    const evs = demoEvents().map((e) => ({ ...e, at }));
    store.set("pilot5q:current", "ancien");
    store.set("pilot5q:events:ancien", evs);
    store.set("pilot5q:redo:ancien", [
      [{ type: "billards.assigned", at, payload: { phase: "B", assignments: { B1: [9] } } }],
    ]);
    const { result } = renderHook(() => useTournament(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.state.billardAssignments.B?.B1).toEqual([9]);
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
