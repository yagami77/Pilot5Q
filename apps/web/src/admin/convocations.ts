/** Convocations d'une étape : mails des joueurs, du club hôte et du directeur de jeu. */
import type { Player, Stage } from "@pilot5q/domain";
import { convocationTime, recipients, renderTemplate, splitName } from "@pilot5q/domain";

import { dateRange, longDate } from "@/lib/format";

import type { SeasonDocument } from "./persistence";

export interface Convocation {
  to: string;
  name: string;
  subject: string;
  body: string;
}

function lieu(doc: SeasonDocument, stage: Stage): { lieu: string; adresse: string } {
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  if (!club) return { lieu: stage.city, adresse: stage.city };
  return {
    lieu: `${club.name} (${club.city})`,
    adresse: [club.address, `${club.postcode} ${club.city}`.trim()].filter(Boolean).join(", "),
  };
}

/** Mails de convocation des joueurs acceptés (Masters convoqués le samedi). */
export function playerConvocations(
  doc: SeasonDocument,
  stage: Stage,
  accepted: Player[],
  placement: Record<string, { poule: number; billard: number | null }> = {},
): Convocation[] {
  const { lieu: where, adresse } = lieu(doc, stage);
  const dates = stage.start && stage.end ? dateRange(stage.start, stage.end) : "";
  const masters = 8;
  const tournoi = `${stage.name} ${stage.season}`;
  return accepted.map((p) => {
    const { nom, prenom } = splitName(p.name);
    const isMaster = p.seed <= masters;
    const day = isMaster ? "samedi" : "vendredi";
    const date = stage.start ? longDate(isMaster ? addOne(stage.start) : stage.start) : day;
    const heure = `${date} à ${convocationTime(day, stage.big, doc.settings).replace(":", "h")}`;
    const pl = placement[p.name];
    const poule = pl
      ? ` Poule ${pl.poule}${pl.billard !== null ? `, billard ${pl.billard}` : ""}.`
      : isMaster
        ? " Préqualifié(e) Masters : poules du samedi."
        : "";
    const body = renderTemplate(doc.settings.mailTemplate, {
      prenom,
      nom,
      club: p.club,
      tournoi,
      lieu: where,
      adresse,
      dates,
      heure,
      poule,
      billard: pl?.billard !== null && pl?.billard !== undefined ? String(pl.billard) : "",
      url: stage.registrationUrl,
    });
    return {
      to: p.email ?? "",
      name: p.name,
      subject: `Convocation ${tournoi} · ${stage.city}`,
      body,
    };
  });
}

function addOne(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + 1));
  return dt.toISOString().slice(0, 10);
}

/** Mail au club hôte : liste des acceptés, besoins en billards, horaires. */
export function clubConvocation(
  doc: SeasonDocument,
  stage: Stage,
  accepted: Player[],
  djName: string,
): Convocation {
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  const juniors = accepted.filter((p) => p.junior).length;
  const s = doc.settings;
  const body = `Bonjour,

Merci d'accueillir le ${stage.name} ${stage.season} de billard 5-Quilles${stage.start ? ` du ${dateRange(stage.start, stage.end)}` : ""}.

Joueurs acceptés : ${accepted.length} (dont ${juniors} junior${juniors > 1 ? "s" : ""} U21 exempté${juniors > 1 ? "s" : ""} du droit d'inscription).
Billards : ${stage.big} × 3m10 et ${stage.small} × 2m80.
Convocations : vendredi ${s.convocationFriday}, samedi et dimanche ${convocationTime("samedi", stage.big, s)}.
Directeur de jeu désigné : ${djName || "à désigner"}.
Droit d'inscription : ${s.inscriptionFee} € ; dotation FFB ${s.ffbShare} €, dotation club ${s.clubShare} €.

La liste ordonnée des participants (8 Masters puis ordre du serpentin) est jointe.

Sportivement,
Le responsable national 5-Quilles`;
  return {
    to: club?.email ?? "",
    name: club?.name ?? stage.city,
    subject: `${stage.name} ${stage.season} · organisation`,
    body,
  };
}

/** Mail au directeur de jeu : accès au cockpit et rappels. */
export function djConvocation(
  stage: Stage,
  dj: { name: string; email: string },
  appUrl: string,
  accepted: number,
): Convocation {
  const body = `Bonjour ${splitName(dj.name).prenom},

Vous êtes désigné(e) directeur de jeu du ${stage.name} ${stage.season} à ${stage.city}.
Le tournoi est ouvert dans Pilot5Q (${accepted} joueurs, liste ordonnée et billards prêts) : ${appUrl}
Vos droits sur le tournoi valent jusqu'à sa clôture par le responsable national.

Jeudi : numérotation des billards et tirage des poules. Vendredi à dimanche : saisie des scores phase par phase.

Sportivement,
Le responsable national 5-Quilles`;
  return {
    to: dj.email,
    name: dj.name,
    subject: `${stage.name} ${stage.season} · directeur de jeu`,
    body,
  };
}

/** Destinataires dédupliqués (pour un envoi groupé en copie cachée). */
export function recipientList(convocations: Convocation[]): string {
  return recipients(convocations.map((c) => c.to)).join("; ");
}

/** Export CSV des convocations (destinataire, nom, objet, texte). */
export function convocationsCsv(convocations: Convocation[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [
    "email;nom;objet;message",
    ...convocations.map((c) => [c.to, c.name, c.subject, c.body].map(q).join(";")),
  ].join("\n");
}
