/** Pièces jointes des convocations : contrôle des fichiers, archive zip, PDF des participants. */
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";

import {
  MAX_ATTACHMENT_BYTES,
  attachmentError,
  blobBytes,
  formatSize,
  safeFileName,
  uniqueNames,
  zipBlob,
} from "./attachments";
import { demoSeason, type DemoInscription } from "./demo";
import { participantsFileName, participantsPdf } from "./participantsPdf";
import { stageAcceptance } from "./stage";

const order = (inscriptions as { registrations: DemoInscription[] }).registrations;

const bytes = blobBytes;

describe("pièces jointes des convocations", () => {
  it("accepte les PDF et les images jusqu'à 10 Mo", () => {
    expect(attachmentError({ name: "affiche.pdf", type: "application/pdf", size: 1200 })).toBe(
      null,
    );
    expect(attachmentError({ name: "plan.png", type: "image/png", size: 5_000_000 })).toBe(null);
    expect(attachmentError({ name: "hotels.PDF", type: "", size: 10 })).toBe(null);
    expect(attachmentError({ name: "notes.docx", type: "application/msword", size: 10 })).toMatch(
      /seuls les PDF et les images/,
    );
    expect(
      attachmentError({
        name: "gros.pdf",
        type: "application/pdf",
        size: MAX_ATTACHMENT_BYTES + 1,
      }),
    ).toMatch(/10 Mo/);
  });

  it("affiche les tailles et des noms de fichier sûrs et uniques", () => {
    expect(formatSize(800)).toBe("800 o");
    expect(formatSize(12_800)).toBe("13 Ko");
    expect(formatSize(1_468_006)).toBe("1,4 Mo");
    expect(safeFileName("TN 2 · Ronchin / 2026")).toBe("TN 2 - Ronchin - 2026");
    expect(safeFileName("Pièces jointes - Saint-Étienne.zip")).toBe(
      "Pieces jointes - Saint-Etienne.zip",
    );
    expect(uniqueNames(["plan.pdf", "Plan.pdf", "affiche"])).toEqual([
      "plan.pdf",
      "Plan (2).pdf",
      "affiche",
    ]);
  });

  it("regroupe les pièces dans une archive zip", async () => {
    const zip = await zipBlob([
      { name: "a.pdf", blob: new Blob(["%PDF-a"]) },
      { name: "a.pdf", blob: new Blob(["%PDF-b"]) },
    ]);
    const files = unzipSync(await bytes(zip));
    expect(Object.keys(files)).toEqual(["a.pdf", "a (2).pdf"]);
    expect(new TextDecoder().decode(files["a (2).pdf"])).toBe("%PDF-b");
  });

  it("génère la liste ordonnée des participants en PDF", async () => {
    const doc = demoSeason(order);
    const stage = doc.stages.find((s) => s.number === 2)!;
    const { accepted, waiting } = stageAcceptance(doc, stage);
    const pdf = await participantsPdf(doc, stage, accepted, waiting);
    const head = new TextDecoder().decode((await bytes(pdf)).slice(0, 8));
    expect(head.startsWith("%PDF-")).toBe(true);
    expect(pdf.size).toBeGreaterThan(5_000);
    expect(participantsFileName(stage)).toMatch(/^Liste des participants - TN 2 2026-2027/);
  });
});
