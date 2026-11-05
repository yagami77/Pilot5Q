/**
 * Inscrits : lecture du CSV du site fédéral et liste ordonnée des participants (SPEC §2).
 *
 * Règles implémentées :
 * - CSV séparateur `;`, entête `id;date;licence;email;id_evenement;forfait;cle;paye;actif;
 *   prenom_licencie;nom_licencie;nom_club;num_club;nom_ligue;date_debut_evenement;
 *   date_fin_evenement;saison;etat`. Les colonnes sont repérées par leur nom (ordre libre,
 *   casse et accents ignorés). Tolérant aux guillemets (champs entre `"`, `""` échappé), au BOM,
 *   aux fins de ligne `\r\n` et aux accents mal encodés (UTF-8 lu en Latin-1 : `EnregistrÃ©e`).
 * - Dates d'inscription `JJ/MM/AAAA HH:MM` (secondes facultatives) ; les formats ISO sont aussi
 *   acceptés. Le `seed` est l'ordre d'inscription (tri par date, puis ordre du fichier).
 * - `name` = « NOM PRENOM » en majuscules, `licence` en majuscules, `place` null (inconnue
 *   avant `orderParticipants`).
 * - Liste ordonnée (§2) : place = place au classement glissant ; sinon dernier classement
 *   connu `P` → 9 si `P ≤ 8`, sinon `P + 0,5` ; sinon nouveau joueur en fin de liste, dans
 *   l'ordre d'inscription. Tri croissant par place, puis (égalité) classement glissant avant
 *   place dérivée, puis ordre d'inscription.
 *
 * Choix sur les points laissés ouverts :
 * - Lignes ignorées : `etat` différent de « Enregistrée » (inscription annulée, en attente…)
 *   ou `forfait` non vide (le joueur s'est désisté sur le site fédéral). Une licence en double
 *   ne produit qu'un joueur (première inscription conservée). Une ligne sans licence est
 *   ignorée.
 * - `ranking` et `lastKnown` sont indexés par licence (identifiant fédéral unique) ; à défaut,
 *   le nom « NOM PRENOM » est accepté comme clé de secours.
 * - Le statut junior (U21) n'est pas déductible du CSV : `junior` reste indéfini.
 */
import type { Player } from "./types.js";

/** Supprime accents et casse pour comparer des libellés. */
function normalizeLabel(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Répare une chaîne UTF-8 lue comme du Latin-1 (`Ã©` → `é`). Rend la chaîne telle quelle sinon. */
export function fixMojibake(s: string): string {
  if (!/[Â-ô][\u0080-¿]/.test(s)) return s;
  const bytes: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0xff) return s;
    bytes.push(code);
  }
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    let len = 1;
    let cp = b0;
    if (b0 >= 0xf0) {
      len = 4;
      cp = b0 & 0x07;
    } else if (b0 >= 0xe0) {
      len = 3;
      cp = b0 & 0x0f;
    } else if (b0 >= 0xc0) {
      len = 2;
      cp = b0 & 0x1f;
    } else if (b0 >= 0x80) {
      return s; // octet de continuation isolé : pas de l'UTF-8
    }
    for (let j = 1; j < len; j++) {
      const bj = bytes[i + j];
      if (bj === undefined || (bj & 0xc0) !== 0x80) return s;
      cp = (cp << 6) | (bj & 0x3f);
    }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}

/** Découpe un texte CSV (séparateur `;`) en lignes de champs, guillemets compris. */
export function parseCsvRows(text: string, separator = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Horodatage (ms) d'une date `JJ/MM/AAAA HH:MM[:SS]` ou ISO ; NaN si illisible. */
export function parseFrenchDate(s: string): number {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(s);
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    return Date.UTC(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh ?? 0),
      Number(mi ?? 0),
      Number(ss ?? 0),
    );
  }
  const t = Date.parse(s.trim());
  return Number.isNaN(t) ? Number.NaN : t;
}

/** Lit le CSV des inscrits du site fédéral (séparateur `;`, SPEC §2). */
export function parseInscritsCsv(text: string): Player[] {
  const rows = parseCsvRows(fixMojibake(text));
  const header = rows[0];
  if (!header) return [];
  const col = new Map<string, number>();
  header.forEach((h, i) => col.set(normalizeLabel(fixMojibake(h)), i));
  const get = (row: string[], name: string): string => {
    const i = col.get(name);
    return i === undefined ? "" : fixMojibake(row[i] ?? "").trim();
  };
  const seen = new Set<string>();
  const entries: { player: Player; date: number; index: number }[] = [];
  rows.slice(1).forEach((row, index) => {
    const etat = normalizeLabel(get(row, "etat"));
    if (etat !== "enregistree") return;
    if (get(row, "forfait") !== "") return;
    const licence = get(row, "licence").toUpperCase();
    if (licence === "" || seen.has(licence)) return;
    seen.add(licence);
    const nom = get(row, "nom_licencie").toUpperCase();
    const prenom = get(row, "prenom_licencie").toUpperCase();
    const player: Player = {
      licence,
      name: `${nom} ${prenom}`.trim(),
      club: get(row, "nom_club"),
      seed: 0,
      place: null,
    };
    const email = get(row, "email");
    if (email !== "") player.email = email;
    entries.push({ player, date: parseFrenchDate(get(row, "date")), index });
  });
  entries.sort((x, y) => {
    const dx = Number.isNaN(x.date) ? Number.POSITIVE_INFINITY : x.date;
    const dy = Number.isNaN(y.date) ? Number.POSITIVE_INFINITY : y.date;
    return dx - dy || x.index - y.index;
  });
  return entries.map((e, i) => ({ ...e.player, seed: i + 1 }));
}

/** Liste ordonnée des participants (SPEC §2) : classement glissant, base joueurs, puis nouveaux. */
export function orderParticipants(
  players: Player[],
  ranking: Record<string, number>,
  lastKnown: Record<string, { place: number; season: number }>,
): Player[] {
  const lookup = <T>(table: Record<string, T>, p: Player): T | undefined =>
    table[p.licence] ?? table[p.licence.toUpperCase()] ?? table[p.name];
  const entries = players.map((p, index) => {
    const glissant = lookup(ranking, p);
    const known = lookup(lastKnown, p);
    let place: number | null = null;
    let tier = 2;
    let lastSeason: number | null = p.lastSeason ?? null;
    if (glissant !== undefined) {
      place = glissant;
      tier = 0;
    } else if (known !== undefined) {
      place = known.place <= 8 ? 9 : known.place + 0.5;
      tier = 1;
    }
    if (known !== undefined) lastSeason = known.season;
    return { p, place, tier, lastSeason, index };
  });
  entries.sort((x, y) => {
    const px = x.place ?? Number.POSITIVE_INFINITY;
    const py = y.place ?? Number.POSITIVE_INFINITY;
    return px - py || x.tier - y.tier || x.p.seed - y.p.seed || x.index - y.index;
  });
  return entries.map((e, i) => ({ ...e.p, seed: i + 1, place: e.place, lastSeason: e.lastSeason }));
}
