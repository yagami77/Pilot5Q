/**
 * Suites de la clôture d'un TN par le responsable national (remarques du 11 novembre 2026) :
 * classement glissant finalisé et son PDF, `RANKING.json` pour l'application 5 Quilles, PDF
 * récapitulatif du tournoi, fichiers JSON à importer dans le système fédéral e2i (demande du
 * 17 novembre 2026), puis envoi des deux PDF au secrétariat fédéral.
 *
 * Sans serveur, l'application ne peut ni déposer un fichier sur le FTP ni joindre une pièce à
 * un message : elle produit les fichiers et prépare le message, le responsable fait le reste.
 */
import type {
  E2iKind,
  RankingRow,
  Stage,
  StageRef,
  TournamentAward,
  TournamentState,
} from "@pilot5q/domain";
import {
  APP_RANKING_FILE,
  E2I_KINDS,
  appRankingJson,
  e2iExports,
  e2iFileName,
  e2iJson,
} from "@pilot5q/domain";

import { dateRange, nice } from "@/lib/format";

import type { ClosureChecklist } from "./persistence";

/** Destinataire des deux PDF. */
export const SECRETARIAT_EMAIL = "secretariat@ffbillard.com";

/** Étapes de la liste de contrôle, dans l'ordre. */
export const CLOSURE_STEPS = [
  "rankingPdf",
  "rankingJson",
  "recapPdf",
  "e2i",
  "secretariat",
] as const;
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

/** Libellé de chaque fichier e2i dans l'interface. */
export const E2I_LABELS: Record<E2iKind, string> = {
  qualif: "Qualifications",
  national: "National",
  masters: "Masters",
  consolante: "Consolante",
};

export interface E2iDownload {
  kind: E2iKind;
  name: string;
  blob: Blob;
  /** Nombre de matchs du fichier. */
  matches: number;
}

/**
 * Fichiers JSON du tournoi pour l'import dans e2i (`e2i_qualif.json`, `e2i_national.json`,
 * `e2i_masters.json`, `e2i_consolante.json`) ; une compétition sans match n'a pas de fichier.
 * `clubNumber` est le numéro fédéral du club hôte.
 */
export function e2iFiles(state: TournamentState, clubNumber: string): E2iDownload[] {
  const files = e2iExports(state, { clubNumber });
  return E2I_KINDS.flatMap((kind) => {
    const file = files[kind];
    if (!file) return [];
    return [
      {
        kind,
        name: e2iFileName(kind),
        blob: new Blob([e2iJson(file)], { type: "application/json;charset=utf-8" }),
        matches: file.phases.reduce(
          (n, p) => n + p.poules.reduce((k, x) => k + x.matchs.length, 0),
          0,
        ),
      },
    ];
  });
}

/** Nom de l'archive qui regroupe les fichiers e2i d'une étape. */
export function e2iZipName(stage: Stage): string {
  return `e2i ${stage.name} ${stage.season}.zip`;
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
