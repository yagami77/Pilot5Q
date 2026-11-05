import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { addNotification, listNotifications, markRead, notificationsKey, useNotifications } =
  await import("./notifications");

describe("notifications", () => {
  beforeEach(() => store.clear());

  it("ajoute, liste (plus récente d'abord) et marque comme lues", async () => {
    await addNotification({
      tournamentId: "t1",
      kind: "forfait",
      title: "Forfait de Martin",
      body: "Déclaré par le responsable",
      impact: "Poule 5 passe à 3 joueurs",
      at: "2026-11-05T10:00:00.000Z",
    });
    await addNotification({
      tournamentId: "t1",
      kind: "info",
      title: "Info",
      body: "…",
      at: "2026-11-05T11:00:00.000Z",
    });
    const list = await listNotifications("t1");
    expect(list.map((n) => n.title)).toEqual(["Info", "Forfait de Martin"]);
    expect(list.every((n) => !n.read)).toBe(true);
    expect(store.has(notificationsKey("t1"))).toBe(true);
    await markRead("t1", list[1]!.id);
    expect((await listNotifications("t1")).filter((n) => n.read)).toHaveLength(1);
    await markRead("t1");
    expect((await listNotifications("t1")).every((n) => n.read)).toBe(true);
    expect(await listNotifications("t2")).toEqual([]);
  });

  it("le hook se rafraîchit quand une notification arrive", async () => {
    const { result } = renderHook(() => useNotifications("t1"));
    await waitFor(() => expect(result.current.notifications).toEqual([]));
    await act(async () => {
      await addNotification({
        tournamentId: "t1",
        kind: "inscription",
        title: "Nouvel inscrit",
        body: "",
      });
    });
    await waitFor(() => expect(result.current.unread).toHaveLength(1));
    await act(async () => {
      await result.current.markRead();
    });
    await waitFor(() => expect(result.current.unread).toHaveLength(0));
  });
});
