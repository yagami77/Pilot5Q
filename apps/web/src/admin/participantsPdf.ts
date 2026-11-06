/**
 * Liste ordonnée des participants en PDF (pièce jointe des convocations) : même contenu que la
 * vue A4 « Liste ordonnée » (8 Masters puis l'ordre du serpentin, U21 signalés, liste
 * d'attente), avec le logo Pilot5Q et la fine bande tricolore (DESIGN.md). jsPDF est chargé à la
 * demande pour ne pas alourdir l'application.
 */
import type { Player, Stage } from "@pilot5q/domain";

import { dateRange } from "@/lib/format";

import type { SeasonDocument } from "./persistence";
import { safeFileName } from "./attachments";

const BLUE: [number, number, number] = [14, 55, 168];
const RED: [number, number, number] = [220, 63, 90];
const INK: [number, number, number] = [15, 27, 51];
const MUTED: [number, number, number] = [107, 122, 153];
const LINE: [number, number, number] = [228, 233, 243];
const GOLD_SOFT: [number, number, number] = [255, 244, 223];
const GOLD_INK: [number, number, number] = [138, 90, 8];

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
  const H = pdf.internal.pageSize.getHeight();
  const M = 12;

  const brand = () => {
    // Bande tricolore fine en haut de page.
    const third = W / 3;
    pdf.setFillColor(...BLUE);
    pdf.rect(0, 0, third, 1.4, "F");
    pdf.setFillColor(255, 255, 255);
    pdf.rect(third, 0, third, 1.4, "F");
    pdf.setFillColor(...RED);
    pdf.rect(2 * third, 0, third, 1.4, "F");
    // Logo : carré arrondi et pictogramme (même dessin que la barre haute).
    const x = M;
    const y = 6;
    const s = 8;
    pdf.setDrawColor(...BLUE);
    pdf.setLineWidth(0.4);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, y, s, s, 2.1, 2.1, "FD");
    const cx = x + s / 2;
    const cy = y + s / 2;
    pdf.setLineWidth(0.45);
    pdf.circle(cx, cy, 0.85, "S");
    const ray = (a: number) => {
      const r1 = 1.75;
      const r2 = 2.75;
      pdf.line(
        cx + r1 * Math.cos(a),
        cy + r1 * Math.sin(a),
        cx + r2 * Math.cos(a),
        cy + r2 * Math.sin(a),
      );
    };
    for (let k = 0; k < 8; k++) ray((k * Math.PI) / 4);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...INK);
    pdf.text("Pilot5Q", x + s + 2.2, y + 5.6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text("Tournois Nationaux 5-Quilles", W - M, y + 5.6, { align: "right" });
  };

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
    const last = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    const y = (last?.finalY ?? 40) + 8;
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
      headStyles: { fillColor: [233, 239, 252], textColor: BLUE, fontStyle: "bold", fontSize: 8 },
      columnStyles: { 2: { font: "courier" } },
      didDrawPage: () => {
        if (pdf.getCurrentPageInfo().pageNumber > 1) brand();
      },
    });
  }

  // Pied de page : règle de la liste et pagination.
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.line(M, H - 11, W - M, H - 11);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(
      "Place : classement glissant ; sinon dernier classement connu (9 si 8 ou moins, sinon P + 0,5) ; sinon nouveau joueur.",
      M,
      H - 7,
    );
    pdf.text(`page ${i}/${pages}`, W - M, H - 7, { align: "right" });
  }
  return pdf.output("blob");
}
