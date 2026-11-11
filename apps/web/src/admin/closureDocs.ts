/**
 * Suites de la clôture d'un TN par le responsable national (remarques du 11 novembre 2026) :
 * classement glissant finalisé et son PDF, `RANKING.json` pour l'application 5 Quilles, PDF
 * récapitulatif du tournoi, puis envoi des deux PDF au secrétariat fédéral.
 *
 * Sans serveur, l'application ne peut ni déposer un fichier sur le FTP ni joindre une pièce à
 * un message : elle produit les fichiers et prépare le message, le responsable fait le reste.
 */
import type { RankingRow, Stage, StageRef, TournamentAward } from "@pilot5q/domain";
import { APP_RANKING_FILE, appRankingJson } from "@pilot5q/domain";

import { dateRange, nice } from "@/lib/format";

import type { ClosureChecklist } from "./persistence";

/** Destinataire des deux PDF. */
export const SECRETARIAT_EMAIL = "secretariat@ffbillard.com";

/** Étapes de la liste de contrôle, dans l'ordre. */
export const CLOSURE_STEPS = ["rankingPdf", "rankingJson", "recapPdf", "secretariat"] as const;
export type ClosureStep = (typeof CLOSURE_STEPS)[number];

/** Nombre d'étapes faites. */
export function closureDone(checklist: ClosureChecklist | undefined): number {
  return CLOSURE_STEPS.filter((s) => Boolean(checklist?.[s])).length;
}

/** Fichier `RANKING.json` de l'application 5 Quilles, prêt à déposer. */
export function rankingJsonFile(rows: RankingRow[], last: StageRef): { name: string; blob: Blob } {
  return {
    name: APP_RANKING_FILE,
    blob: new Blob([appRankingJson(rows, last)], { type: "application/json;charset=utf-8" }),
  };
}

export interface SecretariatMail {
  to: string;
  subject: string;
  body: string;
  /** Lien `mailto:` avec objet et corps pré-remplis (les pièces sont à joindre à la main). */
  href: string;
}

/** Message au secrétariat : objet, corps qui rappelle les deux PDF à joindre, lien mailto. */
export function secretariatMail(
  stage: Stage,
  awards: TournamentAward[],
  ranked: number,
  attachments: string[],
): SecretariatMail {
  const top = (origin: TournamentAward["origin"]) =>
    awards
      .filter((a) => a.origin === origin && !a.abandon)
      .slice(0, 2)
      .map((a) => nice(a.name))
      .join(", ");
  const label = `${stage.name} ${stage.season}`;
  const where = [stage.city, stage.start ? dateRange(stage.start, stage.end) : ""]
    .filter(Boolean)
    .join(", ");
  const subject = `5-Quilles · ${label}${stage.city ? ` (${stage.city})` : ""} : classement glissant et récapitulatif du tournoi`;
  const body = `Bonjour,

Le ${label} de billard 5-Quilles${where ? ` (${where})` : ""} est clôturé.

Participants : ${awards.length} (abandons : ${awards.filter((a) => a.abandon).length}).
Masters : ${top("M") || "–"}.
National : ${top("N") || "–"}.
Le classement glissant mis à jour compte ${ranked} joueurs.

Pièces jointes (${attachments.length} PDF) :
${attachments.map((a) => `- ${a}`).join("\n")}

Sportivement,
Le responsable national 5-Quilles`;
  const href = `mailto:${SECRETARIAT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
  return { to: SECRETARIAT_EMAIL, subject, body, href };
}
