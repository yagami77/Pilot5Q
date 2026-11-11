import type { TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { realWeekendEvents } from "@/admin/realWeekend";
import {
  allRanked,
  fewSmallTables,
  fridayDone,
  saturdayWithConsolante,
  sundayStart,
} from "@/test/weekend";

import { dayTasks, JEUDI_DOCS } from "./dayTasks";
import { demoEvents } from "./demo";
import { emptyMeta } from "./djMeta";
import { replay } from "./engine";
import { primesTotals, progressivePrimes } from "./primes";

const at = "2026-10-30T10:00:00.000Z";
const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
const all = realWeekendEvents(base).map((e) => ({ ...e, at }) as TournamentEvent);
const upTo = (pred: (e: TournamentEvent) => boolean, extra = 0) => {
  const i = all.findIndex(pred);
  return replay([...base, ...all.slice(0, i + 1 + extra)]);
};
const byId = (tasks: ReturnType<typeof dayTasks>) =>
  Object.fromEntries(tasks.map((t) => [t.id, t]));

describe("tâches du jour", () => {
  it("jeudi : tirage puis documents imprimés", () => {
    const before = byId(dayTasks(replay(base), "jeudi", emptyMeta()));
    // Billards et affectation : à valider par le DJ (détail dans jeudiValidation.test.ts)
    expect(before.billards?.status).toBe("todo");
    expect(before.affectation?.status).toBe("todo");
    expect(before.tirage?.status).toBe("todo");
    const drawn = replay([...base, all[0]!]);
    const meta = emptyMeta();
    meta.printed = { pointage: at, "feuilles-preq": at };
    const after = byId(dayTasks(drawn, "jeudi", meta));
    expect(after.tirage?.status).toBe("done");
    expect(after.documents?.status).toBe("doing");
    expect(after.documents?.count).toEqual({ done: 2, total: JEUDI_DOCS.length });
    for (const d of JEUDI_DOCS) meta.printed[d] = at;
    expect(byId(dayTasks(drawn, "jeudi", meta)).documents?.status).toBe("done");
  });

  it("vendredi : poules saisies avec compteur, puis phase et barrages classés", () => {
    const mid = replay([...base, ...all.slice(0, 40)]);
    const t = byId(dayTasks(mid, "vendredi", emptyMeta()));
    expect(t.forfaits?.status).toBe("done");
    expect(t.poules?.status).toBe("doing");
    expect(t.poules?.count?.total).toBe(17);
    expect(t.classement?.status).toBe("todo");
    const closedB = upTo((e) => e.type === "phase.closed" && e.payload.phase === "B");
    const v = byId(dayTasks(closedB, "vendredi", emptyMeta()));
    expect(v.poules?.status).toBe("done");
    expect(v["barrages-classes"]?.status).toBe("done");
    expect(v.barrages?.count).toEqual({ done: 8, total: 8 });
  });

  it("samedi : primes des 3e et 4e de poule Masters connues et payées au fil de l'eau", () => {
    const qm = upTo((e) => e.type === "phase.closed" && e.payload.phase === "QM");
    const lines = progressivePrimes(qm).lines.filter((l) => l.when === "samedi");
    expect(lines).toHaveLength(8);
    expect(lines.every((l) => l.name !== "")).toBe(true);
    const meta = emptyMeta();
    meta.paid = { [lines[0]!.key]: at, [lines[1]!.key]: at };
    const t = byId(dayTasks(qm, "samedi", meta));
    expect(t.masters?.status).toBe("done");
    // La tâche « Primes des poules Masters » a disparu : le suivi se fait sous les poules
    expect(t.primes).toBeUndefined();
    expect(primesTotals(lines, meta.paid).paidCount).toBe(2);
  });

  it("vendredi : la consolante reste à faire tant qu'elle n'est pas créée", () => {
    const t = byId(dayTasks(replay(fridayDone()), "vendredi", emptyMeta()));
    expect(t.consolante).toMatchObject({ status: "todo", label: "Consolante créée" });
    const created = byId(dayTasks(replay(saturdayWithConsolante()), "vendredi", emptyMeta()));
    expect(created.consolante?.status).toBe("done");
    const none = byId(dayTasks(replay(fewSmallTables(fridayDone())), "vendredi", emptyMeta()));
    expect(none.consolante).toMatchObject({ status: "na", label: "Consolante sans objet" });
  });

  it("samedi : consolante non créée en alerte (rouge), jamais comptée comme faite", () => {
    const t = byId(dayTasks(replay(fridayDone()), "samedi", emptyMeta()));
    expect(t.consolante).toMatchObject({
      status: "alert",
      label: "Consolante non créée",
      cta: "Créer",
      target: "consolante",
    });
    // Créée : tâche en cours, avec son compteur de matchs
    const created = byId(dayTasks(replay(saturdayWithConsolante()), "samedi", emptyMeta()));
    expect(created.consolante).toMatchObject({ status: "todo", label: "Consolante" });
    expect(created.consolante?.count?.done).toBe(0);
  });

  it("samedi : moins de 5 billards 2m80, consolante sans objet (neutre, pas rouge)", () => {
    const state = replay(fewSmallTables(fridayDone()));
    expect(state.billards.filter((b) => b.type === "2m80")).toHaveLength(4);
    const t = byId(dayTasks(state, "samedi", emptyMeta()));
    expect(t.consolante).toMatchObject({ status: "na", label: "Consolante sans objet" });
    expect(t.consolante?.hint).toMatch(/au moins 5 billards de 2m80/);
  });

  it("dimanche : quarts, demies, finales, consolante et clôture ; plus de tâche arbitres", () => {
    const start = dayTasks(replay(sundayStart()), "dimanche", emptyMeta());
    expect(start.map((t) => t.id)).toEqual([
      "quarts",
      "demies",
      "finales",
      "consolante",
      "cloture",
    ]);
    expect(byId(start).consolante).toMatchObject({ targetDay: "samedi", target: "consolante" });
    // Sans consolante : elle est sans objet et n'apparaît pas le dimanche
    const none = dayTasks(replay(sundayStart(false)), "dimanche", emptyMeta());
    expect(none.map((t) => t.id)).toEqual(["quarts", "demies", "finales", "cloture"]);

    // Tout joué et classé, aucun arbitre saisi : seule la clôture reste à faire
    const ranked = dayTasks(replay(allRanked()), "dimanche", emptyMeta());
    expect(ranked.filter((t) => t.status !== "done").map((t) => t.id)).toEqual(["cloture"]);
    const closed = replay([...allRanked(), { type: "tournament.closed", at, payload: {} }]);
    expect(dayTasks(closed, "dimanche", emptyMeta()).every((t) => t.status === "done")).toBe(true);
  });

  it("primes : les finalistes restent inconnus tant que la finale n'est pas jouée", () => {
    const qm = upTo((e) => e.type === "phase.closed" && e.payload.phase === "QM");
    const p = progressivePrimes(qm);
    const m = p.lines.filter((l) => l.phase === "M");
    expect(m.find((l) => l.label === "1er")?.name).toBe("");
    expect(m.filter((l) => l.label === "Perdants quarts").every((l) => l.name === "")).toBe(true);
    const end = replay([...base, ...all]);
    const done = progressivePrimes(end).lines;
    expect(done.every((l) => l.name !== "")).toBe(true);
    expect(done.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(p.total, 0);
  });
});
