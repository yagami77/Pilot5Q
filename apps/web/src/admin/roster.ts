/**
 * Inscrits modifiés après l'ouverture du TN au directeur de jeu (RETOURS-2026-11-05, section
 * « Responsable national ») :
 *
 * - jusqu'au mercredi, et en pratique jusqu'au tirage des poules du vendredi, le responsable gère
 *   les forfaits et l'intégration depuis la liste d'attente (RETOURS-2026-11-06 : un forfait
 *   libère une place sans intégrer personne ; le responsable choisit qui intégrer) ;
 * - chaque modification est répercutée dans le tournoi du cockpit (événement `players.imported`
 *   sur le journal) et crée une notification pour le DJ, avec l'impact ;
 * - une fois les poules du vendredi tirées, seul le DJ gère les forfaits de dernière minute
 *   (SPEC §4) : la répercussion est refusée.
 */
import type { Player, TournamentEvent, TournamentState } from "@pilot5q/domain";

import { pouleSizes, replay } from "@/lib/engine";
import { addDays, shortName } from "@/lib/format";
import type { NotificationInput } from "@/lib/notifications";

/** Écart entre les joueurs du tournoi et la nouvelle liste ordonnée des acceptés. */
export interface RosterDiff {
  removed: Player[];
  added: Player[];
  /** Entrées et sorties parmi les préqualifiés Masters. */
  mastersIn: Player[];
  mastersOut: Player[];
  juniorOn: Player[];
  juniorOff: Player[];
  /** L'ordre de la liste (serpentin) a changé. */
  reordered: boolean;
  poulesBefore: number;
  poulesAfter: number;
  countBefore: number;
  countAfter: number;
}

const key = (p: Player) => p.licence || p.name;

export function rosterDiff(
  before: Player[],
  after: Player[],
  mastersCount: number,
  maxPoulesOf3: number,
): RosterDiff {
  const b = new Map(before.map((p) => [key(p), p]));
  const a = new Map(after.map((p) => [key(p), p]));
  const masters = (list: Player[]) =>
    new Set(
      [...list]
        .sort((x, y) => x.seed - y.seed)
        .slice(0, mastersCount)
        .map(key),
    );
  const mb = masters(before);
  const ma = masters(after);
  const poules = (n: number) => pouleSizes(Math.max(0, n - mastersCount), maxPoulesOf3).length;
  const order = (list: Player[]) =>
    [...list]
      .sort((x, y) => x.seed - y.seed)
      .map(key)
      .join("|");
  return {
    removed: before.filter((p) => !a.has(key(p))),
    added: after.filter((p) => !b.has(key(p))),
    mastersIn: after.filter((p) => ma.has(key(p)) && !mb.has(key(p))),
    mastersOut: before.filter((p) => mb.has(key(p)) && !ma.has(key(p))),
    juniorOn: after.filter((p) => b.has(key(p)) && p.junior && !b.get(key(p))?.junior),
    juniorOff: after.filter((p) => b.has(key(p)) && !p.junior && b.get(key(p))?.junior),
    reordered: order(before) !== order(after),
    poulesBefore: poules(before.length),
    poulesAfter: poules(after.length),
    countBefore: before.length,
    countAfter: after.length,
  };
}

export function rosterChanged(d: RosterDiff): boolean {
  return (
    d.removed.length + d.added.length + d.juniorOn.length + d.juniorOff.length > 0 || d.reordered
  );
}

/**
 * Notification du DJ pour un écart. `forfaits` : licences déclarées forfait (pour nommer la cause
 * d'un départ) ; `reinstated` : licences dont le forfait vient d'être annulé.
 */
