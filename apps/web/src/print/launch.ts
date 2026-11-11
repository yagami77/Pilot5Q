/**
 * Ouverture de la vue A4 et lancement de l'impression.
 *
 * « Imprimer » ouvre la vue A4 avec `?imprimer=1` : la vue lance elle-même la boîte d'impression
 * du navigateur dès que le document est prêt (`whenPrintReady`). « Aperçu » ouvre la même vue
 * sans le paramètre. Dans la boîte d'impression, la destination « Enregistrer au format PDF »
 * garde le document pour plus tard.
 */

/** Paramètre d'adresse qui demande l'impression directe à l'ouverture de la vue A4. */
export const AUTO_PRINT_PARAM = "imprimer";

/** Chemin (routeur) de la vue A4 d'un ou plusieurs documents. */
export function printPath(ids: readonly string[], print = false): string {
  return `/tournoi/imprimer/${ids.join("+")}${print ? `?${AUTO_PRINT_PARAM}=1` : ""}`;
}

/**
 * Ouvre la vue A4 dans un nouvel onglet. Renvoie `false` si le navigateur a bloqué
 * l'ouverture : l'appelant navigue alors dans l'onglet courant.
 *
 * Pas d'option « noopener » : avec elle `window.open` renvoie toujours `null`, ce qui faisait
 * aussi partir l'onglet du cockpit sur la vue d'impression.
 */
export function openPrintView(ids: readonly string[], print: boolean): boolean {
  const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${printPath(ids, print)}`;
  return window.open(url, "_blank") !== null;
}

/** Graisses utilisées par les documents (chargées à la demande par le navigateur). */
const FACES = [
  '400 12px "Geist"',
  '500 12px "Geist"',
  '600 12px "Geist"',
  '700 12px "Geist"',
  '800 12px "Geist"',
  '500 12px "Geist Mono"',
  '700 12px "Geist Mono"',
];

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });

/**
 * Attend que le document soit prêt à être imprimé : polices chargées (elles arrivent en
 * `display=swap` : sans attente, le PDF partirait avec la police de secours et des largeurs
 * différentes), images décodées, mise en page terminée (deux images de rendu). Sans réseau,
 * les polices ne viendront pas : l'attente est plafonnée par `timeout` et l'impression part
 * avec les polices du système.
 */
export async function whenPrintReady(root: ParentNode = document, timeout = 4000): Promise<void> {
  const ready = async () => {
    // Une première image de rendu : le texte est mis en page, ses polices sont demandées
    await nextFrame();
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts) {
      await Promise.all(FACES.map((f) => fonts.load(f).catch(() => undefined)));
      await fonts.ready.catch(() => undefined);
    }
    await Promise.all(
      [...root.querySelectorAll("img")].map((img) =>
        img.complete ? undefined : img.decode().catch(() => undefined),
      ),
    );
    await nextFrame();
    await nextFrame();
  };
  await Promise.race([ready(), new Promise<void>((resolve) => setTimeout(resolve, timeout))]);
}
