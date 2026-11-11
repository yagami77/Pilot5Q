/**
 * Données de démonstration : saison 2026-2027 (calendrier, clubs et base joueurs réels),
 * classement glissant reconstitué « avant TN 2 », inscrits du tournoi d'exemple.
 */
import type {
  HostClub,
  PlayerRecord,
  RankingEntry,
  Registration,
  Stage,
  TnResult,
} from "@pilot5q/domain";
import {
  DEFAULT_SEASON_SETTINGS,
  rankingRows,
  seasonStartYear,
  sundayOf,
  windowScore,
} from "@pilot5q/domain";

import seasonFixture from "@/data/season-exemple.json";
import { DEMO } from "@/lib/demo";
import { addDays } from "@/lib/format";

import type { SeasonDocument } from "./persistence";

interface SeasonFixture {
  season: string;
  clubs: HostClub[];
  calendar: {
    number: number;
    name: string;
    clubId: string;
    city: string;
    start: string;
    end: string;
    big: number;
    small: number;
  }[];
  players: (PlayerRecord & { posThis: number | null; posLast: number | null })[];
  windowBefore: RankingEntry[];
  expectedAfter: {
    position: number;
    licence: string;
    name: string;
    club: string;
    pts: number;
    moy: number;
    count: number;
    tn2: TnResult | null;
  }[];
  expectedAfterTitle: string;
}

export const SEASON_FIXTURE = seasonFixture as unknown as SeasonFixture;

export const stageId = (season: string, number: number) => `tn${number}-${season}`;

/** Étape de démonstration : inscriptions ouvertes 45 jours avant, closes 12 jours avant. */
function demoStage(season: string, c: SeasonFixture["calendar"][number]): Stage {
  return {
    id: stageId(season, c.number),
    season,
    number: c.number,
    kind: "TN",
    name: c.name,
    clubId: c.clubId,
    city: c.city,
    start: c.start,
    end: sundayOf(c.start),
    registrationOpen: `${addDays(c.start, -45)}T00:00`,
    registrationClose: `${addDays(c.start, -12)}T23:59`,
    registrationUrl: `https://inscriptions.exemple.fr/5-quilles/${season}/tn${c.number}`,
    big: c.big,
    small: c.small,
    djLicence: null,
    tournamentId: null,
    openedAt: null,
    closedAt: null,
  };
}

/** Classement connu à l'inscription au TN 2 (classeur de référence). */
export interface DemoInscription {
  name: string;
  order: number;
  currentPlace: number | null;
  lastPlace: number | null;
  lastSeason: string | null;
}

/**
 * Base joueurs « avant TN 2 » : pour les 76 inscrits, classement en cours et dernier classement
 * tels que connus à l'inscription (classeur de référence) ; pour les autres, place dans la
 * fenêtre reconstituée (le TN 2 2025-2026, sorti de la fenêtre, n'est pas dans le classeur).
 */
function demoPlayers(
  season: string,
  ranking: RankingEntry[],
  inscriptions: DemoInscription[],
): PlayerRecord[] {
  const official = new Map(inscriptions.map((i) => [i.name, i]));
  const rows = rankingRows(ranking);
  const position = new Map(rows.map((r) => [r.licence || r.name, r.position]));
  const playedThisSeason = new Set(
    ranking
      .filter((e) => e.results.some((r) => r.season === season))
      .map((e) => e.licence || e.name),
  );
  const previous = `${seasonStartYear(season) - 1}-${seasonStartYear(season)}`;
  return SEASON_FIXTURE.players.map((p) => {
    const key = p.licence || p.name;
    const known = official.get(p.name);
    if (known) {
      return {
        licence: p.licence,
        name: p.name,
        club: p.club,
        lastSeason: known.lastSeason,
        currentPlace: known.currentPlace,
        lastPlace: known.lastPlace,
      };
    }
    const current = position.get(key) ?? null;
    const lastSeason =
      p.lastSeason === season && !playedThisSeason.has(key) ? previous : p.lastSeason;
    return {
      licence: p.licence,
      name: p.name,
      club: p.club,
      lastSeason,
      currentPlace: current,
      lastPlace: current ?? p.lastPlace,
    };
  });
}