export function rosterNotification(
  tournamentId: string,
  d: RosterDiff,
  forfaits: Set<string>,
  reinstated: Set<string> = new Set(),
): NotificationInput {
  const name = (p: Player) => shortName(p.name);
  const origin = (p: Player) => (reinstated.has(p.licence) ? "forfait annulé" : "liste d'attente");
  const lines: string[] = [];
  const n = Math.min(d.removed.length, d.added.length);
  for (let i = 0; i < n; i++) {
    const out = d.removed[i]!;
    const inn = d.added[i]!;
    lines.push(
      `${name(out)}${forfaits.has(out.licence) ? " (forfait)" : ""} remplacé par ${name(inn)} (${origin(inn)})`,
    );
  }
  for (const p of d.removed.slice(n)) {
    lines.push(
      forfaits.has(p.licence)
        ? `${name(p)} forfait : place libérée, intégration au choix du responsable`
        : `${name(p)} retiré, non remplacé`,
    );
  }
  for (const p of d.added.slice(n)) lines.push(`${name(p)} intégré (${origin(p)})`);
  for (const p of d.mastersIn) lines.push(`${name(p)} entre dans les préqualifiés Masters`);
  for (const p of d.mastersOut) {
    if (!d.removed.some((r) => key(r) === key(p))) {
      lines.push(`${name(p)} sort des préqualifiés Masters et joue le vendredi`);
    }
  }
  for (const p of d.juniorOn) lines.push(`${name(p)} signalé U21 (exempté du droit)`);
  for (const p of d.juniorOff) lines.push(`${name(p)} n'est plus signalé U21`);
  if (d.poulesBefore !== d.poulesAfter) {
    lines.push(`Poules du vendredi : ${d.poulesBefore} → ${d.poulesAfter}`);
  }
  if (lines.length === 0 && d.reordered)
    lines.push("Ordre de la liste des participants mis à jour");

  const forfaitOut = d.removed.some((p) => forfaits.has(p.licence));
  const title =
    d.removed.length > 0 && forfaitOut
      ? d.removed.length === 1
        ? `Forfait de ${name(d.removed[0]!)}`
        : `${d.removed.length} forfaits`
      : d.added.length > 0
        ? d.added.length === 1
          ? `Intégration de ${name(d.added[0]!)}`
          : `${d.added.length} joueurs intégrés`
        : "Liste des participants mise à jour";
  return {
    tournamentId,
    kind: forfaitOut ? "forfait" : "inscription",
    title,
    body: `Le responsable national a modifié les inscrits : ${d.countAfter} joueurs (avant : ${d.countBefore}). La liste du jeudi est à jour.`,
    impact: lines.join(" · "),
  };
}

/** Mercredi précédant le vendredi de l'étape (limite de gestion des inscrits). */
export function wednesdayBefore(friday: string): string {
  return addDays(friday, -2);
}

/* ---------- Répercussion dans le journal du tournoi ---------- */

export type SyncOutcome =
  | { status: "synced"; diff: RosterDiff; notified: boolean }
  | { status: "unchanged" }
  | { status: "drawn" }
  | { status: "missing" };

export interface RosterIO {
  /** Journal du tournoi (celui du cockpit s'il est ouvert, sinon l'enregistré). */
  load: () => Promise<TournamentEvent[]>;
  /** Ajoute `players.imported` au journal. */
  append: (event: { type: "players.imported"; payload: { players: Player[] } }) => Promise<void>;
  notify: (n: NotificationInput) => Promise<unknown>;
}

/** Les poules du vendredi sont-elles tirées ? (au-delà, seul le DJ gère les forfaits) */
export function preqDrawn(state: TournamentState): boolean {
  return state.poules.PREQ.length > 0;
}

/**
 * Répercute la nouvelle liste ordonnée dans le tournoi du DJ et le prévient. Refusé si les poules
 * du vendredi sont tirées ou si le tournoi n'est pas enregistré dans ce navigateur.
 */
export async function syncRoster(
  tournamentId: string,
  accepted: Player[],
  io: RosterIO,
  forfaits: Set<string>,
  reinstated: Set<string> = new Set(),
): Promise<SyncOutcome> {
  const events = await io.load();
  if (events.length === 0) return { status: "missing" };
  const state = replay(events);
  if (preqDrawn(state)) return { status: "drawn" };
  const diff = rosterDiff(
    state.players,
    accepted,
    state.rules.mastersPrequalified,
    state.rules.maxPoulesOf3,
  );
  if (!rosterChanged(diff)) return { status: "unchanged" };
  await io.append({ type: "players.imported", payload: { players: accepted } });
  await io.notify(rosterNotification(tournamentId, diff, forfaits, reinstated));
  return { status: "synced", diff, notified: true };
}

/** Date limite affichée : « mercredi 28 octobre ». */
export function deadlineLabel(friday: string): string {
  const [y, m, d] = wednesdayBefore(friday).split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
