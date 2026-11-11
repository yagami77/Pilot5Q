/**
 * Clôture du tournoi par le directeur de jeu (retours du 11 novembre) : un seul geste, possible
 * quand tout est joué — finales Masters et National, consolante terminée ou sans objet. Après la
 * clôture, seul le responsable peut rouvrir pour corriger (voir le store du tournoi).
 */
import type { TournamentState } from "@pilot5q/domain";
import { canCloseTournament, phaseComplete } from "@pilot5q/domain";

import type { EventInput } from "@/store/tournament";

import { clock, shortDate } from "./format";

/** Date et heure locales d'une clôture : « 1er nov. à 18:42 ». */
export function closureWhen(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${shortDate(iso)} à ${clock(d)}`;
}

/** Tableaux concernés par la clôture, dans l'ordre d'affichage. */
const BRACKETS = [
  { phase: "M", label: "le tableau Masters" },
  { phase: "N", label: "le tableau National" },
  { phase: "CLS", label: "la consolante" },
] as const;

/**
 * Ce qui reste à jouer avant de pouvoir clôturer (vide : la clôture est possible). Une
 * consolante jamais créée est sans objet et ne bloque pas.
 */
export function closureBlockers(state: TournamentState): string[] {
  return BRACKETS.filter(({ phase }) =>
    phase === "CLS"
      ? state.brackets.CLS.length > 0 && !phaseComplete(state, "CLS")
      : !phaseComplete(state, phase),
  ).map((b) => b.label);
}

/**
 * Événements de la clôture : classe d'abord les tableaux joués mais pas encore classés, puis
 * clôture le tournoi. Vide si la clôture n'est pas possible.
 */
export function closureEvents(state: TournamentState, by?: string): EventInput[] {
  if (!canCloseTournament(state)) return [];
  const out: EventInput[] = [];
  for (const { phase } of BRACKETS) {
    if (state.brackets[phase].length > 0 && !state.closed[phase])
      out.push({ type: "phase.closed", payload: { phase } });
  }
  out.push({ type: "tournament.closed", payload: by ? { by } : {} });
  return out;
}
