/** Suites de la clôture : RANKING.json, PDF récapitulatif du tournoi, message au secrétariat. */
import type { TournamentEvent } from "@pilot5q/domain";
import { rankingRows, replay } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";

import { blobBytes } from "./attachments";
import {
  CLOSURE_STEPS,
  SECRETARIAT_EMAIL,
  closureDone,
  rankingJsonFile,
  secretariatMail,
} from "./closureDocs";
import { demoSeason, type DemoInscription } from "./demo";
import { rankingFileName } from "./rankingPdf";
import { realWeekendEvents } from "./realWeekend";
import { closeStage, openingEvents, stageAcceptance, tournamentAwards } from "./stage";
import { tournamentFileName, tournamentPdf } from "./tournamentPdf";

const order = (inscriptions as { registrations: DemoInscription[] }).registrations;

/** TN 2 de démonstration joué avec les scores réels puis clôturé. */
function closedDemo() {
  const doc = demoSeason(order);
  const stage = doc.stages.find((s) => s.number === 2);
  if (!stage) throw new Error("TN 2 absent");
  const at = "2026-11-01T19:00:00Z";
  const opening = openingEvents(doc, stage, stageAcceptance(doc, stage).accepted).map(
    (e) => ({ ...e, at }) as TournamentEvent,
  );
  const rest = realWeekendEvents(opening).map((e) => ({ ...e, at }) as TournamentEvent);
  const state = replay([...opening, ...rest]);
  const awards = tournamentAwards(state);
  const closed = closeStage(doc, stage, awards, doc.juniors, at);
  const last = { season: stage.season, tn: stage.number };
  return { doc: closed, stage, state, awards, last, rows: rankingRows(closed.ranking) };
}

describe("suites de la clôture d'un TN", () => {
  const demo = closedDemo();

  it("produit RANKING.json : 129 joueurs, 5 TN chacun, « - » pour un TN non joué", async () => {
    const file = rankingJsonFile(demo.rows, demo.last);
    expect(file.name).toBe("RANKING.json");
    const json = JSON.parse(new TextDecoder().decode(await blobBytes(file.blob))) as {
      ranking: string;
      saison: string;
      type: string;
      joueurs: { nom: string; points: number; TNs: { nom: string; points: number | string }[] }[];
    };
    expect(json.ranking).toBe("après TN2 2026-2027");
    expect(json.saison).toBe("2026-2027");
    expect(json.type).toBe("TN2");
    expect(json.joueurs).toHaveLength(129);
    expect(json.joueurs.every((j) => j.TNs.length === 5)).toBe(true);
    expect(json.joueurs[0]?.nom).toBe("COUPADE JULES");
    expect(json.joueurs[0]?.TNs.map((t) => t.nom)).toEqual([
      "TN 3 2025-2026",
      "TN 4 2025-2026",
      "TN 5 2025-2026",
      "TN 1 2026-2027",
      "TN 2 2026-2027",
    ]);
    // Le TN simulé de la démonstration (TN 2 2025-2026) est sorti de la fenêtre : il n'y figure pas.
    expect(JSON.stringify(json)).not.toContain("TN 2 2025-2026");
    const values = json.joueurs.flatMap((j) => j.TNs.map((t) => t.points));
    expect(values.some((v) => v === "-")).toBe(true);
    expect(values.every((v) => v === "-" || typeof v === "number")).toBe(true);
    // Les totaux décroissent : l'ordre du fichier est le classement.
    const totals = json.joueurs.map((j) => j.points);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("génère le PDF récapitulatif du tournoi", async () => {
    const club = demo.doc.clubs.find((c) => c.id === demo.stage.clubId);
    const pdf = await tournamentPdf({
      stage: demo.stage,
      clubName: club?.name ?? "",
      djName: "DUPONT JEAN",
      state: demo.state,
      awards: demo.awards,
    });
    const bytes = await blobBytes(pdf);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pdf.size).toBeGreaterThan(40_000);
    // Plusieurs pages : classement final, poules, barrages, tableaux, primes.
    const pages = new TextDecoder("latin1").decode(bytes).match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(tournamentFileName(demo.stage)).toBe("Recapitulatif TN 2 2026-2027 Ronchin.pdf");
    const out = process.env.PILOT5Q_PDF_OUT;
    if (out) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(out, bytes);
    }
  });

  it("prépare le message au secrétariat avec les deux PDF à joindre", () => {
    const files = [rankingFileName(demo.last), tournamentFileName(demo.stage)];
    const mail = secretariatMail(demo.stage, demo.awards, demo.rows.length, files);
    expect(mail.to).toBe("secretariat@ffbillard.com");
    expect(mail.href.startsWith(`mailto:${SECRETARIAT_EMAIL}?subject=`)).toBe(true);
    const query = new URLSearchParams(mail.href.slice(mail.href.indexOf("?") + 1));
    expect(query.get("subject")).toBe(mail.subject);
    expect(query.get("body")).toBe(mail.body.replace(/\n/g, "\r\n"));
    expect(mail.subject).toContain("TN 2 2026-2027");
    expect(mail.body).toContain("Pièces jointes (2 PDF)");
    for (const f of files) expect(mail.body).toContain(`- ${f}`);
    expect(mail.body).toContain("Participants : 76");
    expect(mail.body).toContain("129 joueurs");
    // Un lien mailto reste court : au-delà, certaines messageries le tronquent.
    expect(mail.href.length).toBeLessThan(2000);
  });

  it("compte les étapes faites de la liste de contrôle", () => {
    expect(CLOSURE_STEPS).toEqual(["rankingPdf", "rankingJson", "recapPdf", "secretariat"]);
    expect(closureDone(undefined)).toBe(0);
    expect(
      closureDone({ rankingPdf: "2026-11-01T19:10:00Z", recapPdf: "2026-11-01T19:12:00Z" }),
    ).toBe(2);
  });
});
