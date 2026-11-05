/** Création d'un tournoi : journal initial à partir d'inscrits et d'une structure de billards. */
import type { Billard, Player, TournamentState } from "@pilot5q/domain";

import type { EventInput } from "@/store/tournament";

import {
  drawBarrageBillards,
  drawMastersBillards,
  drawNationalBillards,
  drawPreqBillards,
  drawQuarterBillards,
} from "./draw";
import { DEFAULT_RULES, pouleSizes } from "./engine";

export interface TournamentForm {
  name: string;
  season: string;
  city: string;
  club: string;
  /** Vendredi (AAAA-MM-JJ) ; le tournoi se termine le dimanche. */
  friday: string;
  big: number;
  small: number;
}

export function makeBillards(big: number, small: number): Billard[] {
  const out: Billard[] = [];
  for (let i = 0; i < big; i++) out.push({ num: i + 1, type: "3m10" });
  for (let i = 0; i < small; i++) out.push({ num: big + i + 1, type: "2m80" });
  return out;
}

/** Tirages des billards des phases suivantes (barrages, poules du samedi, quarts). */
export function drawLaterPhaseEvents(billards: Billard[], random?: () => number): EventInput[] {
  const qm = drawMastersBillards(billards, random);
  const taken = [...new Set(Object.values(qm).flat())];
  return [
    {
      type: "billards.assigned",
      payload: { phase: "B", assignments: drawBarrageBillards(8, billards, random) },
    },
    { type: "billards.assigned", payload: { phase: "QM", assignments: qm } },
    {
      type: "billards.assigned",
      payload: { phase: "QN", assignments: drawNationalBillards(billards, taken, random) },
    },
    {
      type: "billards.assigned",
      payload: { phase: "M", assignments: drawQuarterBillards(billards, "M", "3m10", random) },
    },
    {
      type: "billards.assigned",
      payload: { phase: "N", assignments: drawQuarterBillards(billards, "N", "2m80", random) },
    },
  ];
}

/** Nombre de poules du vendredi pour un effectif donné. */
export function preqPouleCount(state: TournamentState): number {
  const n = Math.max(0, state.players.length - state.rules.mastersPrequalified);
  return pouleSizes(n, state.rules.maxPoulesOf3).length;
}

export function createTournamentEvents(form: TournamentForm, players: Player[]): EventInput[] {
  const billards = makeBillards(form.big, form.small);
  const [y, m, d] = form.friday.split("-").map(Number);
  const sunday = new Date(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + 2);
  const iso = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
  const n = Math.max(0, players.length - DEFAULT_RULES.mastersPrequalified);
  const count = pouleSizes(n, DEFAULT_RULES.maxPoulesOf3).length;
  return [
    {
      type: "tournament.created",
      payload: {
        name: form.name,
        season: form.season,
        city: form.city,
        club: form.club,
        dates: [form.friday, iso],
        billards,
        rules: DEFAULT_RULES,
      },
    },
    { type: "players.imported", payload: { players } },
    {
      type: "billards.assigned",
      payload: { phase: "PREQ", assignments: drawPreqBillards(count, billards) },
    },
    ...drawLaterPhaseEvents(billards),
  ];
}
