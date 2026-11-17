/**
 * Fichiers JSON d'un tournoi pour l'import dans le système fédéral e2i.
 *
 * En attendant des API de lecture et d'écriture avec e2i, le responsable national y saisit les
 * TN en important quatre fichiers, produits jusqu'ici par l'outil Excel : `e2i_qualif.json`
 * (poules et barrages du vendredi), `e2i_national.json`, `e2i_masters.json` et
 * `e2i_consolante.json`. Le format reproduit ici est celui des fichiers réels du TN 2 2026-2027
 * (Ronchin) transmis le 17 novembre 2026, copiés dans `test/fixtures/e2i/` : le test du rejeu
 * complet vérifie que les quatre fichiers générés leur sont identiques.
 *
 * Structure : `{ phases: [{ nom, début, fin, numéro, classement, poules: [{ nom, date, club,
 * lieu, NS, DS, matchs: [{ date, "directeur de jeu", arbitre1, arbitre2, format, prolongation,
 * commentaires, joueur1, joueur2 }] }] }] }`, un joueur étant `{ licence, abandon, "forfait
 * excusé", "forfait non excusé", sets }` avec les points de chaque set.
 *
 * Règles tirées des fichiers de référence :
 * - `NS` = sets gagnants, `DS` = points par set de la phase ;
 * - `club` = numéro fédéral du club hôte (entier), `lieu` = ville en majuscules ;
 * - dates `JJ/MM/AAAA` : vendredi pour les qualifications, samedi pour les poules National et
 *   Masters, les huitièmes National et toute la consolante, dimanche pour quarts, demies et
 *   finales ;
 * - phases à élimination directe du National et du Masters : une « poule » par match
 *   (« HUITIEME 1 », « QUART 2 », « DEMI 1 », « FINALE 1 ») ; barrages du vendredi : « BARRAGE
 *   n » ; consolante : une seule « poule » par tour, qui porte le nom du tour et tous ses matchs ;
 * - matchs d'une poule de 4 dans l'ordre fixe de la feuille de poule de l'outil Excel, par
 *   position des joueurs dans la poule : 2–3, 1–4, 3–4, 2–1, 2–4, 3–1 (poule de 3 : 2–3, 1–3,
 *   1–2). L'ordre et le sens d'un match ne changent rien pour e2i ; ils sont repris pour que
 *   les fichiers se comparent facilement à ceux de l'outil Excel ;
 * - `format` : « 3m10 » pour tout le Masters et pour la finale du National, « 2m80 » partout
 *   ailleurs. C'est la valeur de l'outil Excel, fixe par phase : elle ne suit pas le billard
 *   réellement utilisé (une poule du vendredi jouée sur un 3m10 y est notée « 2m80 »).
 *
 * Points à confirmer avec le responsable national (les fichiers de référence n'en contiennent
 * aucun exemple) :
 * - match gagné par forfait ou abandon de l'adversaire : le joueur absent est noté `abandon:
 *   "oui"` s'il a abandonné, `"forfait excusé": "oui"` s'il a déclaré forfait ;
 * - nom du tour de seizièmes de la consolante : « SEIZIEMES » ;
 * - un match sans score n'est pas exporté ; une phase sans match non plus.
 */
import type {
  BracketMatch,
  BracketRound,
  Distance,
  Match,
  Poule,
  TournamentState,
} from "./types.js";

import { BRACKET_ROUNDS, preliminaryRound } from "./phases.js";

export type E2iKind = "qualif" | "national" | "masters" | "consolante";

export const E2I_KINDS: readonly E2iKind[] = ["qualif", "national", "masters", "consolante"];

type OuiNon = "oui" | "non";

export interface E2iPlayer {
  licence: string;
  abandon: OuiNon;
  "forfait excusé": OuiNon;
  "forfait non excusé": OuiNon;
  sets: number[];
}

export interface E2iMatch {
  date: string;
  "directeur de jeu": string;
  arbitre1: string;
  arbitre2: string;
  format: "2m80" | "3m10";
  prolongation: OuiNon;
  commentaires: string;
  joueur1: E2iPlayer;
  joueur2: E2iPlayer;
}

export interface E2iPoule {
  nom: string;
  date: string;
  club: number;
  lieu: string;
  NS: number;
  DS: number;
  matchs: E2iMatch[];
}

export interface E2iPhase {
  nom: string;
  début: string;
  fin: string;
  numéro: number;
  classement: string;
  poules: E2iPoule[];
}

export interface E2iFile {
  phases: E2iPhase[];
}

