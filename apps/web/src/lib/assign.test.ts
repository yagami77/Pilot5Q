import type { Billard } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import {
  assignmentsKey,
  assignmentsToPlan,
  checkPlan,
  linkTables,
  placePoule,
  planToAssignments,
  removePoule,
  unlinkTables,
} from "./assign";

const billards: Billard[] = [
  ...[1, 2, 3, 4].map((num) => ({ num, type: "3m10" as const })),
  ...[5, 6, 7, 8, 9, 10, 11].map((num) => ({ num, type: "2m80" as const })),
];

describe("affectation des billards par billard", () => {
  it("contrôle les poules non placées et les billards surchargés", () => {
    let plan = assignmentsToPlan({ "1": [5], "2": [5], "3": [5] });
    plan = placePoule(plan, 4, 5);
    const issues = checkPlan(plan, 5, billards);
    expect(issues.overloaded).toEqual([5]);
    expect(issues.unplaced).toEqual([5]);
    expect(issues.ok).toBe(false);
  });

  it("lier deux billards réunit leurs poules ; une poule de la paire porte les deux numéros", () => {
    let plan = assignmentsToPlan({ "1": [6], "2": [6], "3": [7] });
    plan = linkTables(plan, 7, 6);
    expect(planToAssignments(plan)).toEqual({ "1": [6, 7], "2": [6, 7], "3": [6, 7] });
    expect(assignmentsToPlan(planToAssignments(plan))).toEqual(plan);
    plan = unlinkTables(plan, 7);
    expect(planToAssignments(plan)).toEqual({ "1": [6], "2": [6], "3": [6] });
  });

  it("les poules non placées figurent sans billard dans l'événement ; l'empreinte les ignore", () => {
    const plan = removePoule(assignmentsToPlan({ "1": [6], "2": [7, 8], "3": [5] }), 3);
    const assignments = planToAssignments(plan, 4);
    expect(assignments).toEqual({ "1": [6], "2": [7, 8], "3": [], "4": [] });
    expect(assignmentsToPlan(assignments)).toEqual(plan);
    expect(assignmentsKey(assignments)).toBe("1:6 2:7+8");
    // même contenu, même empreinte : ordre des clés et des billards indifférent
    expect(assignmentsKey({ "2": [8, 7], "1": [6] })).toBe(assignmentsKey(assignments));
    expect(assignmentsKey(undefined)).toBe("");
  });
});
