/**
 * Liste ordonnée des participants en PDF (pièce jointe des convocations) : même contenu que la
 * vue A4 « Liste ordonnée » (8 Masters puis l'ordre du serpentin, U21 signalés, liste
 * d'attente), avec le logo Pilot5Q et la fine bande tricolore (DESIGN.md). jsPDF est chargé à la
 * demande pour ne pas alourdir l'application.
 */
import type { Player, Stage } from "@pilot5q/domain";

import { dateRange } from "@/lib/format";

import { safeFileName } from "./attachments";
import {
  BLUE,
  BLUE_SOFT,
  GOLD_INK,
  GOLD_SOFT,
  INK,
  LINE,
  MUTED,
  PAGE_MARGIN,
  drawBrand,
  drawFooters,
  lastTableY,
} from "./pdfKit";
import type { SeasonDocument } from "./persistence";

/** Nom du fichier joint : « Liste des participants - TN 2 2026-2027 Ronchin.pdf ». */
export function participantsFileName(stage: Stage): string {
  return safeFileName(
    `Liste des participants - ${stage.name} ${stage.season}${stage.city ? ` ${stage.city}` : ""}.pdf`,
  );
}

/** Ligne d'en-tête : « TN 2 2026-2027 · Ronchin · BC Ronchin · 30 oct. – 1er nov. 2026 ». */
function stageLine(doc: SeasonDocument, stage: Stage): string {
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  return [
    `${stage.name} ${stage.season}`,
    stage.city,
    club?.name,
    stage.start && stage.end ? dateRange(stage.start, stage.end) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

const place = (p: Player) => (p.place === null ? "nouveau" : String(p.place).replace(".", ","));

/** Génère le PDF (A4 portrait). */
export async function participantsPdf(
  doc: SeasonDocument,
  stage: Stage,
  accepted: Player[],
  waiting: Player[],
): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  pdf.setProperties({
    title: `Liste des participants - ${stage.name} ${stage.season}`,
    author: "Responsable national 5-Quilles",
    creator: "Pilot5Q",
  });
  const W = pdf.internal.pageSize.getWidth();
  const M = PAGE_MARGIN;

  const brand = () => drawBrand(pdf);

  const head = (y: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...INK);
    pdf.text("Liste ordonnée des participants", M, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...MUTED);
    pdf.text(stageLine(doc, stage), M, y + 5.5);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...BLUE);
    pdf.text(`${accepted.length} acceptés`, W - M, y, { align: "right" });
    const juniors = accepted.filter((p) => p.junior).length;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(`8 Masters (samedi) · ${juniors} U21`, W - M, y + 5.5, { align: "right" });
  };

  brand();
  head(24);

  autoTable(pdf, {
    startY: 33,
    margin: { left: M, right: M, top: 20, bottom: 16 },
    head: [["Rang", "Nom", "Club", "Licence", "Place", "Tableau", "U21"]],
    body: accepted.map((p) => [
      String(p.seed),
      p.name,
      p.club,
      p.licence,
      place(p),
      p.seed <= 8 ? "Masters (samedi)" : "Vendredi",
      p.junior ? "U21" : "",
    ]),
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      cellPadding: { top: 1.25, bottom: 1.25, left: 1.8, right: 1.8 },
      lineColor: LINE,
      lineWidth: { bottom: 0.2 },
    },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { halign: "right", cellWidth: 11, font: "courier" },
      3: { font: "courier" },
      4: { halign: "right", font: "courier" },
      6: { halign: "center", cellWidth: 11 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const p = accepted[data.row.index];
      if (p && p.seed <= 8) {
        data.cell.styles.fillColor = GOLD_SOFT;
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 5) data.cell.styles.textColor = GOLD_INK;
      }
    },
    didDrawPage: () => {
      if (pdf.getCurrentPageInfo().pageNumber > 1) brand();
    },
  });

  if (waiting.length > 0) {
    const y = lastTableY(pdf, 40) + 8;
    autoTable(pdf, {
      startY: y + 4,
      margin: { left: M, right: M, top: 20, bottom: 16 },
      head: [[`Liste d'attente (${waiting.length})`, "Club", "Licence"]],
      body: waiting.map((p, i) => [`${i + 1}. ${p.name}`, p.club, p.licence]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: INK,
        cellPadding: { top: 1.1, bottom: 1.1, left: 1.8, right: 1.8 },
        lineColor: LINE,
        lineWidth: { bottom: 0.2 },
      },
      headStyles: { fillColor: BLUE_SOFT, textColor: BLUE, fontStyle: "bold", fontSize: 8 },
      columnStyles: { 2: { font: "courier" } },
      didDrawPage: () => {
        if (pdf.getCurrentPageInfo().pageNumber > 1) brand();
      },
    });
  }

  // Pied de page : règle de la liste et pagination.
  drawFooters(
    pdf,
    "Place : classement glissant ; sinon dernier classement connu (9 si 8 ou moins, sinon P + 0,5) ; sinon nouveau joueur.",
  );
  return pdf.output("blob");
}