/** Inscrits du tournoi d'exemple, dans l'ordre d'inscription du site fédéral. */
export function demoRegistrations(order: DemoInscription[]): Registration[] {
  const byName = new Map(DEMO.players.map((p) => [p.name, p]));
  const start = DEMO.tournament.dates[0];
  const out: Registration[] = [];
  for (const o of order) {
    const p = byName.get(o.name);
    if (!p) continue;
    const day = addDays(start, -40 + Math.floor(o.order / 3));
    const hh = String(8 + (o.order % 12)).padStart(2, "0");
    const mm = String((o.order * 7) % 60).padStart(2, "0");
    out.push({
      licence: p.licence,
      name: p.name,
      club: p.club,
      email: "",
      order: o.order,
      registeredAt: `${day}T${hh}:${mm}`,
      junior: false,
      forfait: false,
    });
  }
  return out;
}

/** Barème d'un TN de 76 joueurs (points de base par place, du vainqueur au dernier). */
const DEMO_BAREME = [
  80, 54, 38, 38, 26, 26, 26, 26, 25, 18, 18, 18, 18, 17, 13, 13, 13, 13, 11, 11, 9, 9, 9, 9, 7, 7,
  7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];

/** Générateur pseudo-aléatoire déterministe (mulberry32) : la démonstration est reproductible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** TN qui sort de la fenêtre à la clôture du TN 2 2026-2027. */
export const DEMO_LEFT_STAGE = { season: "2025-2026", tn: 2 } as const;

/** Décimales possibles d'un résultat simulé (points de set / matchs / 100), au millième. */
const DEMO_DECIMALS = Array.from({ length: 35 }, (_, i) => i / 1000);
/** Écart minimal entre un score simulé et le score qu'il doit dépasser. */
const DEMO_MARGIN = 1e-6;
/** Nombre de joueurs absents de la fenêtre du classeur qui n'ont joué que le TN simulé. */
const DEMO_EXTRA = 8;
/** Plus petite décimale d'un joueur qui a marqué des points de set. */
const DEMO_DECIMAL_MIN = 0.004;
/** Paliers du bas du barème : leur nombre dépend de la taille du TN, ils ne sont pas plafonnés. */
const DEMO_OPEN_VALUES = 5;
/** Un TN accueille au plus 100 joueurs (SPEC §2). */
const DEMO_MAX_FIELD = 100;

/** Joueur placé dans l'ordre visé : son score et, s'il y a lieu, ses points simulés. */
interface DemoSeat {
  entry: RankingEntry;
  score: number;
  /** Points simulés du TN sorti (null : il ne l'a pas joué). */
  simulated: number | null;
  /** Palier du barème correspondant. */
  value: number;
}

/**
 * Démonstration : résultats simulés du TN 2 2025-2026, le TN qui sort de la fenêtre à la
 * clôture du TN 2 2026-2027. Le classeur de référence ne le contient pas (sa fenêtre commence au
 * TN 3 2025-2026) : ses vrais points sont inconnus ici.
 *
 * La simulation est contrainte par ce qui est connu : la place de chaque inscrit du TN 2 au
 * moment de son inscription (`inscriptions`, classeur de référence). Les points simulés, pris
 * dans le barème d'un TN, sont les plus petits qui rendent exactement ces places au classement
 * « avant TN 2 » ; les joueurs dont la place n'est pas connue occupent les places restantes
 * dans l'ordre que donnent les quatre TN du classeur. Un inscrit sans classement à
 * l'inscription ne reçoit aucun point. Ces points ne comptent plus après la clôture du TN 2.
 */
