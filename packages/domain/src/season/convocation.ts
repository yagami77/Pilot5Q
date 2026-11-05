/**
 * Convocations : canevas de mail avec variables et horaires (SPEC §8).
 *
 * Variables disponibles (entre accolades doubles) : `{{prenom}}`, `{{nom}}`, `{{club}}`,
 * `{{tournoi}}`, `{{lieu}}`, `{{dates}}`, `{{heure}}`, `{{poule}}`, `{{billard}}`, `{{adresse}}`,
 * `{{url}}`. Une variable inconnue est laissée telle quelle ; une variable vide est remplacée par
 * une chaîne vide.
 */
import type { SeasonSettings } from "./types.js";

/** Canevas par défaut du mail de convocation. */
export const DEFAULT_MAIL_TEMPLATE = `Bonjour {{prenom}} {{nom}},

Vous êtes convoqué(e) au {{tournoi}} de billard 5-Quilles, organisé par {{lieu}} du {{dates}}.
Convocation : {{heure}}.{{poule}}

Merci de confirmer votre présence par retour de mail. Les droits d'inscription (30 €, juniors exemptés) sont réglés sur place.

Sportivement,
Le responsable national 5-Quilles`;

/** Remplace les variables `{{x}}` du canevas. */
export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined ? whole : v;
  });
}

/** « DUPONT JEAN CLAUDE » → { nom: « DUPONT », prenom: « Jean Claude » }. */
export function splitName(name: string): { nom: string; prenom: string } {
  const [nom = "", ...rest] = name.trim().split(/\s+/);
  const prenom = rest
    .map((w) => w.toLowerCase().replace(/(^|[-'])\p{L}/gu, (c) => c.toUpperCase()))
    .join(" ");
  return { nom, prenom };
}

/** Heure de convocation d'une journée selon les billards 3m10 (SPEC §8). */
export function convocationTime(
  day: "vendredi" | "samedi" | "dimanche",
  bigTables: number,
  settings: SeasonSettings,
): string {
  if (day === "vendredi") return settings.convocationFriday;
  return bigTables <= 3 ? settings.convocationWeekendThreeBig : settings.convocationWeekend;
}

/** Liste de destinataires (emails dédupliqués, sans vides). */
export function recipients(emails: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const v = (e ?? "").trim().toLowerCase();
    if (v === "" || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
