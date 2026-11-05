/**
 * Serpentin du tirage : grille poules × lignes, chemin en zigzag qui se trace en SVG avec
 * une tête lumineuse, joueurs qui se posent un par un dans l'ordre du serpentin
 * (≈ 2,6 s au total), têtes de poule marquées, cellules en conflit de club en rouge.
 */
import type { Poule } from "@pilot5q/domain";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { nice } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";

import { Avatar, cx } from "./ui";

const CELL_W = 74;
const CELL_H = 52;
const GAP = 8;
const HEAD_H = 34;
const TOTAL = 2600;

export function Serpentin({
  poules,
  animate,
  conflicts,
  onDone,
}: {
  poules: Poule[];
  /** Rejoue l'animation (changement de valeur = nouveau tirage). */
  animate: number;
  conflicts?: Set<number>;
  onDone?: () => void;
}) {
  const rows = Math.max(0, ...poules.map((p) => p.players.length));
  const order = useMemo(() => {
    const out: { col: number; row: number; name: string }[] = [];
    for (let r = 0; r < rows; r++) {
      const idx = poules.map((_, i) => i);
      if (r % 2) idx.reverse();
      for (const i of idx) {
        const name = poules[i]?.players[r];
        if (name) out.push({ col: i, row: r, name });
      }
    }
    return out;
  }, [poules, rows]);

  const [filled, setFilled] = useState<Set<string>>(() => new Set());
  const [drawing, setDrawing] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const seq = useRef(0);

  // Coordonnées des centres de cellules (grille fixe : calcul direct, sans mesure)
  const center = (col: number, row: number): [number, number] => [
    col * (CELL_W + GAP) + CELL_W / 2,
    HEAD_H + row * (CELL_H + GAP) + CELL_H / 2,
  ];
  const d = order.map((o, i) => `${i ? "L" : "M"}${center(o.col, o.row).join(",")}`).join(" ");
  const width = poules.length * (CELL_W + GAP) - GAP;
  const height = HEAD_H + rows * (CELL_H + GAP) - GAP;

  useLayoutEffect(() => {
    seq.current += 1;
    const my = seq.current;
    if (animate === 0 || prefersReducedMotion()) {
      setFilled(new Set(order.map((o) => `${o.col}-${o.row}`)));
      setDrawing(false);
      if (animate > 0) onDone?.();
      return;
    }
    setFilled(new Set());
    setDrawing(true);
    const timers: number[] = [];
    order.forEach((o, k) => {
      timers.push(
        window.setTimeout(
          () => {
            if (seq.current !== my) return;
            setFilled((f) => new Set(f).add(`${o.col}-${o.row}`));
          },
          (k / order.length) * TOTAL + 60,
        ),
      );
    });
    timers.push(
      window.setTimeout(() => {
        if (seq.current === my) {
          setDrawing(false);
          onDone?.();
        }
      }, TOTAL + 400),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // `order` dérive des poules ; un nouveau tirage change `animate`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  useEffect(() => {
    if (!drawing) return;
    const head = headRef.current;
    const path = pathRef.current;
    if (!head || !path || typeof path.animate !== "function") return;
    path.style.strokeDasharray = "1";
    path.style.strokeDashoffset = "1";
    const pa = path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: TOTAL,
      easing: "cubic-bezier(.3,.7,.2,1)",
      fill: "forwards",
    });
    const ha = head.animate(
      [
        { offsetDistance: "0%", opacity: 1 },
        { offsetDistance: "100%", opacity: 1 },
        { offsetDistance: "100%", opacity: 0 },
      ],
      { duration: TOTAL + 300, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" },
    );
    return () => {
      pa.cancel();
      ha.cancel();
    };
  }, [drawing, d]);

  return (
    <div className="overflow-x-auto px-4 pt-3 pb-4">
      <div className="relative" style={{ width, height, minWidth: width }}>
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={width}
          height={height}
          aria-hidden="true"
        >
          <path
            ref={pathRef}
            d={d}
            pathLength={1}
            fill="none"
            stroke="#4f7bf0"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
            style={drawing ? undefined : { strokeDasharray: "none" }}
          />
        </svg>
        {drawing ? (
          <div
            ref={headRef}
            className="bg-brand-light absolute top-0 left-0 z-[3] size-3.5 rounded-full opacity-0 shadow-[0_0_0_5px_rgb(30_79_216/0.18),0_0_18px_4px_rgb(30_79_216/0.35)]"
            style={{ offsetPath: `path("${d}")`, offsetRotate: "0deg" }}
            aria-hidden="true"
          />
        ) : null}
        {poules.map((p, col) => (
          <div
            key={p.num}
            className="absolute top-0"
            style={{ left: col * (CELL_W + GAP), width: CELL_W }}
          >
            <div className="text-ink-muted h-[34px] text-center text-[10.5px] font-extrabold tracking-[0.06em] uppercase">
              Poule
              <b className="text-ink block text-[12px] tracking-normal normal-case">{p.num}</b>
            </div>
            {Array.from({ length: rows }, (_, row) => {
              const name = p.players[row];
              const on = name !== undefined && filled.has(`${col}-${row}`);
              const conflict = on && conflicts?.has(p.num);
              return (
                <div
                  key={row}
                  className={cx(
                    "relative mt-2 flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[12px] transition-[border-color,background-color] duration-300",
                    on
                      ? "bg-surface border-line shadow-card border"
                      : "bg-surface-2 border-line-2 border-[1.5px] border-dashed",
                    conflict && "border-alert bg-alert-soft",
                  )}
                >
                  {on && name ? (
                    <>
                      <span className="animate-pop">
                        <Avatar name={name} size="sm" className="size-[22px] text-[9px]" />
                      </span>
                      <span className="text-ink-secondary max-w-[66px] truncate text-[9.5px] font-bold">
                        {nice(name).split(" ")[0]}
                      </span>
                      {row === 0 ? (
                        <span className="bg-gold absolute -top-1.5 -right-1 rounded-[5px] px-1 text-[8px] font-extrabold text-white">
                          TS
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
