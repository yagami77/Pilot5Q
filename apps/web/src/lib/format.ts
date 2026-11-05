/** Utilitaires d'affichage : noms, clubs, dates, nombres. */

/** « DUPONT JEAN CLAUDE » → « Dupont Jean Claude ». */
export function titleCase(name: string): string {
  return name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
}

/** Nom affiché : NOM Prénom. */
export function nice(name: string): string {
  return titleCase(name);
}

/** « DUPONT JEAN CLAUDE » → « Dupont J.C. ». */
export function shortName(name: string): string {
  const w = name.split(" ").filter(Boolean);
  const first = w[0] ?? "";
  if (w.length === 1) return titleCase(first);
  return `${titleCase(first)} ${w
    .slice(1)
    .map((x) => `${x[0] ?? ""}.`)
    .join("")}`;
}

/** Initiales pour un avatar. */
export function initials(name: string): string {
  const w = name.split(" ").filter(Boolean);
  return `${w[0]?.[0] ?? ""}${w[1]?.[0] ?? ""}`.toUpperCase();
}

/** Teinte stable dérivée du nom (0–359). */
export function hue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

const CLUB_REPLACEMENTS: [RegExp, string][] = [
  [/^ass\.?\s*sport\.?\s*/i, "AS "],
  [/^association sportive\s*/i, "AS "],
  [/^ass\.\s*/i, "Ass. "],
  [/^acad[ée]mie de billard\s*/i, "Acad. "],
  [/^acad[ée]mie\s*/i, "Acad. "],
  [/^acad\.\s*/i, "Acad. "],
  [/^billard club\s*/i, "BC "],
  [/^b\.c\.\s*/i, "BC "],
  [/^cercle de billard\s*/i, "Cercle "],
  [/^cercle des\s*/i, "Cercle "],
  [/^club de billard\s*/i, "CB "],
];

/** Nom de club raccourci pour les listes. */
export function clubShort(club: string): string {
  let c = (club ?? "").trim();
  for (const [re, rep] of CLUB_REPLACEMENTS) {
    if (re.test(c)) {
      c = c.replace(re, rep);
      break;
    }
  }
  return c.replace(/\s+/g, " ").trim();
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
}

/** Ajoute `days` jours à une date ISO (AAAA-MM-JJ). */
export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** « 2026-10-30 » → « vendredi 30 octobre ». */
export function longDate(iso: string, withYear = false): string {
  const d = parseIso(iso);
  const day = d.getDate() === 1 ? "1er" : String(d.getDate());
  const base = `${DAYS[d.getDay()]} ${day} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** « 2026-10-30 » → « 30 oct. ». */
export function shortDate(iso: string): string {
  const d = parseIso(iso);
  const day = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${day} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Plage de dates : « 30 oct. – 1er nov. 2026 ». */
export function dateRange(from: string, to: string): string {
  return `${shortDate(from)} – ${shortDate(to)} ${parseIso(to).getFullYear()}`;
}

/** Heure « hh:mm ». */
export function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Montant en euros avec espace fine. */
export function euros(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

/** Moyenne à trois décimales. */
export function moy(n: number): string {
  return n ? n.toFixed(3) : "–";
}

/** Pluriel simple. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Rang ordinal : 1 → « 1er », 2 → « 2e ». */
export function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}
