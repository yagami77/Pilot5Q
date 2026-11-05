/**
 * Mise en page des feuilles de match : A4 paysage, deux demi-feuilles (A5) côte à côte.
 *
 * Les poules sont regroupées par billard (mêmes billards = même groupe) :
 * - un groupe de 2 poules occupe une page entière (les deux poules du billard ensemble) ;
 * - un groupe de 3 poules (deux billards liés) occupe une page et demie ;
 * - les demi-pages restantes (3e poule d'un groupe de 3, poule seule sur son billard) sont
 *   appariées entre elles, dans l'ordre des billards.
 */

export interface SheetItem<T> {
  item: T;
  billards: number[];
}

/** Clé de groupe : billards triés (« 5+6 »), vide si aucun billard. */
export function billardKey(billards: number[]): string {
  return [...billards].sort((a, b) => a - b).join("+");
}

/** Groupes de poules par billard(s), dans l'ordre des billards. */
export function groupByBillard<T>(items: SheetItem<T>[]): SheetItem<T>[][] {
  const groups = new Map<string, SheetItem<T>[]>();
  for (const it of items) {
    const k = billardKey(it.billards);
    const g = groups.get(k) ?? [];
    g.push(it);
    groups.set(k, g);
  }
  const first = (g: SheetItem<T>[]) => Math.min(...(g[0]?.billards ?? []), Number.MAX_SAFE_INTEGER);
  return [...groups.values()].sort((a, b) => first(a) - first(b));
}

/** Pages de deux demi-feuilles (la seconde peut manquer sur la dernière page). */
export function paginateHalves<T>(items: SheetItem<T>[]): T[][] {
  const pages: { order: number; halves: T[] }[] = [];
  const singles: { order: number; item: T }[] = [];
  groupByBillard(items).forEach((g, gi) => {
    for (let i = 0; i + 1 < g.length; i += 2) {
      pages.push({ order: gi + i / 10, halves: [g[i]!.item, g[i + 1]!.item] });
    }
    if (g.length % 2 === 1) singles.push({ order: gi + 0.5, item: g[g.length - 1]!.item });
  });
  for (let i = 0; i < singles.length; i += 2) {
    const a = singles[i]!;
    const b = singles[i + 1];
    pages.push({ order: a.order, halves: b ? [a.item, b.item] : [a.item] });
  }
  return pages.sort((x, y) => x.order - y.order).map((p) => p.halves);
}

/** Découpe simple deux par deux (barrages, phases finales). */
export function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}
