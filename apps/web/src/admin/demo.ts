/**
 * Données de démonstration : saison 2026-2027 (calendrier réel, clubs et joueurs fictifs),
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
import { DEFAULT_SEASON_SETTINGS, rankingRows, seasonStartYear, sundayOf } from "@pilot5q/domain";

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

/** Document de démonstration complet. */
export function demoSeason(registrationOrder: DemoInscription[]): SeasonDocument {
  const season = SEASON_FIXTURE.season;
  const ranking = SEASON_FIXTURE.windowBefore.map((e) => ({ ...e, results: [...e.results] }));
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
