/**
 * Classements des phases finales, classement final du tournoi et primes (SPEC §6, §7).
 *
 * Règles implémentées (confrontées aux formules RNK_N, RNK_M, RNK_CLS, RNK_TOT et à l'onglet
 * PRIMES de l'outil Excel de référence) :
 * - Classement d'une phase finale (`rankTournamentPhase`) : les joueurs du tableau sont classés
 *   par le dernier tour gagné (finale = vainqueur, demie = finaliste, quart = demi-finaliste…,
 *   aucun match gagné = éliminé d'entrée, que ce soit en huitième ou en barrage/seizième), puis
 *   Pm, Ps et moyenne cumulés sur les poules de qualification et le tableau, puis ordre
 *   d'arrivée. Les joueurs non qualifiés pour le tableau suivent, dans l'ordre du classement de
 *   qualification. Pour la consolante (sans poules), seuls les joueurs du tableau sont classés :
 *   un vainqueur de barrage éliminé en huitième devance ainsi un joueur entré directement et
 *   éliminé en huitième, et les joueurs sans victoire sont départagés à la moyenne quel que soit
 *   le tour de leur élimination (formules RNK_N, RNK_M et RNK_CLS de l'outil Excel).
 * - Classement final du tournoi (`tournamentRanking`, SPEC §7) : points du barème selon la place
 *   dans le classement Masters (80, 54, 38 ×2, 26 ×4, 18 ×4, 13 ×4) ou National (25, 17, 11 ×2,
 *   9 ×4, 7 ×8, 5 ×8 pour les 3es de poule, 4 ×8 pour les 4es) ; pour les autres joueurs :
 *   vainqueur de la consolante 3, sinon selon le rang dans la poule du vendredi (2e → 2, 3e → 2,
 *   4e → 1). Départage par la décimale = points de set / matchs joués / 100, cumulés sur les
 *   poules du vendredi (sans la compensation « poule de 3 »), le barrage, les poules du samedi et
 *   le tableau (hors consolante), puis par la moyenne cumulée, puis par l'ordre d'arrivée. Un
 *   joueur forfait ou ayant abandonné (hors consolante) est classé dernier avec 0 point.
 * - Primes (`primesTable`, SPEC §6) : cagnotte = droit d'inscription × joueurs non juniors +
 *   dotation FFB + dotation club ; Masters 80 % (1er 20, 2e 12, demies 8 ×2, quarts 4 ×4, 3es et
 *   4es de poule 2 ×8), National 20 % (1er 8, 2e 4, demies 2 ×2, quarts 1 ×4). Les bénéficiaires
 *   sont lus dans les classements des phases finales.
 */
import { matchOutcome, setPoints } from "./scoring.js";
import type {
  BracketLevel,
  BracketMatch,
  BracketRound,
  Distance,
  PhaseRankRow,
  PlayerTotals,
  PrimeRow,
  PrimesTable,
  TournamentPhaseRow,
  TournamentRankRow,
} from "./types.js";

/** Niveau numérique d'un tour (plus grand = plus loin dans le tableau). */
const LEVEL: Record<BracketLevel, number> = { R64: 1, R32: 2, R16: 3, QF: 4, SF: 5, F: 6, W: 7 };

/** Niveau du dernier tour gagné (0 : aucun match gagné). */
function wonLevel(r: TournamentPhaseRow): number {
  return r.won === null ? 0 : LEVEL[r.won];
}

/** Libellé français d'un tour atteint. */
export function bracketLevelLabel(level: BracketLevel | null): string {
  switch (level) {
    case "W":
      return "Gagnant";
    case "F":
      return "Finale";
    case "SF":
      return "1/2 finale";
    case "QF":
      return "1/4 finale";
    case "R16":
      return "1/8 finale";
    case "R32":
      return "1/16 finale";
    case "R64":
      return "1/32 finale";
    default:
      return "";
  }
}

/** Ligne vierge pour un joueur du tableau sans poule de qualification (consolante). */
function emptyRow(name: string, arrivee: number): PhaseRankRow {
  return {
    name,
    rang: null,
    ptm: 0,
    pts: 0,
    faits: 0,
    subis: 0,
    moy: 0,
    joues: 0,
    arrivee,
    poule: 0,
    place: 0,
  };
}

/**
 * Classement d'une phase finale : joueurs du tableau (tour atteint, puis Pm, Ps, moyenne cumulés
 * avec la qualification, puis ordre d'arrivée), puis les non-qualifiés dans l'ordre de `qualif`.
 */
