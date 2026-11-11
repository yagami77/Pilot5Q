/**
 * Validations explicites du jeudi (remarques du 11 novembre) : la structure des billards et
 * l'affectation des poules du vendredi ne sont « faites » que lorsque le DJ les a validées.
 *
 * Le suivi du DJ (`djMeta.validated`) garde l'empreinte de ce qui a été validé. L'état se déduit
 * en comparant cette empreinte à l'état courant : toute modification ultérieure (édition,
 * proposition, annulation dans le journal) remet d'elle-même la tâche « à revalider », et
 * revenir exactement à ce qui était validé la rétablit.
 */
import type { Billard, TournamentState } from "@pilot5q/domain";

import { assignmentsToPlan, checkPlan } from "./assign";
import type { DjMeta } from "./djMeta";
import { preqPouleCount } from "./setup";
import { bigTables } from "./tournament";

/**
 * - `todo` : jamais validé ;
 * - `modified` : validé puis modifié, à revalider ;
 * - `validated` : validé, inchangé depuis ;
 * - `frozen` : le vendredi a commencé (scores saisis), la question ne se pose plus.
 */
export type ValidationStatus = "todo" | "modified" | "validated" | "frozen";

export interface ValidationState {
  status: ValidationStatus;
  /** Empreinte de l'état courant (enregistrée à la validation). */
  signature: string;
  /** Peut être validé maintenant. */
  ready: boolean;
  /** Ce qui empêche de valider, le cas échéant. */
  blocked?: string;
}

export interface JeudiValidation {
  billards: ValidationState;
  affectation: ValidationState;
}

export const isValidated = (s: ValidationStatus): boolean => s === "validated" || s === "frozen";

/** Empreinte de la structure : numéros et formats, dans l'ordre des numéros. */
export function billardsSignature(billards: Billard[]): string {
  return [...billards]
    .sort((a, b) => a.num - b.num)
    .map((b) => `${b.num}:${b.type}`)
    .join(" ");
}

/** Structure acceptable (SPEC §1) : au moins 8 billards dont 3 de 3m10, numéros distincts. */
export function structureOk(billards: Billard[]): boolean {
  return (
    billards.length >= 8 &&
    bigTables(billards) >= 3 &&
    new Set(billards.map((b) => b.num)).size === billards.length
  );
}

/** Le vendredi a commencé : un score est saisi ou la phase est classée. */
export function fridayStarted(state: TournamentState): boolean {
  return (
    Boolean(state.closed.PREQ) ||
    state.poules.PREQ.some((p) => p.matches.some((m) => m.sa !== null))
  );
}

/** Billards cités par une affectation qui n'existent pas (ou plus) dans la structure. */
function unknownBillards(
  assign: Record<string, number[]> | undefined,
  billards: Billard[],
): number[] {
  const known = new Set(billards.map((b) => b.num));
  return [...new Set(Object.values(assign ?? {}).flat())].filter((b) => !known.has(b));
}

/**
 * Empreinte de l'affectation des poules du vendredi : billard(s) et format de chaque poule,
 * puis billards laissés libres. Elle change si une poule change de billard, si le format d'un
 * billard utilisé change, ou si un billard libre apparaît ou disparaît ; pas si l'on corrige le
 * format d'un billard qui ne reçoit aucune poule.
 */
export function affectationSignature(
  assign: Record<string, number[]> | undefined,
  billards: Billard[],
): string {
  const typeOf = new Map(billards.map((b) => [b.num, b.type]));
  const used = new Set<number>();
  const poules = Object.entries(assign ?? {})
    .filter(([, bs]) => bs.length > 0)
    .map(([k, bs]) => [Number(k), [...bs].sort((a, b) => a - b)] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([k, bs]) => {
      for (const b of bs) used.add(b);
      return `${k}:${bs.map((b) => `${b}/${typeOf.get(b) ?? "?"}`).join("+")}`;
    });
  const free = billards
    .map((b) => b.num)
    .filter((n) => !used.has(n))
    .sort((a, b) => a - b);
  return `${poules.join(" ")} | libres ${free.join(",")}`;
}

/**
 * L'affectation des poules du vendredi reste-t-elle cohérente quand la structure passe de
 * `previous` à `next` ? Oui si toutes les poules restent placées une fois sur des billards qui
 * existent, au plus 3 par billard, sans paire liée de formats différents, et si le changement
 * ne fait pas apparaître de billard vide (un billard déjà laissé libre peut le rester). Sinon il
 * faut la proposer à nouveau.
 */
export function affectationCoherent(
  assign: Record<string, number[]> | undefined,
  pouleCount: number,
  next: Billard[],
  previous: Billard[],
): boolean {
  const issues = checkPlan(assignmentsToPlan(assign), pouleCount, next);
  if (!issues.ok || issues.mixedLinks.length > 0) return false;
  if (unknownBillards(assign, next).length > 0) return false;
  const used = new Set(Object.values(assign ?? {}).flat());
  const before = new Set(previous.map((b) => b.num));
  return next.every((b) => used.has(b.num) || before.has(b.num));
}

/**
 * Les billards tirés pour les phases suivantes (barrages, poules du samedi, quarts) existent-ils
 * tous dans une (nouvelle) structure, les poules Masters restant sur des 3m10 ?
 */
export function laterPhasesCoherent(
  assignments: TournamentState["billardAssignments"],
  billards: Billard[],
): boolean {
  const typeOf = new Map(billards.map((b) => [b.num, b.type]));
  for (const phase of ["B", "QM", "QN", "M", "N"] as const) {
    const assign = assignments[phase];
    if (!assign || Object.keys(assign).length === 0) return false;
    for (const b of Object.values(assign).flat()) {
      const type = typeOf.get(b);
      if (type === undefined) return false;
      if (phase === "QM" && type !== "3m10") return false;
    }
  }
  return true;
}

/** État des deux validations du jeudi. */
export function jeudiValidation(state: TournamentState, meta: DjMeta): JeudiValidation {
  const started = fridayStarted(state);
  const validated = meta.validated;
  const statusOf = (ok: boolean, signature: string, previous?: { signature: string }) =>
    ok && previous?.signature === signature
      ? "validated"
      : started
        ? "frozen"
        : previous
          ? "modified"
          : "todo";

  const structure = structureOk(state.billards);
  const bSignature = billardsSignature(state.billards);
  const bStatus: ValidationStatus = statusOf(structure, bSignature, validated.billards);

  const assign = state.billardAssignments.PREQ;
  const issues = checkPlan(assignmentsToPlan(assign), preqPouleCount(state), state.billards);
  const complete = issues.ok && unknownBillards(assign, state.billards).length === 0;
  const aSignature = affectationSignature(assign, state.billards);
  const aStatus: ValidationStatus = statusOf(complete, aSignature, validated.affectation);
  const aBlocked = !complete
    ? "Placez d'abord toutes les poules (au plus 3 par billard)"
    : !isValidated(bStatus)
      ? "Validez d'abord les billards"
      : undefined;

  return {
    billards: {
      status: bStatus,
      signature: bSignature,
      ready: structure && !isValidated(bStatus),
      ...(structure ? {} : { blocked: "Il faut au moins 8 billards dont 3 de 3m10" }),
    },
    affectation: {
      status: aStatus,
      signature: aSignature,
      ready: aBlocked === undefined && !isValidated(aStatus),
      ...(aBlocked ? { blocked: aBlocked } : {}),
    },
  };
}
