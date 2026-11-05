/** Nombre dont chaque chiffre roule comme un compteur mécanique. */
import { useEffect, useRef, useState } from "react";

import { cx } from "./ui";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function RollingNumber({
  value,
  className,
  duration = 450,
}: {
  /** Nombre, ou texte (« – ») affiché tel quel. */
  value: number | string | null | undefined;
  className?: string;
  duration?: number;
}) {
  const text = value === null || value === undefined ? "–" : String(value);
  // Au premier rendu, on part de 0 pour que les chiffres roulent jusqu'à la valeur.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(t);
  }, []);
  const prev = useRef(text);
  useEffect(() => {
    prev.current = text;
  }, [text]);
  return (
    <span
      className={cx("inline-flex tabular-nums", className)}
      aria-label={text}
      role="text"
      style={{ lineHeight: 1 }}
    >
      {[...text].map((ch, i) => {
        const idx = DIGITS.indexOf(ch);
        if (idx < 0)
          return (
            <span key={`${i}-${ch}`} aria-hidden="true">
              {ch === " " ? "\u00A0" : ch}
            </span>
          );
        const shown = mounted ? idx : 0;
        return (
          <span
            key={i}
            aria-hidden="true"
            className="relative inline-block overflow-hidden"
            style={{ height: "1em", width: "0.62em" }}
          >
            <span
              className="absolute top-0 left-0 flex flex-col"
              style={{
                transform: `translateY(${-shown}em)`,
                transition: `transform ${duration}ms cubic-bezier(.2,.8,.2,1)`,
              }}
            >
              {DIGITS.map((d) => (
                <span key={d} style={{ height: "1em", lineHeight: 1 }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Compteur qui monte progressivement vers `target` (compteurs d'inscrits, totaux). */
export function useCountUp(target: number, duration = 1100): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setV(target);
      return;
    }
    const from = v;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (target - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `from` est la valeur courante au moment du changement de cible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return v;
}
