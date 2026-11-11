/**
 * Podium d'un tableau final (Masters ou National) pour le résumé de fin de tournoi.
 *
 * Vainqueur et finaliste viennent de la finale ; les deux demi-finalistes battus sont départagés
 * (3e et 4e) par leur place au classement final du tournoi (`finalRanking` du domaine, SPEC §7 :
 * même nombre de points, puis décimale points de set / matchs, moyenne, ordre d'arrivée).
 */
import type { TournamentState } from "@pilot5q/domain";
import { bracketRanking, finalRanking } from "@pilot5q/domain";

export interface Podium {
  /** 1er, 2e, 3e, 4e : nom du joueur, vide tant qu'il n'est pas connu. */
  places: [string, string, string, string];
}

export function podiumOf(state: TournamentState, phase: "M" | "N"): Podium {
  const rows = bracketRanking(state, phase);
  const winner = rows.find((r) => r.reached === "W")?.name ?? "";
  const finalist = winner ? (rows.find((r) => r.reached === "F")?.name ?? "") : "";
  // Demi-finalistes battus : restés en demie alors que les deux finalistes sont connus
  const inFinal = rows.filter((r) => r.reached === "F" || r.reached === "W").length;
  const semis = inFinal === 2 ? rows.filter((r) => r.reached === "SF").map((r) => r.name) : [];
  const place = new Map(finalRanking(state).map((r) => [r.name, r.place]));
  const rank = (name: string) => place.get(name) ?? Number.POSITIVE_INFINITY;
  semis.sort((x, y) => rank(x) - rank(y));
  return { places: [winner, finalist, semis[0] ?? "", semis[1] ?? ""] };
}