export function rankTournamentPhase(
  qualif: PhaseRankRow[],
  bracket: BracketMatch[],
  distanceOf: (round: BracketRound) => Distance,
  arrivee?: Record<string, number>,
): TournamentPhaseRow[] {
  const rows = new Map<string, TournamentPhaseRow>();
  const order: string[] = [];
  const row = (name: string): TournamentPhaseRow => {
    let r = rows.get(name);
    if (!r) {
      const base = qualif.find((q) => q.name === name);
      const fallback = arrivee?.[name] ?? order.length + 1;
      r = {
        ...(base ?? emptyRow(name, fallback)),
        reached: null,
        won: null,
        label: "",
      };
      rows.set(name, r);
      order.push(name);
    }
    return r;
  };
  const reach = (r: TournamentPhaseRow, level: BracketLevel): void => {
    if (r.reached === null || LEVEL[level] > LEVEL[r.reached]) r.reached = level;
  };
  const win = (r: TournamentPhaseRow, round: BracketRound): void => {
    if (r.won === null || LEVEL[round] > LEVEL[r.won]) r.won = round;
  };
  for (const m of bracket) {
    if (m.a === "" || m.b === "" || m.a === m.b) continue;
    const ra = row(m.a);
    const rb = row(m.b);
    reach(ra, m.round);
    reach(rb, m.round);
    const outcome = matchOutcome(m, distanceOf(m.round));
    if (!outcome) continue;
    const w = row(outcome.winner);
    const l = row(outcome.loser);
    const [psW, psL] = setPoints(outcome, distanceOf(m.round));
    w.ptm += 2;
    w.pts += psW;
    w.faits += outcome.pointsWinner;
    w.subis += outcome.pointsLoser;
    w.joues += 1;
    l.pts += psL;
    l.faits += outcome.pointsLoser;
    l.subis += outcome.pointsWinner;
    l.joues += 1;
    win(w, m.round);
    if (m.round === "F") reach(w, "W");
  }
  const inBracket = order.map(row);
  for (const r of inBracket) {
    r.moy = r.subis > 0 ? r.faits / r.subis : r.faits;
    r.label = bracketLevelLabel(r.reached);
  }
  inBracket.sort(
    (x, y) =>
      wonLevel(y) - wonLevel(x) ||
      y.ptm - x.ptm ||
      y.pts - x.pts ||
      y.moy - x.moy ||
      x.arrivee - y.arrivee,
  );
  const rest: TournamentPhaseRow[] = qualif
    .filter((q) => !rows.has(q.name))
    .map((q) => ({ ...q, reached: null, won: null, label: "" }));
  return [...inBracket, ...rest].map((r, i) => ({ ...r, place: i + 1 }));
}

/** Barème Masters (SPEC §7), par place dans le classement de la phase finale. */
export const MASTERS_POINTS: readonly number[] = [
  80, 54, 38, 38, 26, 26, 26, 26, 18, 18, 18, 18, 13, 13, 13, 13,
];

/** Barème National (SPEC §7) : 1er, 2e, demies, quarts, huitièmes, 3es de poule, 4es de poule. */
export const NATIONAL_POINTS: readonly number[] = [
  25, 17, 11, 11, 9, 9, 9, 9, 7, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4,
  4,
];

/** Points du vainqueur de la consolante (outil Excel ; SPEC §7 : « à confirmer »). */
export const CONSOLANTE_WINNER_POINTS = 3;

/** Points d'un joueur non qualifié selon son rang dans la poule du vendredi (outil Excel). */
export function preqPoints(rang: number | null): number {
  if (rang === null || rang <= 0) return 0;
  return rang === 2 ? 2 : Math.max(0, 4 - rang + 1);
}

/** Données du classement final du tournoi. */
export interface TournamentRankingInput {
  /** Classement de la phase finale Masters (16 joueurs). */
  masters: TournamentPhaseRow[];
  /** Classement de la phase finale National (32 joueurs). */
  national: TournamentPhaseRow[];
  /** Classement de la consolante (joueurs du tableau). */
  consolante: TournamentPhaseRow[];
  /** Classement de phase du vendredi (toutes places). */
  preq: PhaseRankRow[];
  /** Préqualifiés Masters absents du classement du vendredi. */
  prequalified: string[];
  /** Cumuls par joueur (vendredi, barrage, samedi, tableau ; hors consolante). */
  totals: Record<string, PlayerTotals>;
  /** Joueurs forfait ou ayant abandonné (hors consolante) : classés derniers avec 0 point. */
  abandons: string[];
  /** Ordre d'arrivée (place dans la liste ordonnée). */
  arrivee: Record<string, number>;
}

