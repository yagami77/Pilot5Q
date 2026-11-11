/**
 * Tâches du jour du directeur de jeu (retours du 5 novembre) : pour chaque journée, la liste
 * des étapes avec leur état (à faire, en cours avec compteur, faite) et la zone de la vue où
 * elles se traitent.
 */
import type { TournamentState } from "@pilot5q/domain";

import { checkPlan, assignmentsToPlan } from "./assign";
import type { DjMeta } from "./djMeta";
import { isValidScore, matchWinner } from "./engine";
import { isValidated, jeudiValidation, structureOk } from "./jeudiValidation";
import { primesTotals, progressivePrimes } from "./primes";
import { preqPouleCount } from "./setup";
import { consolanteAllowed, phaseDistance, pouleState, type Day } from "./tournament";

export type TaskStatus = "todo" | "doing" | "done";

export interface DayTask {
  id: string;
  label: string;
  status: TaskStatus;
  /** Compteur affiché quand la tâche est en cours (ou faite). */
  count?: { done: number; total: number };
  /** Id de la zone de la vue (défilement au clic). */
  target: string;
  /** Explication courte (infobulle). */
  hint?: string;
}

const status = (done: number, total: number): TaskStatus =>
  total > 0 && done >= total ? "done" : done > 0 ? "doing" : "todo";

const flag = (v: boolean): TaskStatus => (v ? "done" : "todo");

function poulesDone(state: TournamentState, phase: "PREQ" | "QN" | "QM"): number {
  return state.poules[phase].filter((p) => pouleState(state, phase, p).complete).length;
}

/** Documents du jeudi à imprimer (ids du centre d'impression). */
export const JEUDI_DOCS = [
  "pointage",
  "joueurs-poules",
  "tableau-poules",
  "premiers-matchs",
  "feuilles-preq",
];

