/**
 * Diagramme de flux du week-end : rubans proportionnels qui se dessinent, compteurs animés,
 * survol qui éclaire un parcours, étapes terminées en couleur pleine et à venir en pointillé.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { buildFlow, flowPath, type FlowNode, type FlowNodeId } from "@/lib/flow";
import { prefersReducedMotion } from "@/lib/motion";
import { useTournament } from "@/store/tournament";

import { useCountUp } from "./RollingNumber";
import { cx } from "./ui";

const NW = 190;
const NH = 66;
const COLS = [120, 400, 680, 960, 1240, 1520];
const VW = 1640;
const VH = 560;
const DAYS: [string, number][] = [
  ["Jeudi", 0],
  ["Vendredi", 1],
  ["Samedi", 3],
  ["Dimanche", 5],
];

function widthOf(n: number): number {
  return 3 + n * 0.78;
}

export function FlowDiagram({
  animate = true,
  replayKey = 0,
  print = false,
  className,
}: {
  animate?: boolean;
  /** Changement de valeur = rejouer l'animation. */
  replayKey?: number;
  /** Version imprimable : sans animation ni survol. */
  print?: boolean;
  className?: string;
}) {
  const { state } = useTournament();
  const model = useMemo(() => buildFlow(state), [state]);
  const [hot, setHot] = useState<FlowNodeId | null>(null);
  const keep = hot ? flowPath(model, hot) : null;
  const svgRef = useRef<SVGSVGElement>(null);
  const live = animate && !print;

  // Rubans calculés : ports empilés pour éviter les chevauchements
  const ribbons = useMemo(() => {
    const outOff = new Map<FlowNodeId, number>();
    const inOff = new Map<FlowNodeId, number>();
    const byId = new Map(model.nodes.map((n) => [n.id, n]));
    return model.links.map((l) => {
      const A = byId.get(l.from) as FlowNode;
      const B = byId.get(l.to) as FlowNode;
      const w = widthOf(l.n);
      const totalOut = model.links
        .filter((f) => f.from === l.from)
        .reduce((s, f) => s + widthOf(f.n), 0);
      const totalIn = model.links
        .filter((f) => f.to === l.to)
        .reduce((s, f) => s + widthOf(f.n), 0);
      if (!outOff.has(l.from)) outOff.set(l.from, -totalOut / 2);
      if (!inOff.has(l.to)) inOff.set(l.to, -totalIn / 2);
      const y1 = A.y + (outOff.get(l.from) ?? 0) + w / 2;
      outOff.set(l.from, (outOff.get(l.from) ?? 0) + w);
      const y2 = B.y + (inOff.get(l.to) ?? 0) + w / 2;
      inOff.set(l.to, (inOff.get(l.to) ?? 0) + w);
      const x1 = (COLS[A.col] ?? 0) + NW / 2;
      const x2 = (COLS[B.col] ?? 0) - NW / 2;
      const mx = (x1 + x2) / 2;
      return { ...l, w, col: A.col, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` };
    });
  }, [model]);

  // Dessin progressif des rubans, colonne par colonne
  useEffect(() => {
    if (!live) return;
    const svg = svgRef.current;
    if (!svg) return;
    const reduced = prefersReducedMotion();
    const paths = svg.querySelectorAll<SVGPathElement>("path[data-ribbon]");
    const anims: Animation[] = [];
    paths.forEach((p) => {
      if (typeof p.animate !== "function") return;
      const col = Number(p.dataset.col ?? 0);
      anims.push(
        p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: reduced ? 1 : 900,
          delay: reduced ? 0 : col * 420,
          easing: "cubic-bezier(.3,.7,.2,1)",
          fill: "forwards",
        }),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [live, replayKey, ribbons]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      role="img"
      aria-label="Schéma du tournoi : flux des joueurs du jeudi au dimanche"
      className={cx("block h-auto w-full", print ? "min-w-0" : "min-w-[900px]", className)}
      onMouseLeave={() => setHot(null)}
    >
      {DAYS.map(([d, c]) => {
        const x = COLS[c] ?? 0;
        return (
          <g key={d}>
            <text
              x={x}
              y={28}
              textAnchor="middle"
              className="fill-ink-muted font-sans text-[11px] font-extrabold tracking-[0.12em] uppercase"
            >
              {d}
            </text>
            {c > 0 ? (
              <line
                x1={x - 140}
                x2={x - 140}
                y1={40}
                y2={VH - 10}
                stroke="var(--color-line)"
                strokeDasharray="3 5"
              />
            ) : null}
          </g>
        );
      })}
      {ribbons.map((r) => {
        const on = keep ? keep.has(r.from) && keep.has(r.to) : null;
        return (
          <path
            key={`${r.from}-${r.to}`}
            d={r.d}
            data-ribbon="true"
            data-col={r.col}
            fill="none"
            stroke={r.color}
            strokeWidth={r.w}
            pathLength={1}
            strokeDasharray={r.done ? undefined : "0.02 0.012"}
            style={{
              opacity: on === null ? (r.done ? 0.55 : 0.28) : on ? 0.92 : 0.08,
              transition: "opacity .35s",
              strokeDashoffset: live ? 1 : 0,
              ...(live && r.done ? { strokeDasharray: "1" } : {}),
            }}
          />
        );
      })}
      {model.nodes.map((n) => (
        <Node
          key={`${n.id}-${replayKey}`}
          node={n}
          dim={keep ? !keep.has(n.id) : false}
          hot={keep ? keep.has(n.id) : false}
          animate={live}
          onHover={print ? undefined : setHot}
        />
      ))}
    </svg>
  );
}

function Node({
  node,
  dim,
  hot,
  animate,
  onHover,
}: {
  node: FlowNode;
  dim: boolean;
  hot: boolean;
  animate: boolean;
  onHover?: (id: FlowNodeId | null) => void;
}) {
  const x = (COLS[node.col] ?? 0) - NW / 2;
  const y = node.y - NH / 2;
  const count = useCountUp(animate ? node.n : node.n, animate ? 1200 : 1);
  const shown = animate ? count : node.n;
  return (
    <g
      className={cx("cursor-pointer transition-opacity duration-300", dim && "opacity-35")}
      onMouseEnter={() => onHover?.(node.id)}
      onClick={() => onHover?.(node.id)}
      tabIndex={onHover ? 0 : undefined}
      onFocus={() => onHover?.(node.id)}
      aria-label={`${node.label} : ${node.n}`}
    >
      <rect
        x={x}
        y={y}
        width={NW}
        height={NH}
        rx={14}
        fill="#fff"
        stroke={
          hot
            ? "var(--color-brand-light)"
            : node.done
              ? "var(--color-line-2)"
              : "var(--color-line-2)"
        }
        strokeWidth={hot ? 1.5 : 1}
        strokeDasharray={node.done ? undefined : "5 4"}
        style={{
          filter: hot
            ? "drop-shadow(0 10px 22px rgb(14 55 168 / 0.22))"
            : "drop-shadow(0 6px 14px rgb(14 55 168 / 0.10))",
          transition: "stroke .3s, filter .3s",
        }}
      />
      <rect
        x={x}
        y={y + 10}
        width={5}
        height={NH - 20}
        rx={2.5}
        fill={node.color}
        opacity={node.done ? 1 : 0.45}
      />
      <text x={x + 16} y={y + 26} className="fill-ink font-sans text-[13px] font-bold">
        {node.label}
      </text>
      <text x={x + 16} y={y + 45} className="fill-ink-muted font-sans text-[10.5px] font-medium">
        {node.sub.length > 27 ? `${node.sub.slice(0, 26)}…` : node.sub}
      </text>
      <text
        x={x + NW - 14}
        y={y + 42}
        textAnchor="end"
        className={cx(
          "font-mono text-[22px] font-extrabold",
          node.done ? "fill-brand" : "fill-ink-muted",
        )}
      >
        {shown}
      </text>
    </g>
  );
}
