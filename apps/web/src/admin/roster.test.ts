/** Inscrits modifiés après l'ouverture au DJ : répercussion dans le journal et notification. */
import type { Player, TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";
import type { NotificationInput } from "@/lib/notifications";

import { demoSeason, type DemoInscription } from "./demo";
import type { SeasonDocument } from "./persistence";
import {
  rosterDiff,
  rosterNotification,
  syncRoster,
  wednesdayBefore,
  type RosterIO,
} from "./roster";
import { openingEvents, stageAcceptance } from "./stage";

const order = (inscriptions as { registrations: DemoInscription[] }).registrations;

/** Saison de démo avec un TN 2 réduit à 8 billards (72 places) : 4 joueurs en liste d'attente. */
function setup() {
  const base = demoSeason(order);
  const doc: SeasonDocument = {
    ...base,
    stages: base.stages.map((s) => (s.number === 2 ? { ...s, big: 4, small: 4 } : s)),
  };
  const stage = doc.stages.find((s) => s.number === 2)!;
  const a = stageAcceptance(doc, stage);
  const events: TournamentEvent[] = openingEvents(doc, stage, a.accepted, () => 0.5).map(
    (e) => ({ ...e, at: "2026-10-26T10:00:00Z" }) as TournamentEvent,
  );
  const notes: NotificationInput[] = [];
  const io: RosterIO = {
    load: async () => events,
    append: async (e) => {
      events.push({ ...e, at: "2026-10-27T10:00:00Z" } as TournamentEvent);
    },
    notify: async (n) => notes.push(n),
  };
  const forfait = (d: SeasonDocument, licence: string, value = true): SeasonDocument => ({
    ...d,
    registrations: {
      ...d.registrations,
      [stage.id]: {
        ...d.registrations[stage.id]!,
        registrations: d.registrations[stage.id]!.registrations.map((r) =>
          r.licence === licence ? { ...r, forfait: value } : r,
        ),
      },
    },
  });
  return { doc, stage, a, events, notes, io, forfait };
}

describe("répercussion des inscrits après ouverture", () => {
  it("le TN réduit a bien une liste d'attente", () => {
    const { a } = setup();
    expect(a.accepted).toHaveLength(72);
    expect(a.waiting).toHaveLength(4);
  });

  it("un forfait fait entrer le premier de la liste d'attente, dans le journal et pour le DJ", async () => {
    const { doc, stage, a, events, notes, io, forfait } = setup();
    const out = a.accepted[30]!;
    const next = forfait(doc, out.licence);
    const accepted = stageAcceptance(next, stage).accepted;
    const res = await syncRoster("t1", accepted, io, new Set([out.licence]));
    expect(res.status).toBe("synced");
    const last = events[events.length - 1]!;
    expect(last.type).toBe("players.imported");
    if (last.type !== "players.imported") return;
    expect(last.payload.players).toHaveLength(72);
    expect(last.payload.players.some((p) => p.licence === out.licence)).toBe(false);
    expect(last.payload.players.some((p) => p.licence === a.waiting[0]!.licence)).toBe(true);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.kind).toBe("forfait");
    expect(notes[0]!.impact).toMatch(/\(forfait\) remplacé par .+ \(liste d'attente\)/);
  });

  it("le forfait d'un préqualifié Masters fait entrer le 9e parmi les Masters", () => {
    const { doc, stage, a, forfait } = setup();
    const master = a.accepted[0]!;
    const accepted = stageAcceptance(forfait(doc, master.licence), stage).accepted;
    const d = rosterDiff(a.accepted, accepted, 8, 3);
    expect(d.mastersIn.map((p) => p.licence)).toEqual([a.accepted[8]!.licence]);
    const n = rosterNotification("t1", d, new Set([master.licence]));
    expect(n.impact).toContain("entre dans les préqualifiés Masters");
  });

  it("signale un changement du nombre de poules du vendredi", () => {
    const players = (n: number): Player[] =>
      Array.from({ length: n }, (_, i) => ({
        licence: `L${i}`,
        name: `JOUEUR${i} TEST`,
        club: "BC",
        seed: i + 1,
        place: null,
      }));
    const d = rosterDiff(players(76), players(72), 8, 3);
    expect(d.poulesBefore).not.toBe(d.poulesAfter);
    expect(rosterNotification("t1", d, new Set(["L72", "L73", "L74", "L75"])).impact).toContain(
      `Poules du vendredi : ${d.poulesBefore} → ${d.poulesAfter}`,
    );
  });

  it("refuse la répercussion une fois les poules du vendredi tirées", async () => {
    const { doc, stage, a, events, notes, io, forfait } = setup();
    events.push({
      type: "poules.drawn",
      at: "2026-10-29T18:00:00Z",
      payload: {
        phase: "PREQ",
        poules: [
          { id: 1, players: a.accepted.slice(8, 12).map((p) => p.name), billards: [], matches: [] },
        ],
      },
    } as unknown as TournamentEvent);
    const size = events.length;
    const accepted = stageAcceptance(forfait(doc, a.accepted[20]!.licence), stage).accepted;
    expect((await syncRoster("t1", accepted, io, new Set())).status).toBe("drawn");
    expect(events).toHaveLength(size);
    expect(notes).toHaveLength(0);
  });

  it("ne fait rien sans changement, ni sans journal", async () => {
    const { a, io, notes } = setup();
    expect((await syncRoster("t1", a.accepted, io, new Set())).status).toBe("unchanged");
    const empty: RosterIO = { ...io, load: async () => [] };
    expect((await syncRoster("t1", a.accepted, empty, new Set())).status).toBe("missing");
    expect(notes).toHaveLength(0);
  });

  it("limite de gestion : le mercredi précédant le vendredi", () => {
    expect(wednesdayBefore("2026-10-30")).toBe("2026-10-28");
  });
});
