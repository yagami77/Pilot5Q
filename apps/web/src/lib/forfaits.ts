/**
 * Forfaits de dernière minute du vendredi, avant le début des préqualifications (SPEC §4) :
 * - poule de 4 → poule de 3, les autres poules ne bougent pas ;
 * - 2 forfaits dans une poule de 4, ou 1 dans une poule de 3 (poule qui tomberait à 2
 *   joueurs) → nouveau tirage des poules sans les forfaits ; si le nombre de poules change,
 *   l'affectation des billards est à revoir.
 */
import type { Poule, TournamentState } from "@pilot5q/domain";

import { forfaitsOf, pouleMatches, resolveClubConflicts, serpentin } from "./engine";
import { clubOf } from "./tournament";

export type ForfaitImpactKind = "poule3" | "retirage" | "hors-poule" | "deja";

export interface ForfaitImpact {
  kind: ForfaitImpactKind;
  player: string;
  poule: number | null;
  /** Joueurs restants de la poule après le forfait. */
  remaining: string[];
  /** Phrase d'impact (« Poule 5 passe à 3 joueurs »). */
  summary: string;
  /** Nombre de poules après un nouveau tirage (retirage seulement). */
  newPouleCount?: number;
  pouleCountChanges?: boolean;
}

/** Le vendredi a-t-il commencé (au moins un score saisi) ? */
export function preqStarted(state: TournamentState): boolean {
  return state.poules.PREQ.some((p) => p.matches.some((m) => m.sa !== null || m.sb !== null));
}

/** Joueurs du vendredi (hors Masters préqualifiés) encore en lice dans les poules. */
export function fridayPlayers(
  state: TournamentState,
): { name: string; poule: Poule; num: number }[] {
  const ff = new Set(forfaitsOf(state, "PREQ"));
  const out: { name: string; poule: Poule; num: number }[] = [];
  for (const p of state.poules.PREQ)
    p.players.forEach((name, i) => {
      if (!ff.has(name)) out.push({ name, poule: p, num: i + 1 });
    });
  return out;
}

/** Joueurs du vendredi à répartir (liste ordonnée, sans les Masters ni les forfaits donnés). */
export function fridayField(state: TournamentState, without: string[] = []): string[] {
  const ff = new Set([...forfaitsOf(state, "PREQ"), ...without]);
  return state.players
    .slice(state.rules.mastersPrequalified)
    .map((p) => p.name)
    .filter((n) => !ff.has(n));
}

/** Nouveau tirage en serpentin (contrôle des clubs) des joueurs du vendredi. */
export function drawFridayPoules(
  state: TournamentState,
  without: string[] = [],
): { poules: Poule[]; unresolved: number[] } {
  const field = fridayField(state, without);
  const raw = serpentin(field, state.rules.maxPoulesOf3);
  const res = resolveClubConflicts(raw, clubOf(state));
  const assign = state.billardAssignments.PREQ ?? {};
  return {
    poules: res.poules.map((names, i) => ({
      num: i + 1,
      players: names,
      billards: assign[String(i + 1)] ?? [],
      matches: pouleMatches(i + 1, names),
    })),
    unresolved: res.unresolved,
  };
}

/** Impact d'un forfait de dernière minute, calculé avant validation. */
export function forfaitImpact(state: TournamentState, player: string): ForfaitImpact {
  const ff = new Set(forfaitsOf(state, "PREQ"));
  if (ff.has(player))
    return { kind: "deja", player, poule: null, remaining: [], summary: "Forfait déjà enregistré" };
  const poule = state.poules.PREQ.find((p) => p.players.includes(player));
  if (!poule)
    return {
      kind: "hors-poule",
      player,
      poule: null,
      remaining: [],
      summary: "Joueur hors des poules du vendredi : aucune poule à modifier",
    };
  const remaining = poule.players.filter((n) => n !== player && !ff.has(n));
  if (remaining.length >= 3) {
    return {
      kind: "poule3",
      player,
      poule: poule.num,
      remaining,
      summary: `Poule ${poule.num} passe à ${remaining.length} joueurs · les autres poules ne bougent pas`,
    };
  }
  let newPouleCount: number | undefined;
  try {
    newPouleCount = drawFridayPoules(state, [player]).poules.length;
  } catch {
    newPouleCount = undefined;
  }
  const changes = newPouleCount !== undefined && newPouleCount !== state.poules.PREQ.length;
  return {
    kind: "retirage",
    player,
    poule: poule.num,
    remaining,
    summary: `Poule ${poule.num} n'aurait plus que ${remaining.length} joueurs · nouveau tirage nécessaire`,
    ...(newPouleCount !== undefined ? { newPouleCount } : {}),
    pouleCountChanges: changes,
  };
}