export function withDemoLeftStage(
  ranking: RankingEntry[],
  players: PlayerRecord[],
  season: string,
  inscriptions: DemoInscription[] = [],
): RankingEntry[] {
  const rnd = seeded(20252);
  const keyOf = (e: { licence: string; name: string }): string => e.licence || e.name;
  const inWindow = new Set(ranking.map(keyOf));
  const registered = new Set(inscriptions.map((i) => i.name));
  const knownPlace = new Map<string, number>();
  for (const i of inscriptions) if (i.currentPlace !== null) knownPlace.set(i.name, i.currentPlace);
  const previous = `${seasonStartYear(season) - 1}-${seasonStartYear(season)}`;
  const maxPlace = Math.max(0, ...knownPlace.values());
  // Quelques joueurs vus la saison passée mais absents de la fenêtre : ils n'ont joué que ce TN
  // (il en faut assez pour que la dernière place connue existe). Jamais un inscrit du TN 2 : sans
  // classement à l'inscription, il n'a pas joué ce TN.
  const extra: RankingEntry[] = players
    .filter((p) => p.lastSeason === previous && !inWindow.has(keyOf(p)) && !registered.has(p.name))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .slice(0, Math.max(DEMO_EXTRA, maxPlace - ranking.length))
    .map((p) => ({ licence: p.licence, name: p.name, club: p.club, results: [] }));
  const out: RankingEntry[] = [
    ...ranking.map((e) => ({ ...e, results: [...e.results] })),
    ...extra,
  ];

  // Barème à distribuer (un TN de 76 joueurs).
  const stock = new Map<number, number>();
  for (const v of DEMO_BAREME) stock.set(v, (stock.get(v) ?? 0) + 1);
  const ascending = [...stock.keys()].sort((a, b) => a - b);
  const inStock = (v: number): boolean => v <= DEMO_OPEN_VALUES || (stock.get(v) ?? 0) > 0;
  const scoreWith = (e: RankingEntry, pts: number): number =>
    windowScore([
      { season: DEMO_LEFT_STAGE.season, tn: DEMO_LEFT_STAGE.tn, pts, faits: 0, subis: 0 },
      ...e.results,
    ]).pts;
  const natural = (e: RankingEntry): DemoSeat => ({
    entry: e,
    score: windowScore(e.results).pts,
    simulated: null,
    value: 0,
  });
  /** `seat` passe-t-il devant `lower` au classement (points, puis moyenne, puis nom) ? */
  const ranksAbove = (seat: DemoSeat, lower: DemoSeat | null): boolean => {
    if (!lower) return true;
    if (seat.simulated !== null || lower.simulated !== null)
      return seat.score > lower.score + DEMO_MARGIN;
    if (seat.score !== lower.score) return seat.score > lower.score;
    const a = windowScore(seat.entry.results).moy;
    const b = windowScore(lower.entry.results).moy;
    return a !== b ? a > b : seat.entry.name.localeCompare(lower.entry.name, "fr") < 0;
  };
  /** Place la moins chère de `e` au-dessus de `lower` : sans point simulé si possible. */
  const cheapest = (e: RankingEntry, lower: DemoSeat | null): DemoSeat | null => {
    const plain = natural(e);
    if (e.results.length > 0 && ranksAbove(plain, lower)) return plain;
    for (const available of [true, false]) {
      for (const v of ascending) {
        if (available && !inStock(v)) continue;
        for (const d of DEMO_DECIMALS) {
          // Une décimale nulle (aucun point de set) ne va qu'avec les tout derniers paliers.
          if (d < DEMO_DECIMAL_MIN && v > 2) continue;
          const seat: DemoSeat = {
            entry: e,
            score: scoreWith(e, v + d),
            simulated: v + d,
            value: v,
          };
          if (ranksAbove(seat, lower)) return seat;
        }
      }
    }
    return null;
  };

  // 1) Du dernier au premier. Une place connue à l'inscription est imposée : son joueur doit
  //    dépasser celui qui le suit, au besoin avec le plus petit palier du barème qui suffit.
  //    Une place libre va au joueur restant qui peut l'occuper avec le score le plus bas.
  const fixed = new Map<number, RankingEntry>();
  const pool: RankingEntry[] = [];
  for (const e of out) {
    const place = knownPlace.get(e.name);
    if (place !== undefined && place <= out.length && !fixed.has(place)) fixed.set(place, e);
    else pool.push(e);
  }
  const seats: DemoSeat[] = [];
  let lower: DemoSeat | null = null;
  for (let place = out.length; place >= 1; place--) {
    const known = fixed.get(place);
    let seat: DemoSeat | null = null;
    if (known) seat = cheapest(known, lower) ?? natural(known);
    else {
      for (const e of pool) {
        const c = cheapest(e, lower);
        if (!c) continue;
        const better =
          !seat ||
          c.score < seat.score ||
          (c.score === seat.score && c.simulated === null && seat.simulated === null
            ? ranksAbove(seat, c)
            : c.score === seat.score && c.simulated === null);
        if (better) seat = c;
      }
      if (!seat) break;
      pool.splice(pool.indexOf(seat.entry), 1);
    }
    if (seat.simulated !== null) stock.set(seat.value, (stock.get(seat.value) ?? 0) - 1);
    seats.unshift(seat);
    lower = seat;
  }

  // 2) Du premier au dernier : les places de tableau restantes (vainqueur, finaliste, quarts…)
  //    vont aux joueurs qui peuvent les recevoir sans changer l'ordre (résultat non compté d'un
  //    joueur à 5 TN, ou écart suffisant avec le joueur qui précède), pour que le TN simulé ait
  //    l'allure d'un tournoi complet.
  const descending = [...ascending].reverse().filter((v) => v > DEMO_OPEN_VALUES);
  let field = seats.filter((s) => s.simulated !== null).length;
  seats.forEach((seat, i) => {
    const above = seats[i - 1];
    const below = seats[i + 1];
    if (seat.simulated !== null || field >= DEMO_MAX_FIELD) return;
    // Un ex æquo départagé à la moyenne ne reçoit rien : ses points faits et subis changeraient.
    if (above?.score === seat.score || below?.score === seat.score) return;
    const d = DEMO_DECIMALS[4 + Math.floor(rnd() * 30)] ?? DEMO_DECIMAL_MIN;
    for (const v of descending) {
      if ((stock.get(v) ?? 0) <= 0) continue;
      const score = scoreWith(seat.entry, v + d);
      if (above && score > above.score - DEMO_MARGIN) continue;
      seat.score = score;
      seat.simulated = v + d;
      seat.value = v;
      stock.set(v, (stock.get(v) ?? 0) - 1);
      field++;
      break;
    }
  });

  for (const seat of seats) {
    if (seat.simulated === null) continue;
    const faits = Math.round(260 + seat.value * 9 + rnd() * 220);
    const subis = Math.round(faits / (0.85 + rnd() * 0.55));
    const result: TnResult = {
      season: DEMO_LEFT_STAGE.season,
      tn: DEMO_LEFT_STAGE.tn,
      pts: seat.simulated,
      faits,
      subis,
    };
    seat.entry.results = [result, ...seat.entry.results];
  }
  return out;
}

