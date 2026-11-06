import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { qrMatrix, qrPath } from "./qr";

describe("QR code", () => {
  it("choisit la version selon la longueur et pose les motifs de repérage", () => {
    const short = qrMatrix("https://yagami77.github.io/Pilot5Q/tournoi/vendredi?poule=3");
    expect(short.length).toBe(33); // version 4 (62 octets en niveau M)
    const long = qrMatrix("x".repeat(200));
    expect(long.length).toBe(57); // version 10
    for (const g of [short, long]) {
      const n = g.length;
      // Coins des trois motifs de repérage sombres, séparateurs clairs, module sombre fixe
      expect(g[0]![0]).toBe(true);
      expect(g[0]![n - 1]).toBe(true);
      expect(g[n - 1]![0]).toBe(true);
      expect(g[7]![7]).toBe(false);
      expect(g[n - 8]![8]).toBe(true);
      // Motif de synchronisation
      expect(g[6]![8]).toBe(true);
      expect(g[6]![9]).toBe(false);
    }
  });

  it("refuse un texte trop long", () => {
    expect(() => qrMatrix("x".repeat(214))).toThrow();
  });

  it("dessine un chemin SVG par module sombre", () => {
    const g = qrMatrix("Pilot5Q");
    const dark = g.flat().filter(Boolean).length;
    expect(qrPath(g).split("M").length - 1).toBe(dark);
  });

  it("exporte des images PGM pour un décodeur externe (QR_DUMP)", () => {
    if (!process.env.QR_DUMP) return;
    const texts = [
      "Pilot5Q",
      "https://yagami77.github.io/Pilot5Q/tournoi/vendredi?poule=3",
      "http://localhost:5200/tournoi/samedi?poule=17&phase=QM",
      "é à ü — " + "longue chaîne de test ".repeat(6),
      "x".repeat(213),
      ...[100, 120, 150, 180, 62, 84].map((n) => "a1".repeat(n / 2)),
    ];
    texts.forEach((t, i) => {
      const g = qrMatrix(t);
      const s = 8;
      const q = 4;
      const n = (g.length + 2 * q) * s;
      const px = Buffer.alloc(n * n, 255);
      g.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return;
          for (let y = 0; y < s; y++)
            for (let x = 0; x < s; x++) px[((r + q) * s + y) * n + (c + q) * s + x] = 0;
        }),
      );
      writeFileSync(
        `${process.env.QR_DUMP}/qr-${i}.pgm`,
        Buffer.concat([Buffer.from(`P5\n${n} ${n}\n255\n`), px]),
      );
      writeFileSync(`${process.env.QR_DUMP}/qr-${i}.txt`, t);
    });
    expect(true).toBe(true);
  });
});