/** Nom du fichier attendu pour une compétition : `e2i_qualif.json`… */
export function e2iFileName(kind: E2iKind): string {
  return `e2i_${kind}.json`;
}

/** Date `JJ/MM/AAAA` du jour `offset` du tournoi (0 = vendredi) à partir de son premier jour. */
function dayOf(start: string, offset: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + offset));
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Ville en majuscules sans accents, comme dans les fichiers fédéraux. */
function place(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

const played = (m: Match): boolean => m.sa !== null && m.sb !== null;

interface Context {
  licence: (name: string) => string;
  /** Joueurs ayant abandonné (les autres absents ont déclaré forfait). */
  abandons: Set<string>;
  club: number;
  lieu: string;
}

function matchOf(
  m: Match,
  date: string,
  format: E2iMatch["format"],
  ctx: Context,
): E2iMatch {
  const side = (name: string, score: number | null, sets: number[] | undefined, out: boolean) => {
    const player: E2iPlayer = {
      licence: ctx.licence(name),
      abandon: out && ctx.abandons.has(name) ? "oui" : "non",
      "forfait excusé": out && !ctx.abandons.has(name) ? "oui" : "non",
      "forfait non excusé": "non",
      // Match en plusieurs sets : les points de chaque set ; sinon le score est celui du set.
      sets: sets && sets.length > 0 ? [...sets] : [score ?? 0],
    };
    return player;
  };
  return {
    date,
    "directeur de jeu": "",
    arbitre1: m.arbitre ?? "",
    arbitre2: m.arbitre2 ?? "",
    format,
    prolongation: "non",
    commentaires: "",
    joueur1: side(m.a, m.sa, m.setsA, m.forfait === "a"),
    joueur2: side(m.b, m.sb, m.setsB, m.forfait === "b"),
  };
}

/** Une « poule » e2i : en-tête commun et matchs joués (null s'il n'y en a aucun). */
function pouleOf(
  nom: string,
  matches: Match[],
  date: string,
  distance: Distance,
  format: E2iMatch["format"],
  ctx: Context,
): E2iPoule | null {
  const matchs = matches.filter(played).map((m) => matchOf(m, date, format, ctx));
  if (matchs.length === 0) return null;
  return {
    nom,
    date,
    club: ctx.club,
    lieu: ctx.lieu,
    NS: distance.setsGagnants,
    DS: distance.pointsParSet,
    matchs,
  };
}

/** Assemble les phases non vides et les numérote dans l'ordre. */
function fileOf(
  phases: { nom: string; date: string; poules: (E2iPoule | null)[] }[],
): E2iFile | null {
  const kept = phases
    .map((p) => ({ ...p, poules: p.poules.filter((x): x is E2iPoule => x !== null) }))
    .filter((p) => p.poules.length > 0);
  if (kept.length === 0) return null;
  return {
    phases: kept.map((p, i) => ({
      nom: p.nom,
      début: p.date,
      fin: p.date,
      numéro: i + 1,
      classement: "poules homogènes",
      poules: p.poules,
    })),
  };
}

/** Ordre et sens des matchs d'une poule dans les fichiers de l'outil Excel (positions 1 à 4). */
const POULE_LAYOUT: Record<number, [number, number][]> = {
  4: [
    [2, 3],
    [1, 4],
    [3, 4],
    [2, 1],
    [2, 4],
    [3, 1],
  ],
  3: [
    [2, 3],
    [1, 3],
    [1, 2],
  ],
};

/** Matchs d'une poule, rangés et orientés comme dans la feuille de poule de référence. */
function pouleLayout(poule: Poule): Match[] {
  const layout = POULE_LAYOUT[poule.players.length];
  if (!layout) return poule.matches;
  const out: Match[] = [];
  const used = new Set<Match>();
  for (const [i, j] of layout) {
    const a = poule.players[i - 1];
    const b = poule.players[j - 1];
    const m = poule.matches.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!m || used.has(m)) continue;
    used.add(m);
    out.push(m.a === a ? m : flip(m));
  }
  // Un match hors gabarit (poule réduite par un abandon…) est gardé, à la suite
  return [...out, ...poule.matches.filter((m) => !used.has(m))];
}

/** Le même match vu de l'autre côté (joueur 1 et joueur 2 échangés). */
function flip(m: Match): Match {
  const out: Match = { ...m, a: m.b, b: m.a, sa: m.sb, sb: m.sa };
  if (m.setsA || m.setsB) {
    out.setsA = m.setsB ?? [];
    out.setsB = m.setsA ?? [];
  }
  if (m.forfait) out.forfait = m.forfait === "a" ? "b" : "a";
  return out;
}

