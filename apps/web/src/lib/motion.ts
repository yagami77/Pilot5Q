/** Aides pour le mouvement : préférence de l'utilisateur, attente, confettis. */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Confettis aux couleurs du tournoi, centrés sur un élément. */
export async function celebrate(el: Element | null, particleCount = 140): Promise<void> {
  if (prefersReducedMotion()) return;
  const { default: confetti } = await import("canvas-confetti");
  const rect = el?.getBoundingClientRect();
  const origin = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: Math.max(0.05, rect.top / window.innerHeight),
      }
    : { x: 0.5, y: 0.3 };
  void confetti({
    particleCount,
    spread: 70,
    origin,
    colors: ["#0E37A8", "#FFFFFF", "#DC3F5A", "#E89F1F"],
  });
}
