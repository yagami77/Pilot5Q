import type { Billard, TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { realWeekendEvents } from "@/admin/realWeekend";

import { dayTasks } from "./dayTasks";
import { demoEvents } from "./demo";
import { emptyMeta, type DjMeta } from "./djMeta";
import { replay } from "./engine";
import {
  affectationCoherent,
  affectationSignature,
  billardsSignature,
  jeudiValidation,
  laterPhasesCoherent,
} from "./jeudiValidation";

const at = "2026-10-29T10:00:00.000Z";
const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
const state = replay(base);

/** Suivi du DJ après validation de l'état donné. */
function validate(s: typeof state, meta: DjMeta, what: "billards" | "affectation"): DjMeta {
  const { signature, ready } = jeudiValidation(s, meta)[what];
  expect(ready).toBe(true);
  return { ...meta, validated: { ...meta.validated, [what]: { signature, at } } };
}

const assigned = (assignments: Record<string, number[]>): TournamentEvent => ({
  type: "billards.assigned",
  at,
  payload: { phase: "PREQ", assignments },
});

describe("validations du jeudi", () => {
  it("à l'ouverture : rien n'est validé, l'affectation attend les billards", () => {
    const v = jeudiValidation(state, emptyMeta());
    expect(v.billards.status).toBe("todo");
    expect(v.billards.ready).toBe(true);
    expect(v.affectation.status).toBe("todo");
    expect(v.affectation.ready).toBe(false);
    expect(v.affectation.blocked).toBe("Validez d'abord les billards");
  });

  it("validation des billards puis de l'affectation", () => {
    let meta = validate(state, emptyMeta(), "billards");
    expect(jeudiValidation(state, meta).billards.status).toBe("validated");
    expect(jeudiValidation(state, meta).billards.ready).toBe(false);
    meta = validate(state, meta, "affectation");
    const v = jeudiValidation(state, meta);
    expect(v.affectation.status).toBe("validated");
    expect(v.affectation.ready).toBe(false);
  });

  it("une affectation modifiée après validation est à revalider ; revenir en arrière la rétablit", () => {
    let meta = validate(state, emptyMeta(), "billards");
    meta = validate(state, meta, "affectation");
    const before = state.billardAssignments.PREQ ?? {};
    // la poule 1 passe du billard 11 au billard 2
    const moved = replay([...base, assigned({ ...before, "1": [2] })]);
    const v = jeudiValidation(moved, meta);
    expect(v.affectation.status).toBe("modified");
    expect(v.affectation.ready).toBe(true);
    expect(v.billards.status).toBe("validated");
    const back = replay([...base, assigned({ ...before, "1": [2] }), assigned(before)]);
    expect(jeudiValidation(back, meta).affectation.status).toBe("validated");
  });

  it("une affectation incomplète ne se valide pas", () => {
    const meta = validate(state, emptyMeta(), "billards");
    const before = state.billardAssignments.PREQ ?? {};
    const partial = replay([...base, assigned({ ...before, "1": [] })]);
    const v = jeudiValidation(partial, meta);
    expect(v.affectation.status).toBe("todo");
    expect(v.affectation.ready).toBe(false);
    expect(v.affectation.blocked).toMatch(/Placez d'abord toutes les poules/);
  });

  it("structure modifiée : billards à revalider, affectation seulement si elle est touchée", () => {
    let meta = validate(state, emptyMeta(), "billards");
    meta = validate(state, meta, "affectation");
    const withBillards = (billards: Billard[]) => ({ ...state, billards });
    // Tournoi d'exemple : tous les billards sont utilisés ; changer le format du 11 touche la
    // poule 1 qui y joue
    const retyped = withBillards(
      state.billards.map((b) => (b.num === 11 ? { ...b, type: "3m10" as const } : b)),
    );
    expect(jeudiValidation(retyped, meta).billards.status).toBe("modified");
    expect(jeudiValidation(retyped, meta).affectation.status).toBe("modified");
    // Le format d'un billard laissé libre peut changer sans toucher à l'affectation validée
    const before = state.billardAssignments.PREQ ?? {};
    const freed = replay([...base, assigned({ ...before, "1": [2] })]);
    let meta2 = validate(freed, emptyMeta(), "billards");
    meta2 = validate(freed, meta2, "affectation");
    const freedRetyped = {
      ...freed,
      billards: freed.billards.map((b) => (b.num === 11 ? { ...b, type: "3m10" as const } : b)),
    };
    expect(jeudiValidation(freedRetyped, meta2).billards.status).toBe("modified");
    expect(jeudiValidation(freedRetyped, meta2).affectation.status).toBe("validated");
    // Structure insuffisante : rien à valider
    const small = withBillards(state.billards.slice(0, 7));
    expect(jeudiValidation(small, emptyMeta()).billards.ready).toBe(false);
    expect(jeudiValidation(small, emptyMeta()).billards.blocked).toMatch(/au moins 8 billards/);
  });

  it("empreintes : indépendantes de l'ordre, sensibles au contenu", () => {
    const b = state.billards;
    expect(billardsSignature([...b].reverse())).toBe(billardsSignature(b));
    expect(billardsSignature(b.slice(1))).not.toBe(billardsSignature(b));
    expect(affectationSignature({ "2": [6, 5], "1": [1] }, b)).toBe(
      affectationSignature({ "1": [1], "2": [5, 6], "3": [] }, b),
    );
    expect(affectationSignature({ "1": [1] }, b)).toBe("1:1/3m10 | libres 2,3,4,5,6,7,8,9,10,11");
  });

  it("cohérence de l'affectation avec une nouvelle structure", () => {
    const assign = state.billardAssignments.PREQ;
    const b = state.billards;
    expect(affectationCoherent(assign, 17, b, b)).toBe(true);
    // format d'un billard changé : cohérente (aucune paire liée dans l'exemple)
    const retyped = b.map((x) => (x.num === 11 ? { ...x, type: "3m10" as const } : x));
    expect(affectationCoherent(assign, 17, retyped, b)).toBe(true);
    // billard utilisé retiré ou renuméroté : incohérente
    expect(affectationCoherent(assign, 17, b.slice(0, 10), b)).toBe(false);
    expect(
      affectationCoherent(
        assign,
        17,
        b.map((x) => (x.num === 11 ? { ...x, num: 12 } : x)),
        b,
      ),
    ).toBe(false);
    // billard ajouté : il resterait vide, on propose à nouveau
    expect(affectationCoherent(assign, 17, [...b, { num: 12, type: "2m80" }], b)).toBe(false);
    // un billard déjà laissé libre par le DJ peut le rester
    const freed = { ...assign, "1": [2] };
    expect(affectationCoherent(freed, 17, retyped, b)).toBe(true);
    // paire liée dont un billard change de format : incohérente
    const linked = { ...assign, "1": [10, 11], "11": [10, 11] };
    expect(affectationCoherent(linked, 17, b, b)).toBe(true);
    expect(affectationCoherent(linked, 17, retyped, b)).toBe(false);
  });

  it("cohérence des billards des phases suivantes avec une nouvelle structure", () => {
    const b = state.billards;
    expect(laterPhasesCoherent(state.billardAssignments, b)).toBe(true);
    // un billard utilisé par les barrages disparaît
    const used = Object.values(state.billardAssignments.B ?? {}).flat()[0]!;
    expect(
      laterPhasesCoherent(
        state.billardAssignments,
        b.filter((x) => x.num !== used),
      ),
    ).toBe(false);
    // un 3m10 des poules Masters devient un 2m80
    const masters = Object.values(state.billardAssignments.QM ?? {}).flat()[0]!;
    expect(
      laterPhasesCoherent(
        state.billardAssignments,
        b.map((x) => (x.num === masters ? { ...x, type: "2m80" as const } : x)),
      ),
    ).toBe(false);
  });

  it("tâches du jeudi : à faire, faites après validation, à revalider après modification", () => {
    const tasks = (s: typeof state, meta: DjMeta) =>
      Object.fromEntries(dayTasks(s, "jeudi", meta).map((t) => [t.id, t]));
    const open = tasks(state, emptyMeta());
    expect(open.billards).toMatchObject({ label: "Billards définis", status: "todo" });
    expect(open.affectation).toMatchObject({
      label: "Billards des poules affectés",
      status: "todo",
      hint: "Validez d'abord les billards",
    });
    expect(open.affectation?.count).toBeUndefined();
    let meta = validate(state, emptyMeta(), "billards");
    expect(tasks(state, meta).billards?.status).toBe("done");
    expect(tasks(state, meta).affectation?.status).toBe("todo");
    meta = validate(state, meta, "affectation");
    expect(tasks(state, meta).affectation?.status).toBe("done");
    // modification après validation
    const before = state.billardAssignments.PREQ ?? {};
    const moved = replay([...base, assigned({ ...before, "1": [2] })]);
    expect(tasks(moved, meta).affectation).toMatchObject({
      label: "Affectation modifiée, à revalider",
      status: "doing",
    });
    expect(tasks(moved, meta).billards?.status).toBe("done");
    // poules retirées : compteur des poules placées
    const partial = replay([...base, assigned({ ...before, "1": [], "2": [] })]);
    expect(tasks(partial, meta).affectation).toMatchObject({
      status: "doing",
      count: { done: 15, total: 17 },
    });
    // structure modifiée
    const retyped = {
      ...state,
      billards: state.billards.map((b) => (b.num === 2 ? { ...b, type: "2m80" as const } : b)),
    };
    expect(tasks(retyped, meta).billards).toMatchObject({
      label: "Billards modifiés, à revalider",
      status: "doing",
    });
  });

  it("vendredi commencé (week-end réel rejoué) : plus rien à valider, même sans suivi du DJ", () => {
    const weekend = realWeekendEvents(base).map((e) => ({ ...e, at }) as TournamentEvent);
    const drawn = replay([...base, weekend[0]!]);
    expect(jeudiValidation(drawn, emptyMeta()).billards.status).toBe("todo");
    const played = replay([...base, ...weekend]);
    const v = jeudiValidation(played, emptyMeta());
    expect(v.billards.status).toBe("frozen");
    expect(v.affectation.status).toBe("frozen");
    expect(v.billards.ready).toBe(false);
    expect(v.affectation.ready).toBe(false);
    const tasks = dayTasks(played, "jeudi", emptyMeta());
    expect(tasks.slice(0, 3).map((t) => t.status)).toEqual(["done", "done", "done"]);
  });
});
