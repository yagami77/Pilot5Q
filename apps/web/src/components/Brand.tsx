/**
 * Marque Pilot5Q : logo complet (« Pilot5Q » avec la quille et la bille) et pictogramme carré
 * (le P au calendrier) pour les petits espaces. Images fournies par le client.
 */
import logoUrl from "@/assets/pilot5q-logo.webp";
import markUrl from "@/assets/pilot5q-mark.webp";

import { cx } from "./ui";

/** Proportions du logo complet (largeur / hauteur). */
export const LOGO_RATIO = 1948 / 605;

/** Logo complet ; la hauteur se règle par la classe (`h-9`…), la largeur suit. */
export function BrandLogo({ className, alt = "Pilot5Q" }: { className?: string; alt?: string }) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      width={1200}
      height={373}
      decoding="async"
      draggable={false}
      className={cx("w-auto select-none", className)}
    />
  );
}

/** Pictogramme carré de la marque. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={markUrl}
      alt=""
      aria-hidden="true"
      width={160}
      height={160}
      decoding="async"
      draggable={false}
      className={cx("size-[36px] shrink-0 select-none object-contain", className)}
    />
  );
}

export { logoUrl, markUrl };