/** Document de démonstration complet. */
export function demoSeason(registrationOrder: DemoInscription[]): SeasonDocument {
  const season = SEASON_FIXTURE.season;
  const ranking = withDemoLeftStage(
    SEASON_FIXTURE.windowBefore.map((e) => ({ ...e, results: [...e.results] })),
    SEASON_FIXTURE.players,
    season,
    registrationOrder,
  );
  const stages = SEASON_FIXTURE.calendar.map((c) => demoStage(season, c));
  const now = new Date().toISOString();
  // Le TN 1 figure déjà dans la fenêtre : il est clôturé.
  const tn1 = stages.find((s) => s.number === 1);
  if (tn1) tn1.closedAt = `${tn1.end}T20:00`;
  const tn2 = stages.find((s) => s.number === 2);
  const registrations = demoRegistrations(registrationOrder);
  return {
    id: season,
    settings: { ...DEFAULT_SEASON_SETTINGS },
    clubs: SEASON_FIXTURE.clubs.map((c) => ({ ...c })),
    stages,
    players: demoPlayers(season, ranking, registrationOrder),
    ranking,
    registrations: tn2
      ? {
          [tn2.id]: {
            stageId: tn2.id,
            importedAt: now,
            fileName: "inscriptions-tn2-exemple.csv",
            registrations,
            manualWaitlist: true,
          },
        }
      : {},
    closures: {},
    juniors: DEMO.players.filter((p) => p.junior).map((p) => p.licence),
    updatedAt: now,
  };
}

/** Saison vide. */
export function emptySeason(season: string): SeasonDocument {
  return {
    id: season,
    settings: { ...DEFAULT_SEASON_SETTINGS },
    clubs: [],
    stages: [1, 2, 3, 4, 5].map((n) => ({
      id: stageId(season, n),
      season,
      number: n,
      kind: "TN",
      name: `TN ${n}`,
      clubId: null,
      city: "",
      start: "",
      end: "",
      registrationOpen: null,
      registrationClose: null,
      registrationUrl: "",
      big: 0,
      small: 0,
      djLicence: null,
      tournamentId: null,
      openedAt: null,
      closedAt: null,
    })),
    players: [],
    ranking: [],
    registrations: {},
    closures: {},
    juniors: [],
    updatedAt: new Date().toISOString(),
  };
}
