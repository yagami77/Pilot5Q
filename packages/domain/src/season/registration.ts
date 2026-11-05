/**
 * Inscriptions à une étape : capacité, liste ordonnée des acceptés, liste d'attente, forfaits
 * (SPEC §2).
 *
 * Règles :
 * - Capacité = billards × 8 + 8, plafonnée à 100 (paramétrable).
 * - Au-delà : liste d'attente. Priorité aux 34 premiers du classement glissant (place au
 *   classement ≤ 34), puis ordre d'inscription (horodatage du CSV).
 * - Un forfait avant tirage libère une place, prise par le premier de la liste d'attente ; la
 *   liste ordonnée des acceptés est ensuite recalculée (`orderParticipants`).
 * - Le statut U21 ne figure pas dans le CSV : il est saisi à la main (drapeau `junior`).
 */
import { orderParticipants } from "../csv.js";
import type { Player } from "../types.js";
import type { Registration, SeasonSettings } from "./types.js";

/** Nombre de joueurs acceptés pour un nombre de billards donné. */
export function capacityFor(tables: number, settings: SeasonSettings): number {
  return Math.min(settings.maxPlayers, tables * settings.playersPerTable + settings.extraPlayers);
}

/** Convertit un inscrit en joueur du moteur (`seed` = rang d'inscription). */
export function toPlayer(r: Registration): Player {
  const p: Player = {
    licence: r.licence,
    name: r.name,
    club: r.club,
    seed: r.order,
    place: null,
  };
  if (r.junior) p.junior = true;
  if (r.email !== "") p.email = r.email;
  return p;
}

export interface Acceptance {
  /** Liste ordonnée des acceptés (ordre du serpentin, 8 premiers = Masters). */
  accepted: Player[];
  /** Liste d'attente, dans l'ordre de priorité. */
  waiting: Player[];
  /** Forfaits déclarés avant le tirage. */
  forfaits: Player[];
  capacity: number;
}

/**
 * Acceptés et liste d'attente. `ranking` et `lastKnown` sont les tables de `orderParticipants`
 * (SPEC §2) ; `priority` = nombre de premiers du classement prioritaires (34).
 */
export function acceptRegistrations(
  registrations: Registration[],
  capacity: number,
  ranking: Record<string, number>,
  lastKnown: Record<string, { place: number; season: number }>,
  priority: number,
): Acceptance {
  const active = registrations.filter((r) => !r.forfait);
  const forfaits = registrations.filter((r) => r.forfait).map(toPlayer);
  const ordered = orderParticipants(active.map(toPlayer), ranking, lastKnown);
  const glissant = (p: Player): number | null => {
    const v = ranking[p.licence] ?? ranking[p.licence.toUpperCase()] ?? ranking[p.name];
    return v === undefined ? null : v;
  };
  const orderOf = new Map(active.map((r) => [r.licence, r.order]));
  const prioritized = [...ordered].sort((x, y) => {
    const px = glissant(x);
    const py = glissant(y);
    const xp = px !== null && px <= priority;
    const yp = py !== null && py <= priority;
    if (xp !== yp) return xp ? -1 : 1;
    if (xp && yp) return (px ?? 0) - (py ?? 0);
    return (orderOf.get(x.licence) ?? 0) - (orderOf.get(y.licence) ?? 0);
  });
  const acceptedSet = new Set(prioritized.slice(0, capacity).map((p) => p.licence));
  const accepted = orderParticipants(
    ordered.filter((p) => acceptedSet.has(p.licence)),
    ranking,
    lastKnown,
  );
  const waiting = prioritized.slice(capacity);
  return { accepted, waiting, forfaits, capacity };
}

/** Ligne de pointage : les 8 Masters puis l'ordre du serpentin, avec U21 signalés. */
export function acceptedListCsv(accepted: Player[], mastersCount: number): string {
  const head = ["Rang", "Nom", "Club", "Licence", "Place", "Masters", "U21"];
  const lines = accepted.map((p) =>
    [
      String(p.seed),
      p.name,
      p.club,
      p.licence,
      p.place === null ? "" : String(p.place).replace(".", ","),
      p.seed <= mastersCount ? "oui" : "",
      p.junior ? "oui" : "",
    ].join(";"),
  );
  return [head.join(";"), ...lines].join("\n");
}
