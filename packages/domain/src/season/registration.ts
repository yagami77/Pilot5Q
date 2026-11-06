/**
 * Inscriptions à une étape : capacité, liste ordonnée des acceptés, liste d'attente, forfaits
 * (SPEC §2).
 *
 * Règles :
 * - Capacité = billards × 8 + 8, plafonnée à 100 (paramétrable).
 * - Au-delà : liste d'attente. Priorité aux 34 premiers du classement glissant (place au
 *   classement ≤ 34), puis ordre d'inscription (horodatage du CSV).
 * - Un forfait avant tirage libère une place, sans intégrer personne automatiquement : le
 *   responsable choisit qui intégrer depuis la liste d'attente (drapeau `integrated`) ; le
 *   prioritaire selon la règle ci-dessus lui est suggéré. La liste ordonnée des acceptés est
 *   ensuite recalculée (`orderParticipants`).
 * - Le statut U21 ne figure pas dans le CSV : il est saisi à la main (drapeau `junior`).
 */
import { orderParticipants } from "../csv.js";
import type { Player } from "../types.js";
import type { Registration, SeasonSettings, WaitStatus } from "./types.js";

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
  /** Liste d'attente, dans l'ordre de priorité (SPEC §2). */
  waiting: Player[];
  /** Forfaits déclarés avant le tirage. */
  forfaits: Player[];
  capacity: number;
  /** Places libres (capacité − acceptés) ; négatif : capacité dépassée. */
  free: number;
  /** Licence du joueur suggéré pour la prochaine place : premier en attente non indisponible. */
  suggested: string | null;
  /** Licences des acceptés intégrés à la main depuis la liste d'attente. */
  integrated: string[];
  /** Licences des joueurs en attente prioritaires (parmi les `priority` premiers du classement). */
  topRanked: string[];
}

/** Libellés du suivi de la liste d'attente. */
export const WAIT_STATUS_LABELS: Record<WaitStatus, string> = {
  "a-contacter": "À contacter",
  confirme: "Confirmé",
  indisponible: "Indisponible",
};

/** Ordre de priorité de la liste d'attente : 34 premiers du classement, puis ordre d'inscription. */
const glissantOf =
  (ranking: Record<string, number>) =>
  (p: Player): number | null => {
    const v = ranking[p.licence] ?? ranking[p.licence.toUpperCase()] ?? ranking[p.name];
    return v === undefined ? null : v;
  };

function prioritize(
  ordered: Player[],
  registrations: Registration[],
  ranking: Record<string, number>,
  priority: number,
): Player[] {
  const glissant = glissantOf(ranking);
  const orderOf = new Map(registrations.map((r) => [r.licence, r.order]));
  return [...ordered].sort((x, y) => {
    const px = glissant(x);
    const py = glissant(y);
    const xp = px !== null && px <= priority;
    const yp = py !== null && py <= priority;
    if (xp !== yp) return xp ? -1 : 1;
    if (xp && yp) return (px ?? 0) - (py ?? 0);
    return (orderOf.get(x.licence) ?? 0) - (orderOf.get(y.licence) ?? 0);
  });
}

/**
 * Acceptés et liste d'attente. `ranking` et `lastKnown` sont les tables de `orderParticipants`
 * (SPEC §2) ; `priority` = nombre de premiers du classement prioritaires (34).
 *
 * Les places sont attribuées par priorité à tous les inscrits, forfaits compris : la place d'un
 * forfait reste libre jusqu'à ce que le responsable intègre un joueur en attente (`integrated`).
 */
export function acceptRegistrations(
  registrations: Registration[],
  capacity: number,
  ranking: Record<string, number>,
  lastKnown: Record<string, { place: number; season: number }>,
  priority: number,
): Acceptance {
  const all = orderParticipants(registrations.map(toPlayer), ranking, lastKnown);
  const prioritized = prioritize(all, registrations, ranking, priority);
  const byLicence = new Map(registrations.map((r) => [r.licence, r]));
  const seated = new Set(prioritized.slice(0, capacity).map((p) => p.licence));
  const isForfait = (p: Player) => byLicence.get(p.licence)?.forfait === true;
  const isIntegrated = (p: Player) =>
    !seated.has(p.licence) && byLicence.get(p.licence)?.integrated === true;
  const acceptedSet = new Set(
    prioritized
      .filter((p) => !isForfait(p) && (seated.has(p.licence) || isIntegrated(p)))
      .map((p) => p.licence),
  );
  const active = registrations.filter((r) => !r.forfait);
  const accepted = orderParticipants(
    active.filter((r) => acceptedSet.has(r.licence)).map(toPlayer),
    ranking,
    lastKnown,
  );
  const waiting = prioritized.filter((p) => !isForfait(p) && !acceptedSet.has(p.licence));
  const forfaits = registrations.filter((r) => r.forfait).map(toPlayer);
  const suggested =
    waiting.find((p) => byLicence.get(p.licence)?.waitStatus !== "indisponible")?.licence ?? null;
  return {
    accepted,
    waiting,
    forfaits,
    capacity,
    free: capacity - accepted.length,
    suggested,
    topRanked: waiting
      .filter((p) => {
        const g = glissantOf(ranking)(p);
        return g !== null && g <= priority;
      })
      .map((p) => p.licence),
    integrated: prioritized
      .filter((p) => acceptedSet.has(p.licence) && isIntegrated(p))
      .map((p) => p.licence),
  };
}

/**
 * Données enregistrées avant la liste d'attente manuelle : un forfait y faisait entrer
 * automatiquement le premier en attente. Ces joueurs sont marqués `integrated` pour que la liste
 * des acceptés reste exactement la même.
 */
export function markLegacyIntegrations(
  registrations: Registration[],
  capacity: number,
  ranking: Record<string, number>,
  lastKnown: Record<string, { place: number; season: number }>,
  priority: number,
): Registration[] {
  const active = registrations.filter((r) => !r.forfait);
  const legacy = new Set(
    prioritize(
      orderParticipants(active.map(toPlayer), ranking, lastKnown),
      active,
      ranking,
      priority,
    )
      .slice(0, capacity)
      .map((p) => p.licence),
  );
  const now = new Set(
    acceptRegistrations(registrations, capacity, ranking, lastKnown, priority).accepted.map(
      (p) => p.licence,
    ),
  );
  if ([...legacy].every((l) => now.has(l))) return registrations;
  return registrations.map((r) =>
    legacy.has(r.licence) && !now.has(r.licence) ? { ...r, integrated: true } : r,
  );
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