/** Classement final du tournoi (SPEC §7). */
export function tournamentRanking(input: TournamentRankingInput): TournamentRankRow[] {
  const abandons = new Set(input.abandons);
  const rows = new Map<string, TournamentRankRow>();
  const add = (name: string, points: number, origin: TournamentRankRow["origin"]): void => {
    if (rows.has(name)) return;
    const t = input.totals[name] ?? { ptm: 0, pts: 0, faits: 0, subis: 0, joues: 0 };
    const abandon = abandons.has(name);
    rows.set(name, {
      place: 0,
      name,
      origin,
      points: abandon ? 0 : points,
      decimal: abandon || t.joues === 0 ? 0 : t.pts / t.joues / 100,
      ptm: t.ptm,
      pts: t.pts,
      faits: t.faits,
      subis: t.subis,
      moy: t.subis > 0 ? t.faits / t.subis : t.faits,
      joues: t.joues,
      arrivee: input.arrivee[name] ?? Number.POSITIVE_INFINITY,
      abandon,
    });
  };
  input.masters.forEach((r, i) => add(r.name, MASTERS_POINTS[i] ?? 0, "M"));
  input.national.forEach((r, i) => add(r.name, NATIONAL_POINTS[i] ?? 0, "N"));
  const winner = input.consolante.find((r) => r.reached === "W");
  if (winner) add(winner.name, CONSOLANTE_WINNER_POINTS, "CLS");
  for (const r of input.preq) add(r.name, preqPoints(r.rang), "PREQ");
  for (const name of input.prequalified) add(name, 0, "M");
  const out = [...rows.values()];
  out.sort(
    (x, y) =>
      Number(x.abandon) - Number(y.abandon) ||
      y.points - x.points ||
      y.decimal - x.decimal ||
      y.moy - x.moy ||
      x.arrivee - y.arrivee,
  );
  return out.map((r, i) => ({ ...r, place: i + 1 }));
}

/** Répartition des primes (SPEC §6). */
const MASTERS_PRIMES: readonly { label: string; pct: number; from: number; to: number }[] = [
  { label: "1er", pct: 0.2, from: 0, to: 1 },
  { label: "2e", pct: 0.12, from: 1, to: 2 },
  { label: "Perdants demies", pct: 0.08, from: 2, to: 4 },
  { label: "Perdants quarts", pct: 0.04, from: 4, to: 8 },
  { label: "3e et 4e de poule", pct: 0.02, from: 8, to: 16 },
];
const NATIONAL_PRIMES: readonly { label: string; pct: number; from: number; to: number }[] = [
  { label: "1er", pct: 0.08, from: 0, to: 1 },
  { label: "2e", pct: 0.04, from: 1, to: 2 },
  { label: "Perdants demies", pct: 0.02, from: 2, to: 4 },
  { label: "Perdants quarts", pct: 0.01, from: 4, to: 8 },
];

/** Arrondi au centime. */
function cents(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Tableau des primes (SPEC §6). Les noms viennent des classements des phases finales. */
export function primesTable(
  players: number,
  juniors: number,
  inscriptionFee: number,
  masters: TournamentPhaseRow[],
  national: TournamentPhaseRow[],
  dotations: { ffb: number; club: number } = { ffb: 450, club: 200 },
): PrimesTable {
  const inscriptions = Math.max(0, players - juniors) * inscriptionFee;
  const total = inscriptions + dotations.ffb + dotations.club;
  const rowsOf = (
    spec: readonly { label: string; pct: number; from: number; to: number }[],
    ranking: TournamentPhaseRow[],
  ): PrimeRow[] => {
    const out: PrimeRow[] = [];
    for (const s of spec) {
      for (let i = s.from; i < s.to; i++) {
        out.push({
          label: s.label,
          pct: s.pct,
          amount: cents(total * s.pct),
          name: ranking[i]?.name ?? "",
        });
      }
    }
    return out;
  };
  return {
    players,
    juniors,
    inscriptions,
    ffb: dotations.ffb,
    club: dotations.club,
    total,
    masters: rowsOf(MASTERS_PRIMES, masters),
    national: rowsOf(NATIONAL_PRIMES, national),
  };
}
