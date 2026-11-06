/**
 * Classement glissant : frise de la fenêtre (le TN sorti, les 5 TN qui comptent), podium,
 * tableau avec bandes de qualification, colonne du TN sorti, résultat non compté, parcours de
 * chaque joueur en volet, export CSV et PDF.
 */
import {
  latestStage,
  leftStage,
  rankingCsv,
  rankingRows,
  resultAt,
  windowStages,
  type RankingRow,
  type StageRef,
  type WindowCell,
} from "@pilot5q/domain";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  FileDown,
  LogOut,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Button, Card, Chip, PageHead, cx } from "@/components/ui";
import { clubShort, nice, ordinal } from "@/lib/format";

import { DEMO_LEFT_STAGE, SEASON_FIXTURE } from "./demo";
import { compareWithReference, type ReferenceComparison } from "./reference";
import { useSeasonDoc } from "./store";
import { Empty, dec, downloadText } from "./ui";

const MAX_TN_POINTS = 80;

/** Bandes de qualification (badges de l'application 5 Quilles). */
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

const BAND_ROW: Record<Band["tone"], string> = {
  gold: "bg-gold-soft text-gold-ink",
  blue: "bg-brand-soft text-brand-ink",
  green: "bg-ok-soft text-ok-ink",
};
const BAND_POS: Record<Band["tone"], string> = {
  gold: "bg-gold-soft text-gold-ink border-gold/60",
  blue: "bg-brand-soft text-brand-ink border-brand-light/50",
  green: "bg-ok-soft text-ok-ink border-ok/50",
};

/** Hachures légères : ce qui ne compte plus. */
const HATCHED =
  "bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(107_122_153/0.09)_5px_6px)]";

/** « TN 2 » et saison courte « 25-26 ». */
const tnLabel = (s: StageRef): string => `TN ${s.tn}`;
const stageText = (s: StageRef): string => `${tnLabel(s)} ${s.season}`;

