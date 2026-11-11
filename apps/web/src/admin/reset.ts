/**
 * Suppression d'une saison : tout ce qui en dépend dans ce navigateur part avec elle.
 *
 * Sans ce ménage, une saison supprimée laissait derrière elle le journal des tournois ouverts
 * aux directeurs de jeu, leurs codes d'accès (toujours valides), leurs notifications et les
 * pièces jointes des étapes : la saison rechargée ensuite (démonstration comprise) cohabitait
 * avec ces restes.
 */
import { del } from "idb-keyval";

import type { AuthProvider } from "@/auth/provider";
import { notificationsKey } from "@/lib/notifications";
import { loadIndex, removeTournament } from "@/store/persistence";

import { listAttachments, removeAttachment } from "./attachments";
import type { SeasonDocument } from "./persistence";

/** Ce qui a été supprimé avec la saison (pour le message à l'écran). */
export interface SeasonPurge {
  /** Tournois (journaux du cockpit) supprimés. */
  tournaments: string[];
  /** Accès de directeurs de jeu retirés. */
  accesses: number;
  attachments: number;
}

/** Identifiants des tournois ouverts depuis les étapes de la saison (ouvertures retirées comprises). */
export async function seasonTournamentIds(
  doc: SeasonDocument,
  provider: Pick<AuthProvider, "listDjAccess">,
): Promise<string[]> {
  const ids = new Set<string>();
  for (const s of doc.stages) if (s.tournamentId) ids.add(s.tournamentId);
  const accesses = await provider.listDjAccess().catch(() => []);
  for (const a of accesses) if (a.seasonId === doc.id) ids.add(a.tournamentId);
  // Une ouverture retirée puis refaite laisse un ancien journal « <étape>-<horodatage> ».
  const index = await loadIndex();
  for (const t of index) if (doc.stages.some((s) => t.id.startsWith(`${s.id}-`))) ids.add(t.id);
  return [...ids];
}

/**
 * Supprime ce qui dépend de la saison : accès des directeurs de jeu, journaux et notifications
 * des tournois, pièces jointes des étapes. Le document de saison lui-même est supprimé par le
 * store (`destroy`).
 */
export async function purgeSeasonData(
  doc: SeasonDocument,
  provider: Pick<AuthProvider, "listDjAccess" | "revokeDjAccess">,
): Promise<SeasonPurge> {
  const tournaments = await seasonTournamentIds(doc, provider);
  const accesses = (await provider.listDjAccess().catch(() => [])).filter(
    (a) => a.seasonId === doc.id,
  );
  for (const a of accesses) await provider.revokeDjAccess(a.stageId);
  for (const id of tournaments) {
    await removeTournament(id);
    await del(notificationsKey(id)).catch(() => undefined);
  }
  let attachments = 0;
  for (const s of doc.stages) {
    for (const a of await listAttachments(s.id)) {
      await removeAttachment(s.id, a.id).catch(() => undefined);
      attachments++;
    }
  }
  return { tournaments, accesses: accesses.length, attachments };
}
