/** Convocations d'une étape : mails des joueurs, du club hôte et du directeur de jeu. */
import type { Player, Stage, TournamentState } from "@pilot5q/domain";
import {
  convocationTime,
  recipients,
  renderTemplate,
  splitName,
  stageSettings,
} from "@pilot5q/domain";

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

/** Poule et billard d'un joueur, par nom (connus une fois les poules du vendredi tirées). */
export type Placement = Record<string, { poule: number; billard: number | null }>;

/** Placement des joueurs d'après le tournoi du DJ (poules du vendredi, premier billard). */
export function placementOf(state: TournamentState | null): Placement {
  const out: Placement = {};
  for (const poule of state?.poules.PREQ ?? []) {
    for (const name of poule.players) {
      out[name] = { poule: poule.num, billard: poule.billards[0] ?? null };
    }
  }
  return out;
}

/** « 08:30 » → « 8h30 », « 10:30 » → « 10h30 ». */
export function hourText(time: string): string {
  return time.replace(/^0(\d)/, "$1").replace(":", "h");
}

/** Texte de `{{poule}}` quand la poule n'est pas encore connue (avant le tirage du jeudi). */
export const POULE_UNKNOWN = " Poule communiquée après le tirage.";

/** « 30 octobre au 1er novembre 2026 » (lu après « du » dans le canevas). */
export function datesText(start: string, end: string): string {
  if (!start || !end) return "";
  const dm = (iso: string) => longDate(iso).split(" ").slice(1).join(" ");
  return `${dm(start)} au ${dm(end)} ${end.slice(0, 4)}`;
}

/** Mails de convocation des joueurs acceptés (Masters convoqués le samedi). */
export function playerConvocations(
  doc: SeasonDocument,
  stage: Stage,
  accepted: Player[],
  placement: Placement = {},
): Convocation[] {
  const { lieu: where, adresse } = lieu(doc, stage);
  // Horaires et canevas : ceux de l'étape s'ils sont surchargés, sinon ceux de la saison.
  const settings = stageSettings(doc.settings, stage);
  const dates = datesText(stage.start, stage.end);
  const masters = 8;
  const tournoi = `${stage.name} ${stage.season}`;
  return accepted.map((p) => {
    const { nom, prenom } = splitName(p.name);
    const isMaster = p.seed <= masters;
    const day = isMaster ? "samedi" : "vendredi";
    const date = stage.start ? longDate(isMaster ? addOne(stage.start) : stage.start) : day;
    const heure = `${date} à ${hourText(convocationTime(day, stage.big, settings))}`;
    const pl = placement[p.name];
    const poule = pl
      ? ` Poule ${pl.poule}${pl.billard !== null ? `, billard ${pl.billard}` : ""}.`
      : isMaster
        ? " Préqualifié(e) Masters : poules du samedi."
        : POULE_UNKNOWN;
    const body = renderTemplate(settings.mailTemplate, {
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
  const s = stageSettings(doc.settings, stage);
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

/** Lien de connexion du directeur de jeu (ouvre la fenêtre « Accès Directeur de jeu »). */
export function djLoginLink(origin: string, base: string, email: string): string {
  return `${origin}${base}?acces=dj&email=${encodeURIComponent(email)}`;
}

/** « 048213 » → « 048 213 » (lecture plus sûre au téléphone). */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Email d'activation du directeur de jeu : lien vers le site, email et code à 6 chiffres. */
export function djActivationMail(
  stage: Stage,
  dj: { name: string; email: string },
  link: string,
  code: string,
  accepted: number,
): Convocation {
  const prenom = splitName(dj.name).prenom || "";
  const dates = stage.start && stage.end ? ` (${dateRange(stage.start, stage.end)})` : "";
  const body = `Bonjour${prenom ? ` ${prenom}` : ""},

Vous êtes directeur de jeu du ${stage.name} ${stage.season} à ${stage.city}${dates}. Votre tournoi est ouvert dans Pilot5Q : ${accepted} joueurs, liste ordonnée et billards prêts.

Pour vous connecter :
1. Ouvrez ce lien : ${link}
2. « Accès Directeur de jeu » s'ouvre avec votre email
3. Saisissez le code : ${formatCode(code)}

Email : ${dj.email}
Code : ${formatCode(code)}

Vous arriverez directement sur votre tournoi. Vos droits valent jusqu'à la clôture du tournoi par le responsable national ; il restera ensuite consultable en lecture seule.
Ce code est personnel : il donne accès à la saisie des résultats, ne le transmettez pas.

Sportivement,
Le responsable national 5-Quilles`;
  return {
    to: dj.email,
    name: dj.name,
    subject: `${stage.name} ${stage.season} · votre accès directeur de jeu`,
    body,
  };
}