export function dayTasks(state: TournamentState, day: Day, meta: DjMeta): DayTask[] {
  if (day === "jeudi") {
    const count = preqPouleCount(state);
    const plan = assignmentsToPlan(state.billardAssignments.PREQ);
    const issues = checkPlan(plan, count, state.billards);
    const placed = count - issues.unplaced.length;
    const printed = JEUDI_DOCS.filter((d) => meta.printed[d]).length;
    // Billards et affectation : faits seulement après validation explicite par le DJ ; une
    // modification après validation les remet « à revalider » (remarques du 11 novembre)
    const v = jeudiValidation(state, meta);
    const bDone = isValidated(v.billards.status);
    const bModified = v.billards.status === "modified";
    const aDone = isValidated(v.affectation.status);
    const aModified = v.affectation.status === "modified";
    return [
      {
        id: "billards",
        label: bModified ? "Billards modifiés, à revalider" : "Billards définis",
        status: bDone ? "done" : bModified ? "doing" : "todo",
        target: "billards",
        hint: !structureOk(state.billards)
          ? "Au moins 8 billards dont 3 de 3m10"
          : bDone
            ? "Structure des billards validée"
            : "Vérifiez la structure puis cliquez sur « Valider les billards »",
      },
      {
        id: "affectation",
        label: aModified ? "Affectation modifiée, à revalider" : "Billards des poules affectés",
        status: aDone
          ? "done"
          : !issues.ok && placed < count
            ? status(placed, count)
            : aModified || !issues.ok
              ? "doing"
              : "todo",
        // Compteur tant que des poules restent à placer ; ensuite il ne manque que la validation
        ...(placed < count ? { count: { done: placed, total: count } } : {}),
        target: "affectation",
        hint: aDone
          ? "Affectation des billards aux poules validée"
          : (v.affectation.blocked ??
            "Vérifiez l'affectation puis cliquez sur « Valider l'affectation »"),
      },
      {
        id: "tirage",
        label: "Tirage des poules",
        status: flag(state.poules.PREQ.length > 0),
        target: "tirage",
      },
      {
        id: "documents",
        label: "Documents imprimés",
        status: state.poules.PREQ.length === 0 ? "todo" : status(printed, JEUDI_DOCS.length),
        count: { done: printed, total: JEUDI_DOCS.length },
        target: "documents",
        hint: "Pointage, listes, tableau des poules, premiers matchs, feuilles de match",
      },
    ];
  }
  if (day === "vendredi") {
    const started = state.poules.PREQ.some((p) => p.matches.some((m) => m.sa !== null));
    const pDone = poulesDone(state, "PREQ");
    const bd = state.rules.distances.barrage;
    const bDone = state.barrages.filter((m) => isValidScore(m, bd)).length;
    const bTotal = state.barrages.length || state.rules.barrageSize / 2;
    const clsOk = consolanteAllowed(state);
    return [
      {
        id: "forfaits",
        label: "Forfaits de dernière minute vérifiés",
        status: flag(Boolean(meta.forfaitsChecked.vendredi) || started),
        target: "forfaits",
      },
      {
        id: "poules",
        label: "Poules saisies",
        status: status(pDone, state.poules.PREQ.length),
        count: { done: pDone, total: state.poules.PREQ.length },
        target: "poules",
      },
      {
        id: "classement",
        label: "Phase classée",
        status: flag(Boolean(state.closed.PREQ)),
        target: "classement",
      },
      {
        id: "barrages",
        label: "Barrages saisis",
        status: status(bDone, bTotal),
        count: { done: bDone, total: bTotal },
        target: "barrages",
      },
      {
        id: "barrages-classes",
        label: "Barrages classés",
        status: flag(Boolean(state.closed.B)),
        target: "barrages",
      },
      {
        id: "consolante",
        label: clsOk ? "Consolante créée" : "Consolante (impossible)",
        status: flag(state.brackets.CLS.length > 0 || !clsOk),
        target: "qualifies",
        ...(clsOk ? {} : { hint: "Il faut au moins 5 billards de 2m80" }),
      },
    ];
  }
  if (day === "samedi") {
    const qm = poulesDone(state, "QM");
    const qn = poulesDone(state, "QN");
    const r16 = state.brackets.N.filter((m) => m.round === "R16");
    const r16Done = r16.filter(
      (m) => m.a && m.b && matchWinner(m, phaseDistance(state, "N", "R16")),
    ).length;
    const cls = state.brackets.CLS.filter((m) => m.a && m.b);
    const clsDone = cls.filter((m) => matchWinner(m, phaseDistance(state, "CLS", m.round))).length;
    const primes = progressivePrimes(state).lines.filter((l) => l.when === "samedi");
    const totals = primesTotals(primes, meta.paid);
    const hasCls = state.brackets.CLS.length > 0;
    return [
      {
        id: "masters",
        label: "Poules Masters",
        status: state.closed.QM ? "done" : status(qm, state.poules.QM.length || 4),
        count: { done: qm, total: state.poules.QM.length || 4 },
        target: "masters",
      },
      {
        id: "national",
        label: "Poules National",
        status: state.closed.QN ? "done" : status(qn, state.poules.QN.length || 8),
        count: { done: qn, total: state.poules.QN.length || 8 },
        target: "national",
      },
      {
        id: "huitiemes",
        label: "Huitièmes National",
        status: status(r16Done, 8),
        count: { done: r16Done, total: 8 },
        target: "huitiemes",
      },
      {
        id: "consolante",
        label: hasCls ? "Consolante" : "Consolante (non créée)",
        status: hasCls ? (state.closed.CLS ? "done" : status(clsDone, cls.length)) : "done",
        ...(hasCls ? { count: { done: clsDone, total: Math.max(cls.length, clsDone) } } : {}),
        target: "consolante",
      },
      {
        id: "primes",
        label: "Primes des poules Masters",
        status: status(totals.paidCount, primes.length),
        count: { done: totals.paidCount, total: primes.length },
        target: "primes",
        hint: "3e et 4e de chaque poule Masters, payables dès la fin de leur poule",
      },
    ];
  }
  // Dimanche
  const rounds = (round: "QF" | "SF" | "F") => {
    const ms = [...state.brackets.M, ...state.brackets.N].filter((m) => m.round === round);
    const done = ms.filter(
      (m) =>
        m.a &&
        m.b &&
        matchWinner(m, phaseDistance(state, state.brackets.M.includes(m) ? "M" : "N", round)),
    ).length;
    const total = round === "QF" ? 8 : round === "SF" ? 4 : 2;
    return { done, total };
  };
  const qf = rounds("QF");
  const sf = rounds("SF");
  const f = rounds("F");
  const finals = [...state.brackets.M, ...state.brackets.N].filter((m) => m.round !== "R16");
  const arbitres = finals.filter((m) => Boolean(m.arbitre)).length;
  return [
    {
      id: "quarts",
      label: "Quarts",
      status: status(qf.done, qf.total),
      count: qf,
      target: "masters",
    },
    {
      id: "demies",
      label: "Demies",
      status: status(sf.done, sf.total),
      count: sf,
      target: "masters",
    },
    {
      id: "finales",
      label: "Finales",
      status: status(f.done, f.total),
      count: f,
      target: "masters",
    },
    {
      id: "arbitres",
      label: "Arbitres renseignés",
      status: status(arbitres, 14),
      count: { done: arbitres, total: 14 },
      target: "masters",
      hint: "Numéro de licence de l'arbitre de chaque quart, demie et finale",
    },
    {
      id: "cloture",
      label: "Clôture",
      status: flag(Boolean(state.closed.M && state.closed.N)),
      target: "cloture",
    },
  ];
}

export const NEXT_DAY: Record<Day, Day | null> = {
  jeudi: "vendredi",
  vendredi: "samedi",
  samedi: "dimanche",
  dimanche: null,
};
