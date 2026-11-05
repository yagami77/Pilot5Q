import type { Billard } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import {
  assignmentsToPlan,
  checkPlan,
  linkTables,
  placePoule,
  planToAssignments,
  proposePlan,
  unlinkTables,
} from "./assign";

const billards: Billard[] = [
  ...[1, 2, 3, 4].map((num) => ({ num, type: "3m10" as const })),
  ...[5, 6, 7, 8, 9, 10, 11].map((num) => ({ num, type: "2m80" as const })),
];

function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

describe("affectation des billards par billard", () => {
  it("propose 2 poules par billard et un groupe de 3 sur 2 billards liés du même format", () => {
    for (let s = 1; s < 30; s++) {
      const plan = proposePlan(17, billards, seeded(s));
      const issues = checkPlan(plan, 17, billards);
      expect(issues.ok).toBe(true);
      expect(issues.mixedLinks).toEqual([]);
      const sizes = Object.values(plan.place).map((p) => p.length);
      expect(sizes.filter((n) => n === 3)).toHaveLength(1);
      expect(sizes.filter((n) => n === 2)).toHaveLength(7);
      const assign = planToAssignments(plan);
      expect(Object.keys(assign)).toHaveLength(17);
      expect(Object.values(assign).filter((b) => b.length === 2)).toHaveLength(3);
    }
  });

  it("un nombre pair de poules : uniquement des billards à 2 poules", () => {
    const plan = proposePlan(16, billards, seeded(3));
    expect(Object.keys(plan.links)).toHaveLength(0);
    expect(Object.values(plan.place).every((p) => p.length === 2)).toBe(true);
  });

  it("au-delà de 2 poules par billard, certains en reçoivent 3", () => {
    const eight = billards.slice(0, 8);
    const plan = proposePlan(20, eight, seeded(5));
    expect(checkPlan(plan, 20, eight).ok).toBe(true);
  });

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
});