const bySlot = (matches: BracketMatch[], round: BracketRound): BracketMatch[] =>
  matches.filter((m) => m.round === round).sort((x, y) => x.slot - y.slot);

/** Tours du National et du Masters : nom de la phase et nom d'une « poule » d'un match. */
const KO_PHASES: { round: BracketRound; phase: string; poule: string }[] = [
  { round: "R16", phase: "HUITIEMES DE FINALE", poule: "HUITIEME" },
  { round: "QF", phase: "QUARTS DE FINALE", poule: "QUART" },
  { round: "SF", phase: "DEMIES", poule: "DEMI" },
  { round: "F", phase: "FINALE", poule: "FINALE" },
];

/** Tours de la consolante : nom de la phase, repris par son unique « poule ». */
const CLS_ROUNDS: Record<BracketRound, string> = {
  R64: "TRENTE-DEUXIEMES",
  R32: "SEIZIEMES",
  R16: "HUITIEMES",
  QF: "QUARTS",
  SF: "DEMIES",
  F: "FINALE",
};

/**
 * Les fichiers e2i d'un tournoi. `clubNumber` est le numéro fédéral du club hôte. Une
 * compétition sans aucun match joué (pas de consolante, par exemple) n'a pas de fichier.
 */
export function e2iExports(
  state: TournamentState,
  options: { clubNumber: number | string },
): Partial<Record<E2iKind, E2iFile>> {
  const start = state.info?.dates[0] ?? "";
  const friday = dayOf(start, 0);
  const saturday = dayOf(start, 1);
  const sunday = dayOf(start, 2);
  const licences = new Map(state.players.map((p) => [p.name, p.licence]));
  const ctx: Context = {
    licence: (name) => licences.get(name) ?? "",
    abandons: new Set(state.forfaits.filter((f) => f.kind === "abandon").map((f) => f.player)),
    club: Number(options.clubNumber) || 0,
    lieu: place(state.info?.city ?? ""),
  };
  const d = state.rules.distances;

  const koPhases = (
    matches: BracketMatch[],
    format: (round: BracketRound) => E2iMatch["format"],
  ) =>
    KO_PHASES.map(({ round, phase, poule }) => {
      const date = round === "R16" ? saturday : sunday;
      const distance = round === "R16" ? d.huitiemes : d.final;
      return {
        nom: phase,
        date,
        poules: bySlot(matches, round).map((m, i) =>
          pouleOf(`${poule} ${i + 1}`, [m], date, distance, format(round), ctx),
        ),
      };
    });

  const qualif = fileOf([
    {
      nom: "POULES",
      date: friday,
      poules: state.poules.PREQ.map((p) =>
        pouleOf(`POULE ${p.num}`, pouleLayout(p), friday, d.preq, "2m80", ctx),
      ),
    },
    {
      nom: "BARRAGES",
      date: friday,
      poules: state.barrages.map((m, i) =>
        pouleOf(`BARRAGE ${i + 1}`, [m], friday, d.barrage, "2m80", ctx),
      ),
    },
  ]);

  const national = fileOf([
    {
      nom: "POULES",
      date: saturday,
      poules: state.poules.QN.map((p) =>
        pouleOf(`POULE ${p.num}`, pouleLayout(p), saturday, d.qn, "2m80", ctx),
      ),
    },
    ...koPhases(state.brackets.N, (round) => (round === "F" ? "3m10" : "2m80")),
  ]);

  const masters = fileOf([
    {
      nom: "POULES",
      date: saturday,
      poules: state.poules.QM.map((p) =>
        pouleOf(`POULE ${p.num}`, pouleLayout(p), saturday, d.qm, "3m10", ctx),
      ),
    },
    ...koPhases(state.brackets.M, () => "3m10"),
  ]);

  const barrageRound = preliminaryRound(state.brackets.CLS);
  const consolante = fileOf(
    BRACKET_ROUNDS.map((round) => {
      const nom = round === barrageRound ? "BARRAGES" : CLS_ROUNDS[round];
      return {
        nom,
        date: saturday,
        poules: [pouleOf(nom, bySlot(state.brackets.CLS, round), saturday, d.cls, "2m80", ctx)],
      };
    }),
  );

  const out: Partial<Record<E2iKind, E2iFile>> = {};
  if (qualif) out.qualif = qualif;
  if (national) out.national = national;
  if (masters) out.masters = masters;
  if (consolante) out.consolante = consolante;
  return out;
}

/** Texte d'un fichier e2i (JSON sur une ligne, UTF-8, comme les fichiers de l'outil Excel). */
export function e2iJson(file: E2iFile): string {
  return JSON.stringify(file);
}
