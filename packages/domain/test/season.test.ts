/**
 * Espace du responsable national : barème, classement glissant, base joueurs, inscriptions.
 *
 * Validation sur données réelles pseudonymisées (fixture season-exemple.json, issue du classeur
 * de référence du TN 2 2026-2027) : les points attribués à chaque joueur et le classement
 * glissant « APRES TN2 2026-2027 » doivent être reproduits exactement à partir du classement
 * reconstitué « avant » (fenêtre TN3..TN5 2025-2026 + TN1 2026-2027) et des résultats du tournoi.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEASON_SETTINGS,
  acceptRegistrations,
  applyTournament,
  awardPoints,
  basePoints,
  capacityFor,
  convocationTime,
  decimalPoints,
  hostCapable,
  lastKnownPlaces,
  rankingCsv,
  rankingRows,
  renderTemplate,
  searchPlayers,
  splitName,
  stageIndex,
  stageStatus,
  sundayOf,
  updatePlayerBase,
  windowScore,
  windowStages,
} from "../src/index.js";
import type {
  PlayerRecord,
  RankingEntry,
  Registration,
  Stage,
  TnResult,
  TournamentResult,
} from "../src/index.js";

interface SeasonFixture {
  season: string;
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
  tournamentResults: TournamentResult[];
  consolanteHeld: boolean;
  expectedPoints: { name: string; rank: number; pts: number; base: number; decimal: number }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(
  readFileSync(join(here, "fixtures", "season-exemple.json"), "utf8"),
) as SeasonFixture;

const identity = new Map(fx.expectedAfter.map((r) => [r.name, r]));
const results: TournamentResult[] = fx.tournamentResults.map((r) => {
  const id = identity.get(r.name);
  return { ...r, licence: id?.licence ?? "", club: id?.club ?? "" };
});

describe("barème réforme 2026-2027 (TN 2 2026-2027, 76 joueurs)", () => {
  const awards = awardPoints(results, fx.consolanteHeld);
  const byName = new Map(awards.map((a) => [a.name, a]));

  it("attribue les points du barème et la décimale de chaque joueur", () => {
    expect(awards).toHaveLength(76);
    for (const e of fx.expectedPoints) {
      const a = byName.get(e.name);
      expect(a, e.name).toBeDefined();
      if (!a) continue;
      const base = a.abandon ? 0 : a.points;
      expect(base, `${e.name} barème`).toBe(e.base === 1 && e.pts === 0 ? 0 : e.base);
      expect(a.decimal, `${e.name} décimale`).toBeCloseTo(e.decimal, 12);
      expect(a.points + a.decimal, `${e.name} total`).toBeCloseTo(e.pts, 12);
    }
  });

  it("classe le tournoi dans l'ordre de l'outil de référence (points, décimale, moyenne)", () => {
    const expected = [...fx.expectedPoints].sort((x, y) => x.rank - y.rank).map((e) => e.name);
    expect(awards.map((a) => a.name)).toEqual(expected);
  });

  it("retire les points d'un abandon hors consolante mais garde ses points faits/subis", () => {
    const abandon = awards.find((a) => a.abandon);
    expect(abandon).toBeDefined();
    expect(abandon?.points).toBe(0);
    expect(abandon?.decimal).toBe(0);
    expect(abandon?.faits).toBeGreaterThan(0);
    const cls = results.filter((r) => r.abandon === "CLS");
    expect(cls.length).toBeGreaterThan(0);
    for (const r of cls) expect(byName.get(r.name)?.abandon).toBe(false);
  });

  it("applique les paliers Masters, National et hors tableaux", () => {
    const r = (table: "M" | "N" | "CLS", rank: number, preq: number | null) =>
      basePoints(
        {
          name: "",
          table,
          rank,
          preqPouleRank: preq,
          setPoints: 0,
          matches: 0,
          faits: 0,
          subis: 0,
        },
        true,
      );
    expect([1, 2, 3, 4, 5, 8, 9, 12, 13, 16].map((k) => r("M", k, null))).toEqual([
      80, 54, 38, 38, 26, 26, 18, 18, 13, 13,
    ]);
    expect([1, 2, 4, 5, 8, 9, 16, 17, 24, 25, 32].map((k) => r("N", k, null))).toEqual([
      25, 17, 11, 9, 9, 7, 7, 5, 5, 4, 4,
    ]);
    expect(r("CLS", 1, 4)).toBe(3);
    expect(r("CLS", 2, 3)).toBe(2);
    expect(r("CLS", 2, 4)).toBe(1);
    expect(decimalPoints(20, 6)).toBeCloseTo(0.0333333333, 10);
    expect(decimalPoints(0, 0)).toBe(0);
  });
});

describe("classement glissant « APRES TN2 2026-2027 »", () => {
  const awards = awardPoints(results, fx.consolanteHeld);
  const after = applyTournament(fx.windowBefore, awards, { season: fx.season, tn: 2 });
  const rows = rankingRows(after);

  it("reproduit exactement le classement de l'outil de référence (129 joueurs)", () => {
    expect(rows).toHaveLength(fx.expectedAfter.length);
    rows.forEach((row, i) => {
      const e = fx.expectedAfter[i];
      expect(e).toBeDefined();
      if (!e) return;
      expect(row.name, `position ${i + 1}`).toBe(e.name);
      expect(row.position).toBe(e.position);
      expect(row.pts, `${e.name} points`).toBeCloseTo(e.pts, 9);
      expect(row.count, `${e.name} nb tournois`).toBe(e.count);
      expect(row.moy, `${e.name} moyenne`).toBeCloseTo(e.moy, 9);
      const tn2 = row.results.find((r) => r.season === fx.season && r.tn === 2);
      if (e.tn2) {
        expect(tn2, `${e.name} colonne TN2`).toBeDefined();
        expect(tn2?.pts).toBeCloseTo(e.tn2.pts, 9);
        expect(tn2?.faits).toBe(e.tn2.faits);
        expect(tn2?.subis).toBe(e.tn2.subis);
      } else expect(tn2).toBeUndefined();
    });
  });

  it("retire le plus mauvais résultat d'un joueur ayant joué les 5 TN", () => {
    const five = rows.find((r) => r.count === 5);
    expect(five).toBeDefined();
    if (!five) return;
    const values = five.results.map((r) => r.pts);
    const sum = values.reduce((a, b) => a + b, 0);
    expect(five.pts).toBeCloseTo(sum - Math.min(...values), 9);
    const four = rows.find((r) => r.count === 4);
    expect(four).toBeDefined();
    if (four)
      expect(four.pts).toBeCloseTo(
        four.results.reduce((a, r) => a + r.pts, 0),
        9,
      );
  });

  it("fait glisser la fenêtre : le TN le plus ancien sort à la clôture suivante", () => {
    const next = applyTournament(after, [], { season: fx.season, tn: 3 });
    for (const e of next) {
      for (const r of e.results)
        expect(stageIndex(r.season, r.tn)).toBeGreaterThan(stageIndex("2025-2026", 3));
    }
    expect(windowStages("2026-2027", 3)).toEqual([
      { season: "2025-2026", tn: 4 },
      { season: "2025-2026", tn: 5 },
      { season: "2026-2027", tn: 1 },
      { season: "2026-2027", tn: 2 },
      { season: "2026-2027", tn: 3 },
    ]);
    expect(windowStages("2027-2028", 1).map((s) => `${s.season}#${s.tn}`)).toEqual([
      "2026-2027#2",
      "2026-2027#3",
      "2026-2027#4",
      "2026-2027#5",
      "2027-2028#1",
    ]);
  });

  it("calcule score, nombre de TN et moyenne d'une fenêtre", () => {
    const mk = (pts: number, faits = 100, subis = 100): TnResult => ({
      season: "2026-2027",
      tn: 1,
      pts,
      faits,
      subis,
    });
    expect(windowScore([mk(10), mk(20), mk(30), mk(40), mk(5)])).toEqual({
      pts: 100,
      count: 5,
      moy: 1,
    });
    expect(windowScore([mk(10), mk(20), mk(5, 300, 200)]).pts).toBe(35);
    expect(windowScore([]).count).toBe(0);
  });

  it("exporte le classement en CSV", () => {
    const csv = rankingCsv(rows.slice(0, 2), windowStages(fx.season, 2));
    const lines = csv.split("\n");
    expect(lines[0]).toContain(
      "TN3 2025-2026;TN4 2025-2026;TN5 2025-2026;TN1 2026-2027;TN2 2026-2027",
    );
    expect(lines[1]?.startsWith(`1;${rows[0]?.name}`)).toBe(true);
  });
});

describe("base joueurs", () => {
  const awards = awardPoints(results, fx.consolanteHeld);
  const rows = rankingRows(applyTournament(fx.windowBefore, awards, { season: fx.season, tn: 2 }));

  it("met à jour le classement en cours de chaque joueur comme l'onglet database de référence", () => {
    const before: PlayerRecord[] = fx.players.map((p) => ({
      licence: p.licence,
      name: p.name,
      club: p.club,
      lastSeason: p.lastSeason === fx.season ? "2025-2026" : p.lastSeason,
      currentPlace: null,
      lastPlace: p.lastPlace,
    }));
    const participants = results.map((r) => ({
      licence: r.licence ?? "",
      name: r.name,
      club: r.club ?? "",
    }));
    const updated = updatePlayerBase(before, rows, fx.season, participants);
    const byLicence = new Map(updated.map((p) => [p.licence, p]));
    for (const p of fx.players) {
      const u = byLicence.get(p.licence);
      expect(u, p.name).toBeDefined();
      expect(u?.currentPlace ?? null, `${p.name} classement en cours`).toBe(p.currentPlace);
      if (p.currentPlace !== null) expect(u?.lastPlace).toBe(p.currentPlace);
    }
    const byName = new Map(updated.map((p) => [p.name, p]));
    for (const r of results) {
      const u = byLicence.get(r.licence ?? "") ?? byName.get(r.name);
      expect(u?.lastSeason, r.name).toBe(fx.season);
    }
    const inactive = updated.find((p) => p.currentPlace === null && p.lastPlace !== null);
    expect(inactive).toBeDefined();
  });

  it("fournit les derniers classements connus pour la liste ordonnée", () => {
    const known = lastKnownPlaces([
      {
        licence: "A1",
        name: "X Y",
        club: "",
        lastSeason: "2024-2025",
        currentPlace: null,
        lastPlace: 12,
      },
      {
        licence: "B2",
        name: "Z W",
        club: "",
        lastSeason: null,
        currentPlace: null,
        lastPlace: null,
      },
    ]);
    expect(known["A1"]).toEqual({ place: 12, season: 2024 });
    expect(known["X Y"]).toEqual({ place: 12, season: 2024 });
    expect(known["B2"]).toBeUndefined();
  });

  it("recherche sans accents ni casse", () => {
    const found = searchPlayers(fx.players, "barre pat");
    expect(found.map((p) => p.name)).toContain("BARRE PATRICK");
    expect(searchPlayers(fx.players, "")).toHaveLength(fx.players.length);
  });
});

describe("inscriptions, capacité et liste d'attente", () => {
  const reg = (i: number, licence: string, name: string): Registration => ({
    licence,
    name,
    club: `Club ${i % 3}`,
    email: `${licence.toLowerCase()}@exemple.fr`,
    order: i,
    registeredAt: `2026-10-${String(i).padStart(2, "0")}T10:00:00`,
    junior: false,
    forfait: false,
  });
  const registrations = Array.from({ length: 14 }, (_, i) =>
    reg(i + 1, `L${i + 1}`, `JOUEUR ${i + 1}`),
  );
  // Classement glissant : L14 est 3e, L13 est 40e, L2 est 34e ; L1 et L3 connus dans la base.
  const ranking = { L14: 3, L13: 40, L2: 34, L10: 12 };
  const lastKnown = { L1: { place: 5, season: 2024 }, L3: { place: 50, season: 2025 } };

  it("plafonne la capacité à 100 et applique billards × 8 + 8", () => {
    expect(capacityFor(11, DEFAULT_SEASON_SETTINGS)).toBe(96);
    expect(capacityFor(12, DEFAULT_SEASON_SETTINGS)).toBe(100);
    expect(capacityFor(8, DEFAULT_SEASON_SETTINGS)).toBe(72);
  });

  it("accepte en priorité les 34 premiers du classement puis l'ordre d'inscription", () => {
    const a = acceptRegistrations(registrations, 10, ranking, lastKnown, 34);
    expect(a.accepted).toHaveLength(10);
    expect(a.waiting).toHaveLength(4);
    const accepted = new Set(a.accepted.map((p) => p.licence));
    expect(accepted.has("L14")).toBe(true);
    expect(accepted.has("L2")).toBe(true);
    expect(accepted.has("L10")).toBe(true);
    // L13 (40e) n'est pas prioritaire : il passe par l'ordre d'inscription (13e inscrit).
    expect(accepted.has("L13")).toBe(false);
    expect(a.waiting.map((p) => p.licence)).toEqual(["L9", "L11", "L12", "L13"]);
    // Liste ordonnée des acceptés (SPEC §2) : places 3, 9 (ancien classement 5 → 9), 12, 34, puis
    // la base (50 → 50,5), puis les nouveaux dans l'ordre d'inscription.
    expect(a.accepted.slice(0, 5).map((p) => p.licence)).toEqual(["L14", "L1", "L10", "L2", "L3"]);
    expect(a.accepted[1]?.place).toBe(9);
    expect(a.accepted[4]?.place).toBe(50.5);
    expect(a.accepted.slice(5).map((p) => p.licence)).toEqual(["L4", "L5", "L6", "L7", "L8"]);
  });

  it("intègre le premier de la liste d'attente après un forfait", () => {
    const withForfait = registrations.map((r) =>
      r.licence === "L14" ? { ...r, forfait: true } : r,
    );
    const a = acceptRegistrations(withForfait, 10, ranking, lastKnown, 34);
    expect(a.forfaits.map((p) => p.licence)).toEqual(["L14"]);
    expect(a.accepted).toHaveLength(10);
    expect(a.accepted.map((p) => p.licence)).toContain("L9");
    expect(a.accepted.map((p) => p.licence)).not.toContain("L14");
    expect(a.waiting.map((p) => p.licence)).toEqual(["L11", "L12", "L13"]);
  });
});

describe("convocations et calendrier", () => {
  it("remplit le canevas du mail", () => {
    const text = renderTemplate("Bonjour {{prenom}} {{nom}}, RDV {{heure}} {{inconnu}}", {
      prenom: "Jean",
      nom: "DUPONT",
      heure: "10:30",
    });
    expect(text).toBe("Bonjour Jean DUPONT, RDV 10:30 {{inconnu}}");
    expect(splitName("DUPONT JEAN CLAUDE")).toEqual({ nom: "DUPONT", prenom: "Jean Claude" });
    expect(convocationTime("vendredi", 4, DEFAULT_SEASON_SETTINGS)).toBe("10:30");
    expect(convocationTime("samedi", 3, DEFAULT_SEASON_SETTINGS)).toBe("08:00");
    expect(convocationTime("dimanche", 4, DEFAULT_SEASON_SETTINGS)).toBe("08:30");
  });

  it("dérive le statut d'une étape", () => {
    const stage: Stage = {
      id: "tn2",
      season: "2026-2027",
      number: 2,
      kind: "TN",
      name: "TN 2",
      clubId: null,
      city: "Ronchin",
      start: "2026-10-30",
      end: "2026-11-01",
      registrationOpen: "2026-09-01T00:00:00",
      registrationClose: "2026-10-20T23:59:00",
      registrationUrl: "",
      big: 4,
      small: 7,
      djLicence: null,
      tournamentId: null,
      openedAt: null,
      closedAt: null,
    };
    expect(stageStatus(stage, "2026-08-01T00:00:00")).toBe("a-venir");
    expect(stageStatus(stage, "2026-09-15T00:00:00")).toBe("inscriptions-ouvertes");
    expect(stageStatus(stage, "2026-10-25T00:00:00")).toBe("inscriptions-closes");
    expect(stageStatus({ ...stage, openedAt: "2026-10-28T00:00:00" }, "2026-10-29T00:00:00")).toBe(
      "ouvert-dj",
    );
    expect(stageStatus({ ...stage, closedAt: "2026-11-02T00:00:00" }, "2026-11-03T00:00:00")).toBe(
      "cloture",
    );
    expect(sundayOf("2026-10-30")).toBe("2026-11-01");
    expect(hostCapable(3, 5, DEFAULT_SEASON_SETTINGS).ok).toBe(true);
    expect(hostCapable(2, 8, DEFAULT_SEASON_SETTINGS).ok).toBe(false);
    expect(hostCapable(4, 3, DEFAULT_SEASON_SETTINGS).ok).toBe(false);
  });
});
