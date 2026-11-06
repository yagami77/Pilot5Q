/**
 * Convocations : canevas de mail avec variables et horaires (SPEC §8).
 *
 * Variables disponibles (entre accolades doubles) : `{{prenom}}`, `{{nom}}`, `{{club}}`,
 * `{{tournoi}}`, `{{lieu}}`, `{{dates}}`, `{{heure}}`, `{{poule}}`, `{{billard}}`, `{{adresse}}`,
 * `{{url}}`. Une variable inconnue est laissée telle quelle ; une variable vide est remplacée par
 * une chaîne vide.
 */
import type { SeasonSettings } from "./types.js";

/**
 * Canevas par défaut du mail de convocation (texte du responsable national, 6 novembre 2026). La
 * phrase « En cas de forfait… » est mise en évidence (rouge) dans l'aperçu et l'email HTML.
 */
export const DEFAULT_MAIL_TEMPLATE = `Bonjour {{prenom}} {{nom}},

Vous êtes convoqué(e) au {{tournoi}} de billard 5-Quilles, organisé par {{lieu}} du {{dates}}.
Convocation : {{heure}}.{{poule}}

En cas de forfait merci de prévenir au plus vite par retour de mail. Les droits d'inscription (30 €, juniors exemptés) sont réglés sur place.

Sportivement,
Le responsable national 5-Quilles`;

/**
 * Débuts des phrases d'alerte mises en évidence dans un mail (la phrase entière, jusqu'au point,
 * est en rouge dans l'aperçu et l'email HTML ; le texte brut reste inchangé).
 */
export const MAIL_ALERT_STARTS = ["En cas de forfait"];

/** Morceau de texte d'un mail, `alert` : à mettre en évidence. */
export interface MailSegment {
  text: string;
  alert: boolean;
}

/** Découpe un mail en morceaux normaux et phrases d'alerte. */
export function mailSegments(text: string, starts: string[] = MAIL_ALERT_STARTS): MailSegment[] {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (starts.length === 0) return [{ text, alert: false }];
  const re = new RegExp(`(?:${starts.map(escape).join("|")})[^.!\n]*[.!]?`, "g");
  const out: MailSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), alert: false });
    out.push({ text: m[0], alert: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), alert: false });
  return out;
}

/** Couleur des phrases d'alerte dans l'email HTML (rouge des alertes, DESIGN.md). */
export const MAIL_ALERT_COLOR = "#DC3F5A";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Version HTML d'un mail (pour un collage dans un client de messagerie) : texte échappé, sauts de
 * ligne conservés, phrases d'alerte en rouge et en gras.
 */
export function mailHtml(text: string): string {
  const body = mailSegments(text)
    .map((s) => {
      const html = escapeHtml(s.text).replace(/\n/g, "<br>");
      return s.alert
        ? `<span style="color:${MAIL_ALERT_COLOR};font-weight:600">${html}</span>`
        : html;
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0F1B33">${body}</div>`;
}

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