/** Points « 266,093 » : entier en gras, décimale en petit. */
export function Points({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [int, frac] = dec(value, 3).split(",");
  const sizes = {
    sm: ["text-[12.5px]", "text-[10px]"],
    md: ["text-[14px]", "text-[10.5px]"],
    lg: ["text-[22px]", "text-[13px]"],
    xl: ["text-[34px]", "text-[16px]"],
  }[size];
  return (
    <span className={cx("font-mono leading-none tabular-nums", className)}>
      <b className={cx("font-bold tracking-[-0.02em]", sizes[0])}>{int}</b>
      <span className={cx("text-ink-muted font-medium", sizes[1])}>,{frac}</span>
    </span>
  );
}

/** Évolution de place : flèche et écart, animés à l'apparition. */
export function Delta({ value, isNew }: { value: number | null; isNew: boolean }) {
  if (value === null)
    return isNew ? (
      <Chip tone="blue" className="px-2 py-[2px] text-[10.5px]">
        nouveau
      </Chip>
    ) : (
      <span className="text-ink-muted/60">–</span>
    );
  if (value === 0) return <span className="text-ink-muted font-mono text-[12px]">=</span>;
  const up = value > 0;
  return (
    <motion.span
      initial={{ opacity: 0, y: up ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx(
        "inline-flex items-center gap-0.5 font-mono text-[12px] font-bold tabular-nums",
        up ? "text-ok-ink" : "text-alert-ink",
      )}
      aria-label={up ? `monte de ${value}` : `descend de ${-value}`}
    >
      {up ? (
        <ArrowUp className="size-3" strokeWidth={3} aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3" strokeWidth={3} aria-hidden="true" />
      )}
      {Math.abs(value)}
    </motion.span>
  );
}

/** Barres miniatures du parcours : le TN sorti (hachuré), puis les 5 TN de la fenêtre. */
export function MiniBars({ row, size = "sm" }: { row: RankingRow; size?: "sm" | "lg" }) {
  const h = size === "lg" ? 44 : 18;
  const w = size === "lg" ? "w-[12px]" : "w-[7px]";
  const cells: { label: string; pts: number | null; kind: "left" | "dropped" | "last" | "ok" }[] = [
    { label: `${stageText(row.left)} · sorti`, pts: row.left.pts, kind: "left" },
    ...row.window.map((w, i) => ({
      label: stageText(w),
      pts: w.pts,
      kind: (w.pts !== null && !w.counted
        ? "dropped"
        : i === row.window.length - 1
          ? "last"
          : "ok") as "dropped" | "last" | "ok",
    })),
  ];
  return (
    <span
      className="flex items-end gap-[3px]"
      style={{ height: h }}
      aria-label={cells
        .map((c) => `${c.label} : ${c.pts === null ? "non joué" : dec(c.pts, 3)}`)
        .join(", ")}
    >
      {cells.map((c, i) => {
        const height =
          c.pts === null
            ? 3
            : Math.max(3, Math.round((Math.min(c.pts, MAX_TN_POINTS) / MAX_TN_POINTS) * h));
        return (
          <span
            key={i}
            className={cx(
              "rounded-t-[2px] transition-[height,opacity,background-color] duration-500",
              w,
              c.pts === null && "bg-line-2",
              c.pts !== null && c.kind === "left" && cx("bg-line-2", HATCHED),
              c.pts !== null &&
                c.kind === "dropped" &&
                "border-brand/60 border border-b-0 border-dashed bg-transparent",
              c.pts !== null && c.kind === "ok" && "bg-brand opacity-80 group-hover:opacity-100",
              c.pts !== null && c.kind === "last" && "bg-brand-light",
            )}
            style={{ height }}
            title={
              c.pts === null
                ? `${c.label} : non joué`
                : `${c.label} : ${dec(c.pts, 3)}${
                    c.kind === "dropped"
                      ? " (non compté : 4 meilleurs sur 5)"
                      : c.kind === "left"
                        ? " (ne compte plus)"
                        : ""
                  }`
            }
          />
        );
      })}
    </span>
  );
}

/* ---------- Frise de la fenêtre ---------- */

function WindowStrip({
  left,
  stages,
  last,
  counts,
}: {
  left: StageRef;
  stages: StageRef[];
  last: StageRef;
  counts: { ranked: number; five: number; played: number };
}) {
  const chips: {
    stage: StageRef;
    kind: "left" | "oldest" | "mid" | "last";
  }[] = [
    { stage: left, kind: "left" },
    ...stages.map((s, i) => ({
      stage: s,
      kind: (i === 0 ? "oldest" : i === stages.length - 1 ? "last" : "mid") as
        "oldest" | "mid" | "last",
    })),
  ];
  return (
    <Card className="animate-fade-up mb-4 overflow-hidden" bodyClassName="px-4 pt-3.5 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Fenêtre des 5 derniers TN</div>
          <p className="text-ink-muted mt-0.5 text-[12.5px]">
            Chaque joueur compte ses 4 meilleurs résultats sur ces 5 TN (somme simple en dessous de
            5) ; points du barème + décimale de départage (points de set / matchs / 100) ; départage
            par la moyenne (faits / subis).
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="blue">{counts.ranked} classés</Chip>
          <Chip>{counts.five} avec 5 TN</Chip>
          <Chip>
            {counts.played} au {tnLabel(last)}
          </Chip>
        </div>
      </div>
      <div className="mt-3.5 flex items-stretch gap-0 overflow-x-auto pb-1">
        {chips.map((c, i) => (
          <div key={i} className="flex items-stretch">
            {i > 0 ? (
              <div className="flex w-5 shrink-0 items-center justify-center md:w-7">
                <ArrowRight
                  className={cx("size-3.5", i === 1 ? "text-line-2" : "text-brand/40")}
                  aria-hidden="true"
                />
              </div>
            ) : null}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className={cx(
                "flex min-w-[118px] flex-col justify-between rounded-[12px] border px-3 py-2",
                c.kind === "left" &&
                  cx("border-line-2 text-ink-muted border-dashed bg-transparent", HATCHED),
                c.kind === "oldest" && "border-gold/50 bg-gold-soft/40 text-ink",
                c.kind === "mid" && "border-line bg-surface-2 text-ink",
                c.kind === "last" &&
                  "bg-brand border-transparent text-white shadow-[0_10px_24px_-10px_rgb(14_55_168/0.7)]",
              )}
              title={
                c.kind === "left"
                  ? `${stageText(c.stage)} : sorti de la fenêtre à la clôture du ${tnLabel(last)}, ses points ne comptent plus.`
                  : c.kind === "oldest"
                    ? `${stageText(c.stage)} : plus ancien TN de la fenêtre, il sortira à la prochaine clôture.`
                    : c.kind === "last"
                      ? `${stageText(c.stage)} : dernier TN clôturé.`
                      : stageText(c.stage)
              }
            >
              <span
                className={cx(
                  "text-[10.5px] font-bold tracking-[0.07em] uppercase",
                  c.kind === "last" ? "text-white/70" : "text-ink-muted",
                )}
              >
                {c.stage.season}
              </span>
              <span
                className={cx(
                  "font-mono text-[20px] leading-tight font-extrabold tracking-[-0.03em]",
                  c.kind === "left" && "line-through decoration-[1.5px]",
                )}
              >
                {tnLabel(c.stage)}
              </span>
              <span
                className={cx(
                  "mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold",
                  c.kind === "last" ? "text-white/85" : "text-ink-muted",
                  c.kind === "oldest" && "text-gold-ink",
                )}
              >
                {c.kind === "left" ? (
                  <>
                    <LogOut className="size-3" aria-hidden="true" /> sorti au {tnLabel(last)}
                  </>
                ) : c.kind === "oldest" ? (
                  <>
                    <LogOut className="size-3" aria-hidden="true" /> sort au prochain TN
                  </>
                ) : c.kind === "last" ? (
                  "dernier TN · clôturé"
                ) : (
                  "compte"
                )}
              </span>
            </motion.div>
          </div>
        ))}
      </div>
      <div className="text-ink-muted mt-1.5 flex justify-between text-[10.5px] font-semibold tracking-[0.06em] uppercase">
        <span>← Sorti · plus ancien</span>
        <span>Plus récent →</span>
      </div>
    </Card>
  );
}

/* ---------- Podium ---------- */

function Podium({ rows, onSelect }: { rows: RankingRow[]; onSelect: (r: RankingRow) => void }) {
  const [first, second, third] = rows;
  if (!first) return null;
  const order = [second, first, third].filter((r): r is RankingRow => r !== undefined);
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3 md:items-end">
      {order.map((r, i) => {
        const top = r.position === 1;
        return (
          <motion.button
            key={r.licence || r.name}
            type="button"
            onClick={() => onSelect(r)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className={cx(
              "card relative overflow-hidden text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-raised",
              top ? "px-5 pt-4 pb-5 md:order-none" : "px-4 pt-3.5 pb-4",
              top && "border-gold/40 bg-[linear-gradient(180deg,#fffaf0,#ffffff_55%)]",
            )}
          >
            <span
              className={cx(
                "absolute top-0 right-0 h-full w-1",
                top ? "bg-gold" : r.position === 2 ? "bg-line-2" : "bg-[#d7a46b]",
              )}
              aria-hidden="true"
            />
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "font-mono leading-none font-extrabold tracking-[-0.05em] tabular-nums",
                  top ? "text-gold text-[56px]" : "text-ink-muted text-[40px]",
                )}
              >
                {r.position}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cx("truncate font-extrabold", top ? "text-[18px]" : "text-[15px]")}
                  >
                    {nice(r.name)}
                  </span>
                  <Delta value={r.delta} isNew={false} />
                </div>
                <div className="text-ink-muted truncate text-[12px]">{clubShort(r.club)}</div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <Points value={r.pts} size={top ? "xl" : "lg"} />
                  <MiniBars row={r} size="lg" />
                </div>
                <div className="text-ink-muted mt-1.5 text-[11px]">
                  moyenne {dec(r.moy, 3)} · {r.count} TN
                  {r.dropped ? ` · ${dec(r.dropped.pts, 3)} non comptés` : ""}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ---------- Tableau ---------- */

function Th({
  children,
  className,
  title,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  right?: boolean;
}) {
  return (
    <th
      title={title}
      className={cx(
        "bg-surface-2 border-line sticky top-[60px] z-10 border-b px-2.5 py-1.5 align-bottom text-[10.5px] font-bold tracking-[0.07em] whitespace-nowrap uppercase",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Cellule d'un TN de la fenêtre : « 80,020 », entourée en pointillé si non comptée. */
function WindowTd({ cell, row }: { cell: WindowCell; row: RankingRow }) {
  if (cell.pts === null)
    return (
      <td className="group-hover:bg-brand-soft/50 px-2.5 py-1.5 text-right transition-colors">
        <span className="text-line-2 font-mono">–</span>
      </td>
    );
  const dropped = !cell.counted;
  return (
    <td className="group-hover:bg-brand-soft/50 px-2.5 py-1.5 text-right transition-colors">
      <span
        className={cx(
          "inline-block rounded-[6px] px-1 font-mono text-[12px] tabular-nums",
          dropped && "border-brand/50 text-ink-muted -mx-px border border-dashed px-[3px] py-px",
        )}
        title={
          dropped
            ? `Non compté : ${dec(cell.pts, 3)} pts est le plus faible des 5 résultats de ${nice(row.name)} (règle des 4 meilleurs sur 5).`
            : `${stageText(cell)} : ${dec(cell.pts, 3)} pts`
        }
      >
        {dec(cell.pts, 3)}
      </span>
    </td>
  );
}

function BandRow({ band, cols }: { band: Band | null; cols: number }) {
  return (
    <tr>
      <td
        colSpan={cols}
        className={cx(
          "px-3 py-[5px] text-[10.5px] font-bold tracking-[0.07em] uppercase",
          band ? BAND_ROW[band.tone] : "bg-surface-2 text-ink-muted",
        )}
      >
        {band ? band.title : "Places 35 et au-delà"}
      </td>
    </tr>
  );
}

/* ---------- Volet joueur ---------- */

function PlayerPanel({
  row,
  last,
  onClose,
}: {
  row: RankingRow | null;
  last: StageRef;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, onClose]);
  const band = row ? bandOf(row.position) : null;
  const steps = row
    ? [
        {
          stage: row.left as StageRef,
          res: resultAt(row.results, row.left),
          oldest: false,
          status: "sorti" as const,
        },
        ...row.window.map((w, i) => ({
          stage: w as StageRef,
          res: resultAt(row.results, w),
          oldest: i === 0,
          status: (w.pts !== null && !w.counted
            ? "non compté"
            : i === 0
              ? "sort au prochain TN"
              : i === row.window.length - 1
                ? "dernier TN"
                : "compte") as "non compté" | "sort au prochain TN" | "dernier TN" | "compte",
        })),
      ]
    : [];
  return (
    <AnimatePresence>
      {row ? (
        <>
          <motion.div
            key="scrim"
            role="presentation"
            className="fixed inset-0 z-40 bg-[rgb(15_27_51/0.28)] backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Parcours de ${nice(row.name)}`}
            className="bg-surface shadow-raised fixed top-0 right-0 z-50 flex h-full w-full max-w-[460px] flex-col overflow-y-auto"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="tricolore" />
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="min-w-0">
                <div className="eyebrow">
                  {ordinal(row.position)} · après le {tnLabel(last)} {last.season}
                </div>
                <h3 className="truncate text-[20px] font-extrabold tracking-[-0.02em]">
                  {nice(row.name)}
                </h3>
                <div className="text-ink-muted text-[12.5px]">
                  {clubShort(row.club)}
                  {row.licence ? (
                    <>
                      {" · "}
                      <span className="font-mono">{row.licence}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <Button size="sm" variant="ghost" icon={X} onClick={onClose} aria-label="Fermer" />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-5">
              {band ? (
                <Chip tone={band.tone}>
                  {band.label} · {band.from}–{band.to}
                </Chip>
              ) : null}
              <Delta value={row.delta} isNew={true} />
              {row.delta !== null && row.delta !== 0 ? (
                <span className="text-ink-muted text-[12px]">depuis le classement précédent</span>
              ) : null}
            </div>
            <div className="mx-5 mt-4 grid grid-cols-3 gap-2">
              <div className="card px-3 py-2.5">
                <div className="text-ink-muted text-[10.5px] font-bold tracking-[0.07em] uppercase">
                  Points
                </div>
                <Points value={row.pts} size="lg" />
              </div>
              <div className="card px-3 py-2.5">
                <div className="text-ink-muted text-[10.5px] font-bold tracking-[0.07em] uppercase">
                  Moyenne
                </div>
                <div className="font-mono text-[22px] leading-none font-bold tabular-nums">
                  {dec(row.moy, 3)}
                </div>
              </div>
              <div className="card px-3 py-2.5">
                <div className="text-ink-muted text-[10.5px] font-bold tracking-[0.07em] uppercase">
                  TN joués
                </div>
                <div className="font-mono text-[22px] leading-none font-bold tabular-nums">
                  {row.count}
                  <span className="text-ink-muted text-[13px]"> / 5</span>
                </div>
              </div>
            </div>
            <div className="mx-5 mt-4 flex items-center justify-between">
              <div className="eyebrow">Parcours</div>
              <MiniBars row={row} size="lg" />
            </div>
            <ol className="mx-5 mt-2 mb-6 flex flex-col gap-1.5">
              {steps.map((s, i) => {
                const out = s.status === "sorti";
                const dropped = s.status === "non compté";
                const base = s.res ? Math.floor(s.res.pts + 1e-9) : 0;
                const decimal = s.res ? s.res.pts - base : 0;
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.35 }}
                    className={cx(
                      "flex items-center gap-3 rounded-[12px] border px-3 py-2",
                      out && cx("border-line-2 text-ink-muted border-dashed", HATCHED),
                      !out && dropped && "border-brand/50 border-dashed",
                      !out && !dropped && "border-line bg-surface-2",
                      s.status === "dernier TN" && "border-brand-light/40 bg-brand-soft/60",
                    )}
                  >
                    <div className="w-[112px] shrink-0 whitespace-nowrap">
                      <div className="text-ink-muted text-[10px] font-bold tracking-[0.06em] uppercase">
                        {s.stage.season}
                      </div>
                      <div
                        className={cx(
                          "font-mono text-[15px] font-extrabold",
                          out && "line-through",
                        )}
                      >
                        {tnLabel(s.stage)}
                      </div>
                      {s.oldest ? (
                        <div className="text-gold-ink inline-flex items-center gap-0.5 text-[10px] font-semibold">
                          <LogOut className="size-2.5" aria-hidden="true" /> sort au prochain TN
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      {s.res ? (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={cx(
                                "font-mono text-[16px] font-bold tabular-nums",
                                out && "line-through",
                                dropped && "text-ink-muted",
                              )}
                            >
                              {dec(s.res.pts, 3)}
                            </span>
                            <span className="text-ink-muted text-[11px]">
                              = {base} + {dec(decimal, 3)}
                            </span>
                          </div>
                          <div className="text-ink-muted text-[11px]">
                            {s.res.faits} faits / {s.res.subis} subis · moy.{" "}
                            {s.res.subis > 0 ? dec(s.res.faits / s.res.subis, 3) : "–"}
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-muted text-[12.5px]">non joué</span>
                      )}
                    </div>
                    <span
                      className={cx(
                        "shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-bold whitespace-nowrap",
                        out && "bg-surface-2 text-ink-muted",
                        dropped && "bg-brand-soft text-brand-ink",
                        s.status === "sort au prochain TN" && "bg-gold-soft text-gold-ink",
                        s.status === "dernier TN" && "bg-brand text-white",
                        s.status === "compte" && "text-ok-ink bg-ok-soft",
                      )}
                    >
                      {out ? "ne compte plus" : s.status}
                    </span>
                  </motion.li>
                );
              })}
            </ol>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

/* ---------- Page ---------- */

export function Ranking() {
  const doc = useSeasonDoc();
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const lastClosure = useMemo(() => {
    const list = Object.values(doc.closures).sort((a, b) => a.closedAt.localeCompare(b.closedAt));
    return list[list.length - 1];
  }, [doc.closures]);
  const rows = useMemo(
    () => rankingRows(doc.ranking, { previous: lastClosure?.rankingBefore ?? null }),
    [doc.ranking, lastClosure],
  );
  const last = latestStage(doc.ranking);
  const stages = last ? windowStages(last.season, last.tn) : [];
  const left = last ? leftStage(last.season, last.tn) : null;
  const reference = useMemo(() => compareWithReference(rows), [rows]);
  const afterReference =
    reference.common === reference.expected &&
    reference.received === reference.expected &&
    reference.sameBarème === reference.expected;
  const clubs = useMemo(
    () =>
      [...new Set(rows.map((r) => r.club).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [rows],
  );
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (club === "" || r.club === club) &&
      (q === "" || `${r.name} ${r.club} ${r.licence}`.toLowerCase().includes(q)),
  );
  const selectedRow = selected
    ? (rows.find((r) => (r.licence || r.name) === selected) ?? null)
    : null;
  const counts = {
    ranked: rows.length,
    five: rows.filter((r) => r.count === 5).length,
    played: last ? rows.filter((r) => resultAt(r.results, last) !== undefined).length : 0,
  };
  const leftKnown = left ? rows.some((r) => r.left.pts !== null) : false;
  const cols = 9 + stages.length + 1;

  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}${last ? ` · après le ${tnLabel(last)}` : ""}`}
        title="Classement glissant"
        help={
          last
            ? `Classement glissant 5 Quilles après le ${tnLabel(last)} ${last.season} : les 5 derniers TN comptent, le ${left ? stageText(left) : ""} vient d'en sortir.`
            : "Le classement apparaîtra après la première clôture de TN."
        }
      >
        <Button
          icon={Download}
          onClick={() =>
            downloadText(`classement-glissant-${doc.id}.csv`, rankingCsv(rows, stages))
          }
          disabled={rows.length === 0}
        >
          Export CSV
        </Button>
        <Link to="/responsable/imprimer/classement?pdf=1">
          <Button variant="primary" icon={FileDown} disabled={rows.length === 0}>
            Télécharger le PDF
          </Button>
        </Link>
      </PageHead>

      {rows.length === 0 || !last || !left ? (
        <Card>
          <Empty icon={Trophy}>
            Aucun TN dans la fenêtre : le classement apparaîtra après la première clôture.
          </Empty>
        </Card>
      ) : (
        <>
          <WindowStrip left={left} stages={stages} last={last} counts={counts} />
          {afterReference ? <ReferenceBanner c={reference} /> : null}
          {!lastClosure && doc.id === SEASON_FIXTURE.season && last.tn === 1 ? (
            <div className="bg-brand-soft text-brand-ink mb-4 rounded-[12px] px-4 py-3 text-[12.5px]">
              Démonstration : fenêtre reconstituée à partir du classeur de référence (TN 3 à 5
              2025-2026 et TN 1 2026-2027), complétée par des résultats fictifs pour le{" "}
              {stageText(DEMO_LEFT_STAGE)} que le classeur ne contient pas. Clôturez le TN 2 pour
              obtenir le classement « après TN 2 » du classeur : le {stageText(DEMO_LEFT_STAGE)}{" "}
              sortira alors de la fenêtre.
            </div>
          ) : null}
          <Podium rows={rows} onSelect={(r) => setSelected(r.licence || r.name)} />
          <Card
            title={
              <span>
                {visible.length === rows.length
                  ? `${rows.length} joueurs classés`
                  : `${visible.length} sur ${rows.length} joueurs`}
              </span>
            }
            aside={
              <>
                <label className="relative">
                  <Search
                    className="text-ink-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    className="field w-[210px] pl-8"
                    placeholder="Nom, club, licence…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Rechercher dans le classement"
                  />
                </label>
                <select
                  className="field w-[210px]"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  aria-label="Filtrer par club"
                >
                  <option value="">Tous les clubs</option>
                  {clubs.map((c) => (
                    <option key={c} value={c}>
                      {clubShort(c)}
                    </option>
                  ))}
                </select>
              </>
            }
            bodyClassName="px-3 pb-3"
          >
            <div className="border-line rounded-[12px] border lg:overflow-visible overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <Th right className="pl-3.5">
                      Pos.
                    </Th>
                    <Th>Évol.</Th>
                    <Th>Joueur</Th>
                    <Th>Club</Th>
                    <Th>Licence</Th>
                    <Th right>Points</Th>
                    <Th right>Moy.</Th>
                    <Th right>TN</Th>
                    <Th
                      right
                      className={cx("text-ink-muted/80", HATCHED)}
                      title={`${stageText(left)} : sorti de la fenêtre à la clôture du ${tnLabel(last)}. Ces points ne comptent plus.`}
                    >
                      <span className="block text-[9.5px] font-semibold tracking-normal normal-case opacity-80">
                        {left.season}
                      </span>
                      <span className="line-through">{tnLabel(left)}</span>
                      <span className="ml-1 inline-flex items-center gap-0.5 font-medium normal-case">
                        <LogOut className="size-3" aria-hidden="true" />
                        sorti
                      </span>
                    </Th>
                    {stages.map((s, i) => (
                      <Th
                        key={`${s.season}-${s.tn}`}
                        right
                        className={cx(
                          i === stages.length - 1 && "text-brand",
                          i === 0 && "text-gold-ink",
                        )}
                        title={
                          i === 0
                            ? `${stageText(s)} : plus ancien TN de la fenêtre, il sortira à la prochaine clôture.`
                            : i === stages.length - 1
                              ? `${stageText(s)} : dernier TN clôturé.`
                              : stageText(s)
                        }
                      >
                        <span className="block text-[9.5px] font-semibold tracking-normal normal-case opacity-70">
                          {s.season}
                        </span>
                        {i === 0 ? (
                          <LogOut
                            className="mr-0.5 inline size-3 align-[-2px]"
                            aria-hidden="true"
                          />
                        ) : null}
                        {tnLabel(s)}
                      </Th>
                    ))}
                    <Th className="pr-3.5">Parcours</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => {
                    const band = bandOf(r.position);
                    const prevBand = i > 0 ? bandOf(visible[i - 1]?.position ?? 0) : undefined;
                    const showBand = i === 0 || band !== prevBand;
                    const key = r.licence || r.name;
                    return (
                      <RowGroup key={key}>
                        {showBand ? <BandRow band={band} cols={cols} /> : null}
                        <tr
                          className={cx(
                            "group border-line cursor-pointer border-b transition-colors last:border-b-0 hover:bg-surface-2",
                            selected === key && "bg-brand-soft/60",
                          )}
                          onClick={() => setSelected(key)}
                        >
                          <td className="py-1.5 pr-2.5 pl-3.5 text-right">
                            <span
                              className={cx(
                                "inline-grid h-[22px] min-w-[26px] place-items-center rounded-[7px] border px-1 font-mono text-[12px] font-bold tabular-nums",
                                band ? BAND_POS[band.tone] : "border-transparent",
                              )}
                            >
                              {r.position}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <Delta value={r.delta} isNew={Boolean(lastClosure)} />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <button
                              type="button"
                              className="text-left font-semibold whitespace-nowrap hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(key);
                              }}
                            >
                              {nice(r.name)}
                            </button>
                          </td>
                          <td className="text-ink-muted max-w-[200px] truncate px-2.5 py-1.5">
                            {clubShort(r.club)}
                          </td>
                          <td className="text-ink-muted px-2.5 py-1.5 font-mono text-[11.5px]">
                            {r.licence}
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            <Points value={r.pts} />
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-[12px] tabular-nums">
                            {dec(r.moy, 3)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-[12px] tabular-nums">
                            {r.count}
                          </td>
                          <td
                            className={cx("px-2.5 py-1.5 text-right", HATCHED)}
                            title={
                              r.left.pts === null
                                ? `${stageText(r.left)} : non joué${leftKnown ? "" : " (résultats non importés)"}.`
                                : `Sorti du classement au ${tnLabel(last)} : ces ${dec(r.left.pts, 3)} pts ne comptent plus.`
                            }
                          >
                            {r.left.pts === null ? (
                              <span className="text-line-2 font-mono">–</span>
                            ) : (
                              <span className="text-ink-muted/80 font-mono text-[12px] tabular-nums line-through decoration-[1px]">
                                {dec(r.left.pts, 3)}
                              </span>
                            )}
                          </td>
                          {r.window.map((c) => (
                            <WindowTd key={`${c.season}-${c.tn}`} cell={c} row={r} />
                          ))}
                          <td className="py-[3px] pr-3.5 pl-2.5">
                            <MiniBars row={r} />
                          </td>
                        </tr>
                      </RowGroup>
                    );
                  })}
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={cols}>
                        <Empty icon={Search}>Aucun joueur ne correspond.</Empty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="text-ink-muted mt-2.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11.5px]">
              <span>
                <span
                  className={cx(
                    "mr-1 inline-block h-3 w-5 rounded-[3px] align-[-2px]",
                    HATCHED,
                    "bg-surface-2 border-line-2 border",
                  )}
                />
                {stageText(left)} : sorti de la fenêtre, ne compte plus
              </span>
              <span>
                <span className="border-brand/50 mr-1 inline-block h-3 w-5 rounded-[3px] border border-dashed align-[-2px]" />
                résultat non compté (4 meilleurs sur 5)
              </span>
              <span>
                <LogOut className="mr-1 inline size-3 align-[-2px]" aria-hidden="true" />
                {stageText(stages[0] ?? last)} sort à la prochaine clôture
              </span>
              <span>Bandes : 1 à 8 Masters directs · 9 à 16 · 17 à 34 finales nationales</span>
            </div>
          </Card>
        </>
      )}
      <PlayerPanel
        row={selectedRow}
        last={last ?? { season: doc.id, tn: 1 }}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

/** Fragment nommé : une bande puis sa ligne, sans élément intermédiaire dans le tableau. */
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Bandeau de preuve : comparaison avec le classeur de référence. */
function ReferenceBanner({ c }: { c: ReferenceComparison }) {
  const exact = c.identical === c.expected && c.samePosition === c.expected;
  const title = SEASON_FIXTURE.expectedAfterTitle.replace("CLASSEMENT GLISSANT 5 QUILLES ", "");
  return (
    <div className="bg-ok-soft text-ok-ink animate-pop mb-4 rounded-[12px] px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        <Trophy className="size-4" aria-hidden="true" />
        {exact
          ? `Identique au classement « ${title} » du classeur de référence : ${c.expected} joueurs, mêmes points, même ordre.`
          : `Conforme au classement « ${title} » du classeur de référence : ${c.expected} joueurs, points du barème identiques pour tous, ${c.identical} totaux identiques à la décimale près, ${c.samePosition} positions identiques.`}
      </div>
      {!exact && c.decimalOnly.length > 0 ? (
        <p className="mt-1 text-[12.5px]">
          {c.decimalOnly.length} décimales diffèrent légèrement (joueurs du National) : l'outil
          Excel compte 4 à 6 matchs au lieu de 3 dans les poules National 2 à 8, ce qui fausse sa
          décimale « points de set / matchs / 100 ». Pilot5Q compte les matchs réellement joués ;
          les positions ne changent qu'entre joueurs à égalité de points du barème.
        </p>
      ) : null}
    </div>
  );
}
