/** Suppression d'une saison : rien de ce qui en dépend ne reste dans le navigateur. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb-keyval", () => ({
  get: (key: string) => Promise.resolve(memory.get(key)),
  set: (key: string, value: unknown) => {
    memory.set(key, value);
    return Promise.resolve();
  },
  del: (key: string) => {
    memory.delete(key);
    return Promise.resolve();
  },
}));

import { LocalAuthProvider, memoryStore } from "@/auth/local";
import { notificationsKey } from "@/lib/notifications";
import { eventsKey } from "@/store/persistence";

import { emptySeason } from "./demo";
import { purgeSeasonData, seasonTournamentIds } from "./reset";

const INDEX = "pilot5q:index";

describe("suppression d'une saison", () => {
  beforeEach(() => memory.clear());

  it("retire les tournois, les accès des DJ, les notifications et les pièces jointes de la saison", async () => {
    const auth = new LocalAuthProvider(memoryStore());
    const doc = emptySeason("2026-2027");
    const stage = doc.stages[1];
    if (!stage) throw new Error("étape absente");
    const current = `${stage.id}-bbb`;
    const former = `${stage.id}-aaa`;
    const foreign = "demo-tournoi";
    stage.tournamentId = current;
    await auth.issueDjAccess({
      stageId: stage.id,
      stageName: "TN 2 2026-2027",
      city: "Ronchin",
      seasonId: doc.id,
      tournamentId: current,
      dj: { name: "MARTIN PAUL", email: "paul.martin@exemple.fr", licence: "", phone: "" },
    });
    await auth.issueDjAccess({
      stageId: "tn1-2027-2028",
      stageName: "TN 1 2027-2028",
      city: "Laxou",
      seasonId: "2027-2028",
      tournamentId: "tn1-2027-2028-ccc",
      dj: { name: "DURAND LUC", email: "luc.durand@exemple.fr", licence: "", phone: "" },
    });
    for (const id of [current, former, foreign]) {
      memory.set(eventsKey(id), [{ type: "tournament.created" }]);
      memory.set(notificationsKey(id), [{ id: "n1" }]);
    }
    memory.set(
      INDEX,
      [current, former, foreign].map((id) => ({ id, name: id, city: "", updatedAt: "" })),
    );
    memory.set(`pilot5q:attachments:${stage.id}`, [
      { id: "piece-1", name: "plan.pdf", type: "application/pdf", size: 3, addedAt: "" },
    ]);
    memory.set("pilot5q:attachment:piece-1", new Blob(["abc"]));

    expect((await seasonTournamentIds(doc, auth)).sort()).toEqual([former, current]);
    const purge = await purgeSeasonData(doc, auth);
    expect(purge.tournaments.sort()).toEqual([former, current]);
    expect(purge).toMatchObject({ accesses: 1, attachments: 1 });

    // Le tournoi de la saison et son ancienne ouverture ont disparu, pas le tournoi étranger.
    for (const id of [current, former]) {
      expect(memory.has(eventsKey(id))).toBe(false);
      expect(memory.has(notificationsKey(id))).toBe(false);
    }
    expect(memory.has(eventsKey(foreign))).toBe(true);
    expect(memory.has(notificationsKey(foreign))).toBe(true);
    expect((memory.get(INDEX) as { id: string }[]).map((t) => t.id)).toEqual([foreign]);
    expect(memory.has("pilot5q:attachment:piece-1")).toBe(false);
    expect(memory.get(`pilot5q:attachments:${stage.id}`)).toEqual([]);
    // Le code du DJ de la saison ne fonctionne plus ; celui d'une autre saison reste.
    expect(await auth.getDjAccess(stage.id)).toBeNull();
    expect(await auth.getDjAccess("tn1-2027-2028")).not.toBeNull();
  });
});
