/** Bandes de qualification du classement glissant (badges de l'application 5 Quilles). */
export interface Band {
  from: number;
  to: number;
  /** Nom court (puce). */
  label: string;
  /** Titre de la bande dans le tableau. */
  title: string;
  tone: "gold" | "blue" | "green";
}

export const BANDS: Band[] = [
  {
    from: 1,
    to: 8,
    label: "Masters directs",
    title: "Masters directs · places 1 à 8",
    tone: "gold",
  },
  { from: 9, to: 16, label: "Places 9 à 16", title: "Places 9 à 16", tone: "blue" },
  {
    from: 17,
    to: 34,
    label: "Finales nationales",
    title: "Finales nationales · places 17 à 34",
    tone: "green",
  },
];

export function bandOf(position: number): Band | null {
  return BANDS.find((b) => position >= b.from && position <= b.to) ?? null;
}
