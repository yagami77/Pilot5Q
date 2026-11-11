/**
 * Espace du responsable national : barème, classement glissant, base joueurs, inscriptions.
 *
 * Validation sur données réelles (fixture season-exemple.json, issue du classeur
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
  markLegacyIntegrations,
  applyTournament,
  awardPoints,
  awardsFromRanking,
  basePoints,
  capacityFor,
  convocationTime,
  currentPlaces,
  decimalPoints,
  hostCapable,
  lastKnownPlaces,
  leftStage,
  rankingCsv,
  rankingRows,
  renderTemplate,
  DEFAULT_MAIL_TEMPLATE,
  mailHtml,
  mailSegments,
  searchPlayers,
  splitName,
  stageIndex,
  stageStatus,
  sundayOf,
  updatePlayerBase,
  windowResults,
  windowScore,
  windowStages,
} from "../src/index.js";
import type {
  PlayerRecord,
  RankingEntry,
  Registration,
  Stage,
  TnResult,
  TournamentRankRow,
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

  it("convertit un classement final de tournoi (finalRanking) en entrées de la fenêtre", () => {
    const row = (name: string, points: number, abandon = false): TournamentRankRow => ({
      place: 0,
      name,
      origin: "N",
      points,
      decimal: 0.01,
      ptm: 2,
      pts: 1,
      faits: 100,
      subis: 90,
      moy: 100 / 90,
      joues: 1,
      arrivee: 1,
      abandon,
    });
    const out = awardsFromRanking([row("A B", 25), row("C D", 7, true)], {
      "A B": { licence: "123456X", club: "BC Test" },
    });
    expect(out[0]).toMatchObject({
      licence: "123456X",
      club: "BC Test",
      points: 25,
      decimal: 0.01,
    });
    expect(out[1]).toMatchObject({ licence: "", points: 0, decimal: 0, abandon: true, faits: 100 });
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

  it("fait glisser la fenêtre : le TN sorti reste dans l'historique mais ne compte plus", () => {
    const next = applyTournament(after, [], { season: fx.season, tn: 3 });
    const stage = { season: fx.season, tn: 3 };
    const nextRows = rankingRows(next, { stage });
    // Tout l'historique est conservé : le TN 3 2025-2026 est encore dans `results`…
    const kept = next.filter((e) => e.results.some((r) => r.season === "2025-2026" && r.tn === 3));
    expect(kept.length).toBeGreaterThan(0);
    // … mais il ne compte plus : score, nombre de TN et moyenne se calculent sur la fenêtre.
    for (const row of nextRows) {
      const inWindow = windowResults(row.results, stage);
      expect(inWindow.every((r) => stageIndex(r.season, r.tn) > stageIndex("2025-2026", 3))).toBe(
        true,
      );
      expect(row.count).toBe(inWindow.length);
      expect(row.pts).toBeCloseTo(windowScore(inWindow).pts, 9);
      expect(row.window.map((w) => `${w.season}#${w.tn}`)).toEqual([
        "2025-2026#4",
        "2025-2026#5",
        "2026-2027#1",
        "2026-2027#2",
        "2026-2027#3",
      ]);
      expect(row.left).toMatchObject({ season: "2025-2026", tn: 3 });
      const leftRes = row.results.find((r) => r.season === "2025-2026" && r.tn === 3);
      expect(row.left.pts).toBe(leftRes ? leftRes.pts : null);
    }
    // Un joueur dont le seul TN était le TN 3 2025-2026 disparaît du classement.
    const onlyTn3 = after.filter(
      (e) =>
        e.results.length === 1 && e.results[0]?.season === "2025-2026" && e.results[0]?.tn === 3,
    );
    expect(onlyTn3.length).toBeGreaterThan(0);
    for (const e of onlyTn3) expect(nextRows.find((r) => r.name === e.name)).toBeUndefined();
    expect(nextRows.length).toBe(rows.length - onlyTn3.length);
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
    expect(leftStage("2027-2028", 1)).toEqual({ season: "2026-2027", tn: 1 });
  });

  it("signale le TN sorti, le TN qui sortira et le résultat non compté de chaque ligne", () => {
    const first = rows[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.window).toHaveLength(5);
    expect(first.window.map((w) => `TN${w.tn} ${w.season}`)).toEqual([
      "TN3 2025-2026",
      "TN4 2025-2026",
      "TN5 2025-2026",
      "TN1 2026-2027",
      "TN2 2026-2027",
    ]);
    // Le TN 2 2025-2026 vient de sortir : la fixture ne le contient pas, ses points sont inconnus.
    expect(first.left).toEqual({ season: "2025-2026", tn: 2, pts: null });
    expect(first.leavingNext).toMatchObject({ season: "2025-2026", tn: 3 });
    // 5 TN joués : le plus faible est retiré et sa case est marquée « non comptée ».
    expect(first.count).toBe(5);
    expect(first.dropped).not.toBeNull();
    const min = Math.min(...first.results.map((r) => r.pts));
    expect(first.dropped?.pts).toBe(min);
    const uncounted = first.window.filter((w) => w.pts !== null && !w.counted);
    expect(uncounted).toHaveLength(1);
    expect(uncounted[0]?.pts).toBe(min);
    expect(first.window.filter((w) => w.counted)).toHaveLength(4);
    // Moins de 5 TN : rien n'est retiré, toutes les cases jouées comptent.
    const four = rows.find((r) => r.count === 4);
    expect(four?.dropped).toBeNull();
    expect(four?.window.filter((w) => w.pts !== null && !w.counted)).toHaveLength(0);
    expect(four?.window.filter((w) => w.pts === null)).toHaveLength(1);
    // Sans classement précédent, l'évolution est inconnue.
    expect(first.delta).toBeNull();
  });

  it("calcule l'évolution des places depuis le classement précédent", () => {
    const withDelta = rankingRows(after, { previous: fx.windowBefore });
    const before = new Map(rankingRows(fx.windowBefore).map((r) => [r.licence, r.position]));
    for (const r of withDelta) {
      const prev = before.get(r.licence);
      expect(r.delta).toBe(prev === undefined ? null : prev - r.position);
    }
    expect(withDelta.some((r) => r.delta !== null && r.delta > 0)).toBe(true);
    expect(withDelta.some((r) => r.delta !== null && r.delta < 0)).toBe(true);
    expect(withDelta.some((r) => r.delta === null)).toBe(true);
    // L'ordre et les scores ne changent pas.
    expect(withDelta.map((r) => r.name)).toEqual(rows.map((r) => r.name));
  });

  it("gère une fenêtre à cheval sur deux saisons avec un historique long", () => {
    const res = (season: string, tn: number, pts: number): TnResult => ({
      season,
      tn,
      pts,
      faits: 100,
      subis: 80,
    });
    const entries: RankingEntry[] = [
      {
        licence: "A",
        name: "ANCIEN ALPHA",
        club: "C1",
        results: [
          res("2024-2025", 5, 80),
          res("2025-2026", 1, 54),
          res("2025-2026", 2, 7),
          res("2025-2026", 3, 26),
          res("2025-2026", 4, 38),
          res("2025-2026", 5, 18),
          res("2026-2027", 1, 25),
        ],
      },
      {
        licence: "B",
        name: "BETA BRUNO",
        club: "C2",
        results: [res("2024-2025", 5, 80), res("2025-2026", 1, 80)],
      },
    ];
    // Fenêtre TN 2 2025-2026 → TN 1 2026-2027 : le TN 1 2025-2026 vient de sortir.
    const rows1 = rankingRows(entries);
    expect(rows1.map((r) => r.licence)).toEqual(["A"]);
    const a = rows1[0];
    expect(a?.left).toEqual({ season: "2025-2026", tn: 1, pts: 54 });
    expect(a?.leavingNext).toMatchObject({ season: "2025-2026", tn: 2, pts: 7, counted: false });
    expect(a?.dropped).toEqual({ season: "2025-2026", tn: 2, pts: 7 });
    expect(a?.pts).toBe(26 + 38 + 18 + 25);
    expect(a?.count).toBe(5);
    expect(a?.results).toHaveLength(7);
    // Une clôture plus tard (TN 2 2026-2027) : B n'a plus rien dans la fenêtre, A perd le TN 2.
    const later = applyTournament(
      entries,
      [
        {
          name: "BETA BRUNO",
          licence: "B",
          club: "C2",
          points: 80,
          decimal: 0.02,
          faits: 500,
          subis: 400,
          abandon: false,
          origin: "M",
        },
      ],
      { season: "2026-2027", tn: 2 },
    );
    const rows2 = rankingRows(later, { previous: entries });
    expect(rows2.map((r) => r.licence)).toEqual(["A", "B"]);
    expect(rows2[0]?.pts).toBe(26 + 38 + 18 + 25);
    expect(rows2[0]?.count).toBe(4);
    expect(rows2[0]?.dropped).toBeNull();
    expect(rows2[0]?.left).toEqual({ season: "2025-2026", tn: 2, pts: 7 });
    expect(rows2[0]?.delta).toBe(0);
    expect(rows2[1]?.pts).toBeCloseTo(80.02, 9);
    expect(rows2[1]?.delta).toBeNull();
    expect(rows2[1]?.left).toEqual({ season: "2025-2026", tn: 2, pts: null });
    // L'historique complet de B est conservé.
    expect(later.find((e) => e.licence === "B")?.results).toHaveLength(3);
    // Le classement « tel qu'il était » à une fenêtre antérieure se recalcule depuis l'historique.
    const old = rankingRows(later, { stage: { season: "2025-2026", tn: 2 } });
    expect(old.map((r) => r.licence)).toEqual(["B", "A"]);
    expect(old[0]?.pts).toBe(160);
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
      "TN2 2025-2026 (sorti, ne compte plus);TN3 2025-2026;TN4 2025-2026;TN5 2025-2026;TN1 2026-2027;TN2 2026-2027",
    );
    expect(lines[1]?.startsWith(`1;${rows[0]?.name}`)).toBe(true);
    // Le résultat non compté porte un astérisque ; la colonne du TN sorti est vide (inconnu).
    const cells = lines[1]?.split(";") ?? [];
    expect(cells[7]).toBe("");
    expect(cells.slice(8).filter((c) => c.endsWith("*"))).toHaveLength(1);
    expect(rankingCsv(rows.slice(0, 2)).split("\n")[0]).toBe(lines[0]);
  });
});

describe("base joueurs", () => {
  const awards = awardPoints(results, fx.consolanteHeld);
  const rows = rankingRows(applyTournament(fx.windowBefore, awards, { season: fx.season, tn: 2 }));

  it("applique l'algorithme du responsable : a joué, n'a pas joué mais a des points, est à 0", () => {
    const record = (
      licence: string,
      currentPlace: number | null,
      lastPlace: number | null,
      lastSeason: string | null,
    ): PlayerRecord => ({
      licence,
      name: `JOUEUR ${licence}`,
      club: "",
      lastSeason,
      currentPlace,
      lastPlace,
    });
    const result = (season: string, tn: number, pts: number): TnResult => ({
      season,
      tn,
      pts,
      faits: 100,
      subis: 100,
    });
    const entry = (licence: string, res: TnResult[]): RankingEntry => ({
      licence,
      name: `JOUEUR ${licence}`,
      club: "",
      results: res,
    });
    // Fenêtre après le TN 2 2026-2027 : du TN 3 2025-2026 au TN 2 2026-2027.
    const ranking = rankingRows(
      [
        // A et B ont joué le TN 2 ; C a encore les points du TN 1 ; D n'a plus que le TN 2
        // 2025-2026, sorti de la fenêtre ; E n'a qu'un abandon (0 point) au TN 5 2025-2026.
        entry("A", [result("2026-2027", 1, 26.01), result("2026-2027", 2, 80.02)]),
        entry("B", [result("2026-2027", 2, 5.004)]),
        entry("C", [result("2026-2027", 1, 38.01)]),
        entry("D", [result("2025-2026", 2, 54.02)]),
        entry("E", [result("2025-2026", 5, 0)]),
      ],
      { stage: { season: "2026-2027", tn: 2 } },
    );
    expect(ranking.map((r) => `${r.position}:${r.licence}`)).toEqual(["1:A", "2:C", "3:B", "4:E"]);
    const updated = updatePlayerBase(
      [
        record("A", 3, 3, "2026-2027"),
        record("C", 1, 1, "2026-2027"),
        record("D", 2, 2, "2025-2026"),
        record("E", 4, 60, "2025-2026"),
        record("F", null, 17, "2019-2020"),
      ],
      ranking,
      "2026-2027",
      [
        { licence: "A", name: "JOUEUR A", club: "CLUB A" },
        { licence: "B", name: "JOUEUR B", club: "CLUB B", junior: true },
      ],
    );
    const by = new Map(updated.map((p) => [p.licence, p]));
    // A joué ce TN : « classement » et « dernier » = place actuelle, saison en cours.
    expect(by.get("A")).toMatchObject({
      currentPlace: 1,
      lastPlace: 1,
      lastSeason: "2026-2027",
      club: "CLUB A",
    });
    // Inconnu de la base : ajouté, avec le drapeau U21 transmis.
    expect(by.get("B")).toMatchObject({
      currentPlace: 3,
      lastPlace: 3,
      lastSeason: "2026-2027",
      junior: true,
    });
    // N'a pas joué mais a encore des points : « classement » mis à jour, « dernier » conservé.
    expect(by.get("C")).toMatchObject({ currentPlace: 2, lastPlace: 1, lastSeason: "2026-2027" });
    // Sorti de la fenêtre : « classement » effacé, « dernier » et saison conservés.
    expect(by.get("D")).toMatchObject({
      currentPlace: null,
      lastPlace: 2,
      lastSeason: "2025-2026",
    });
    // Encore dans la fenêtre mais à 0 point, absent de ce TN : traité comme « à 0 ».
    expect(by.get("E")).toMatchObject({ currentPlace: null, lastPlace: 60 });
    // Absent du classement comme du TN : rien ne bouge.
    expect(by.get("F")).toMatchObject({
      currentPlace: null,
      lastPlace: 17,
      lastSeason: "2019-2020",
    });
  });

  it("appliqué à la base réelle après le TN 2 : 76 joueurs du TN, 53 classés absents, les autres effacés", () => {
    // Base du responsable telle que transmise (champs « classement » et « dernier »), valeurs
    // périmées comprises : l'algorithme doit la remettre d'aplomb.
    const before: PlayerRecord[] = fx.players.map((p) => ({
      licence: p.licence,
      name: p.name,
      club: p.club,
      lastSeason: p.lastSeason === fx.season ? "2025-2026" : p.lastSeason,
      currentPlace: p.posThis,
      lastPlace: p.posLast,
    }));
    const participants = results.map((r) => ({
      licence: r.licence ?? "",
      name: r.name,
      club: r.club ?? "",
    }));
    const updated = updatePlayerBase(before, rows, fx.season, participants);
    expect(updated).toHaveLength(before.length);
    const position = new Map(rows.map((r) => [r.name, r.position]));
    const played = new Set(results.map((r) => r.name));
    const count = { played: 0, rankedAbsent: 0, out: 0 };
    updated.forEach((u, i) => {
      const b = before[i];
      const source = fx.players[i];
      if (!b || !source) throw new Error("base incohérente");
      const place = position.get(u.name) ?? null;
      expect(u.currentPlace, `${u.name} classement`).toBe(place);
      if (played.has(u.name)) {
        count.played++;
        expect(u.lastPlace, `${u.name} dernier`).toBe(place);
        expect(u.lastSeason, `${u.name} saison`).toBe(fx.season);
        // Seul point où la base transmise est à jour : le « classement » des joueurs du TN 2.
        expect(source.posThis, `${u.name} classement de la base transmise`).toBe(place);
      } else {
        if (place === null) count.out++;
        else count.rankedAbsent++;
        expect(u.lastPlace, `${u.name} dernier`).toBe(b.lastPlace);
        expect(u.lastSeason, `${u.name} saison`).toBe(b.lastSeason);
      }
    });
    expect(count).toEqual({ played: 76, rankedAbsent: 53, out: 200 });
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
    const current = currentPlaces([
      { licence: "A1", name: "X Y", club: "", lastSeason: null, currentPlace: 4, lastPlace: 4 },
      { licence: "B2", name: "Z W", club: "", lastSeason: null, currentPlace: null, lastPlace: 9 },
    ]);
    expect(current).toEqual({ A1: 4, "X Y": 4 });
  });

  it("recherche sans accents ni casse", () => {
    const found = searchPlayers(fx.players, "coupade jul");
    expect(found.map((p) => p.name)).toContain("COUPADE JULES");
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

  it("un forfait libère une place sans intégrer personne ; le prioritaire est suggéré", () => {
    const withForfait = registrations.map((r) =>
      r.licence === "L14" ? { ...r, forfait: true } : r,
    );
    const a = acceptRegistrations(withForfait, 10, ranking, lastKnown, 34);
    expect(a.forfaits.map((p) => p.licence)).toEqual(["L14"]);
    expect(a.accepted).toHaveLength(9);
    expect(a.free).toBe(1);
    expect(a.accepted.map((p) => p.licence)).not.toContain("L14");
    expect(a.accepted.map((p) => p.licence)).not.toContain("L9");
    expect(a.waiting.map((p) => p.licence)).toEqual(["L9", "L11", "L12", "L13"]);
    expect(a.suggested).toBe("L9");
    // Le responsable intègre L12 plutôt que le suggéré : la place est prise.
    const chosen = withForfait.map((r) => (r.licence === "L12" ? { ...r, integrated: true } : r));
    const b = acceptRegistrations(chosen, 10, ranking, lastKnown, 34);
    expect(b.accepted).toHaveLength(10);
    expect(b.free).toBe(0);
    expect(b.accepted.map((p) => p.licence)).toContain("L12");
    expect(b.integrated).toEqual(["L12"]);
    expect(b.waiting.map((p) => p.licence)).toEqual(["L9", "L11", "L13"]);
  });

  it("le suggéré saute les joueurs indisponibles", () => {
    const regs = registrations.map((r) =>
      r.licence === "L14"
        ? { ...r, forfait: true }
        : r.licence === "L9"
          ? { ...r, waitStatus: "indisponible" as const }
          : r,
    );
    expect(acceptRegistrations(regs, 10, ranking, lastKnown, 34).suggested).toBe("L11");
  });

  it("annuler un forfait après une intégration dépasse la capacité (signalé)", () => {
    const regs = registrations.map((r) => (r.licence === "L9" ? { ...r, integrated: true } : r));
    const a = acceptRegistrations(regs, 10, ranking, lastKnown, 34);
    expect(a.accepted).toHaveLength(11);
    expect(a.free).toBe(-1);
  });

  it("garde les intégrations automatiques des données enregistrées auparavant", () => {
    const withForfait = registrations.map((r) =>
      r.licence === "L14" ? { ...r, forfait: true } : r,
    );
    const migrated = markLegacyIntegrations(withForfait, 10, ranking, lastKnown, 34);
    expect(migrated.filter((r) => r.integrated).map((r) => r.licence)).toEqual(["L9"]);
    const a = acceptRegistrations(migrated, 10, ranking, lastKnown, 34);
    expect(a.accepted.map((p) => p.licence)).toContain("L9");
    expect(a.free).toBe(0);
    expect(markLegacyIntegrations(registrations, 10, ranking, lastKnown, 34)).toBe(registrations);
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

  it("met en évidence la phrase « En cas de forfait… » du canevas par défaut", () => {
    const alerts = mailSegments(DEFAULT_MAIL_TEMPLATE).filter((x) => x.alert);
    expect(alerts.map((x) => x.text)).toEqual([
      "En cas de forfait merci de prévenir au plus vite par retour de mail.",
    ]);
    expect(
      mailSegments(DEFAULT_MAIL_TEMPLATE)
        .map((x) => x.text)
        .join(""),
    ).toBe(DEFAULT_MAIL_TEMPLATE);
    const html = mailHtml("Bonjour <Jean> & co,\nEn cas de forfait, prévenez.\nMerci");
    expect(html).toContain("Bonjour &lt;Jean&gt; &amp; co,<br>");
    expect(html).toContain(
      '<span style="color:#DC3F5A;font-weight:600">En cas de forfait, prévenez.</span>',
    );
    expect(mailSegments("Rien à signaler.")).toEqual([{ text: "Rien à signaler.", alert: false }]);
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
