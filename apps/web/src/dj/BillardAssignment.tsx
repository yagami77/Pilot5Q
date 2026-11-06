/**
 * Affectation des billards du vendredi, logique inversée (retours du 5 novembre) : on part des
 * billards et on y dépose les poules (glisser-déposer ou menu), 1 à 3 par billard. Deux billards
 * du même format peuvent être liés pour accueillir 3 poules. « Proposer » lance l'optimiseur
 * (`lib/billardsOptimizer`, retours du 6 novembre) et affiche ses critères et la charge de chaque
 * billard ; « Vider » remet toutes les poules dans le bac pour une affectation manuelle. Un
 * contrôle signale les poules non placées, en double ou les billards de plus de 3 poules. Le
 * résultat alimente `billards.assigned` (phase PREQ).
 */
import type { Billard } from "@pilot5q/domain";
import {
  Check,
  Eraser,
  Link2,
  Plus,
  Shuffle,
  Sparkles,
  TriangleAlert,
  Undo2,
  Unlink,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState, type DragEvent } from "react";

import { useToast } from "@/components/Toast";
import { Button, Card, Chip, cx } from "@/components/ui";
import {
  MAX_POULES_PER_TABLE,
  anchorOf,
  assignmentsToPlan,
  checkPlan,
  linkTables,
  placePoule,
  emptyPlan,
  planToAssignments,
  removePoule,
  tablesOf,
  unlinkTables,
  type TablePlan,
} from "@/lib/assign";
import {
  OPTIMIZER_CRITERIA,
  optimizeBillards,
  planLoads,
  type BillardLoad,
  type PouleSize,
} from "@/lib/billardsOptimizer";
import { pouleSizes } from "@/lib/engine";
import { plural } from "@/lib/format";
import { useTournament } from "@/store/tournament";

const DRAG_TYPE = "application/x-pilot5q-poule";

function samePlan(a: TablePlan, b: TablePlan): boolean {
  return (
    JSON.stringify(planToAssignments(a)) === JSON.stringify(planToAssignments(b)) &&
    JSON.stringify(a.links) === JSON.stringify(b.links)
  );
}

export function BillardAssignment({
  pouleCount,
  locked,
}: {
  pouleCount: number;
  /** Scores déjà saisis : l'affectation est figée. */
  locked: boolean;
}) {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const stored = useMemo(
    () => assignmentsToPlan(state.billardAssignments.PREQ),
    [state.billardAssignments.PREQ],
  );
  const [plan, setPlan] = useState<TablePlan>(stored);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | "tray" | null>(null);
  const [linking, setLinking] = useState<number | null>(null);
  // Graine de l'optimiseur : même graine, même proposition ; « Autre proposition » la change
  const [seed, setSeed] = useState(1);
  const [proposed, setProposed] = useState(false);
  const [impossible, setImpossible] = useState<string | null>(null);
  useEffect(() => setPlan(stored), [stored]);

  // Taille des poules : réelle après le tirage, prévue (poules de 3 en dernier) avant
  const sizes = useMemo<PouleSize[]>(() => {
    if (state.poules.PREQ.length)
      return state.poules.PREQ.map((p) => ({ num: p.num, size: p.players.length }));
    const n = Math.max(0, state.players.length - state.rules.mastersPrequalified);
    try {
      return pouleSizes(n, state.rules.maxPoulesOf3).map((size, i) => ({ num: i + 1, size }));
    } catch {
      return Array.from({ length: pouleCount }, (_, i) => ({ num: i + 1, size: 4 }));
    }
  }, [state.poules.PREQ, state.players.length, state.rules, pouleCount]);
  const sizeOf = useMemo(() => new Map(sizes.map((p) => [p.num, p.size])), [sizes]);
  const loads = useMemo(
    () => planLoads(plan, sizes, state.billards),
    [plan, sizes, state.billards],
  );

  const dirty = !samePlan(plan, stored);
  const issues = checkPlan(plan, pouleCount, state.billards);
  const billards = [...state.billards].sort((a, b) => a.num - b.num);
  // Emplacements : billards seuls et paires liées (une seule tuile)
  const anchors = billards.filter((b) => anchorOf(plan, b.num) === b.num);
  const placedOn = new Map<number, number>();
  for (const [b, ps] of Object.entries(plan.place)) for (const p of ps) placedOn.set(p, Number(b));

  const save = () => {
    if (!issues.ok) {
      toast("Corrigez d'abord l'affectation (poules non placées ou billard surchargé)");
      return;
    }
    dispatch({
      type: "billards.assigned",
      payload: { phase: "PREQ", assignments: planToAssignments(plan) },
    });
    toast("Affectation des billards enregistrée");
  };

  const propose = (next: number) => {
    const res = optimizeBillards(sizes, state.billards, next);
    setSeed(next);
    setLinking(null);
    if (!res.ok) {
      setImpossible(res.reason);
      toast(res.reason);
      return;
    }
    setImpossible(null);
    setProposed(true);
    setPlan(res.plan);
    toast(
      `Proposition ${next} · ${res.maxLoad} matchs au plus par billard · ajustez puis enregistrez`,
    );
  };

  const clear = () => {
    setPlan(emptyPlan());
    setLinking(null);
    toast("Billards vidés · glissez les poules du bac vers les billards");
  };

  const onDrop = (e: DragEvent, target: number | "tray") => {
    e.preventDefault();
    const n = Number(e.dataTransfer.getData(DRAG_TYPE) || dragging);
    setOver(null);
    setDragging(null);
    if (!n) return;
    setPlan((p) => (target === "tray" ? removePoule(p, n) : placePoule(p, n, target)));
  };
  const dropProps = (target: number | "tray") =>
    locked
      ? {}
      : {
          onDragOver: (e: DragEvent) => {
            if (dragging === null && !e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== target) setOver(target);
          },
          onDragLeave: () => setOver((o) => (o === target ? null : o)),
          onDrop: (e: DragEvent) => onDrop(e, target),
        };

  const chip = (n: number, opts: { onRemove?: () => void } = {}) => {
    const three = (sizeOf.get(n) ?? 4) < 4;
    return (
      <motion.span
        key={n}
        layout
        layoutId={`poule-chip-${n}`}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
        draggable={!locked}
        onDragStart={(e) => {
          const ev = e as unknown as DragEvent;
          ev.dataTransfer.setData(DRAG_TYPE, String(n));
          ev.dataTransfer.effectAllowed = "move";
          setDragging(n);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        className={cx(
          "group/chip inline-flex items-center gap-1.5 rounded-[9px] border py-[4px] pr-1.5 pl-2 text-[12px] font-bold shadow-[0_1px_0_rgb(15_27_51/0.04)] select-none",
          three
            ? "text-ink-secondary border-[1.5px] border-dashed border-[#9aa8c4] bg-[#fbfcfe]"
            : "bg-surface border-line-2",
          !locked && "cursor-grab active:cursor-grabbing",
          dragging === n && "opacity-40",
          issues.duplicated.includes(n) && "border-alert text-alert-ink",
        )}
        title={three ? `Poule ${n} · 3 joueurs (3 matchs)` : `Poule ${n} · 4 joueurs (6 matchs)`}
      >
        <PlayerDots count={three ? 3 : 4} />
        Poule <span className="font-mono">{n}</span>
        {opts.onRemove && !locked ? (
          <button
            type="button"
            onClick={opts.onRemove}
            aria-label={`Retirer la poule ${n}`}
            className="text-ink-muted hover:text-alert-ink hover:bg-alert-soft -mr-0.5 grid size-4 place-items-center rounded-[4px] opacity-60 group-hover/chip:opacity-100"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </motion.span>
    );
  };

  const tile = (b: Billard) => {
    const tables = tablesOf(plan, b.num);
    const linked = tables.length > 1;
    const poules = plan.place[b.num] ?? [];
    const over3 = poules.length > MAX_POULES_PER_TABLE;
    const candidates = billards.filter(
      (x) => x.num !== b.num && x.type === b.type && plan.links[x.num] === undefined,
    );
    const options = Array.from({ length: pouleCount }, (_, i) => i + 1).filter(
      (n) => !poules.includes(n),
    );
    return (
      <motion.div
        layout
        key={b.num}
        {...dropProps(b.num)}
        className={cx(
          "relative flex min-h-[112px] flex-col gap-2 rounded-[12px] border p-3 transition-[border-color,background-color,box-shadow] duration-200",
          linked && "sm:col-span-2",
          b.type === "3m10" ? "bg-[#f6f8fe]" : "bg-surface-2",
          over === b.num
            ? "border-brand-light bg-brand-soft shadow-[0_0_0_3px_var(--color-brand-soft)]"
            : over3
              ? "border-alert"
              : "border-line",
          dragging !== null && over !== b.num && !locked && "border-dashed",
        )}
      >
        <div className="flex items-center gap-2">
          <b className="text-[14.5px]">
            {linked ? "Billards" : "Billard"}{" "}
            <span className="font-mono">{tables.join(" + ")}</span>
          </b>
          <span
            className={cx(
              "rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-bold",
              b.type === "3m10"
                ? "bg-brand-soft text-brand-ink border-transparent"
                : "bg-surface border-line-2 text-ink-muted",
            )}
          >
            {b.type}
          </span>
          {linked ? (
            <Link2 className="text-brand-light size-3.5" aria-label="Billards liés" />
          ) : null}
          {over3 ? (
            <span className="text-alert-ink bg-alert-soft ml-auto inline-flex items-center gap-1 rounded-[6px] px-1.5 py-[2px] text-[10.5px] font-bold">
              <TriangleAlert className="size-3" aria-hidden="true" />
              {poules.length} poules
            </span>
          ) : null}
        </div>
        <div className="flex min-h-[28px] flex-wrap content-start gap-1.5">
          {poules.map((n) =>
            chip(n, {
              onRemove: () => setPlan((p) => removePoule(p, n)),
            }),
          )}
          {poules.length === 0 ? (
            <span className="text-ink-muted self-center text-[11.5px]">
              {locked ? "libre" : "Déposez une poule ici"}
            </span>
          ) : null}
        </div>
        {!locked ? (
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <label className="border-line-2 bg-surface text-ink-secondary hover:bg-brand-soft relative inline-flex cursor-pointer items-center gap-1 rounded-[8px] border px-2 py-[3px] text-[11px] font-semibold">
              <Plus className="size-3" aria-hidden="true" />
              Poule
              <select
                aria-label={`Ajouter une poule au billard ${tables.join(" + ")}`}
                className="absolute inset-0 cursor-pointer opacity-0"
                value=""
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n) setPlan((p) => placePoule(p, n, b.num));
                }}
              >
                <option value="">Ajouter une poule…</option>
                {options.map((n) => {
                  const from = placedOn.get(n);
                  return (
                    <option key={n} value={n}>
                      Poule {n}
                      {from !== undefined
                        ? ` (déplacer depuis B${tablesOf(plan, from).join("+")})`
                        : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {linked ? (
              <button
                type="button"
                onClick={() => setPlan((p) => unlinkTables(p, b.num))}
                className="text-ink-muted hover:text-ink inline-flex items-center gap-1 rounded-[8px] px-1.5 py-[3px] text-[11px] font-semibold"
              >
                <Unlink className="size-3" aria-hidden="true" />
                Délier
              </button>
            ) : linking === b.num ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="text-ink-muted text-[11px]">Lier avec</span>
                {candidates.length ? (
                  candidates.map((c) => (
                    <button
                      key={c.num}
                      type="button"
                      onClick={() => {
                        setPlan((p) => linkTables(p, b.num, c.num));
                        setLinking(null);
                      }}
                      className="bg-brand-soft text-brand-ink hover:bg-brand-light rounded-[6px] px-1.5 py-[2px] font-mono text-[11px] font-bold hover:text-white"
                    >
                      B{c.num}
                    </button>
                  ))
                ) : (
                  <span className="text-ink-muted text-[11px]">aucun billard {b.type} libre</span>
                )}
                <button
                  type="button"
                  aria-label="Annuler la liaison"
                  onClick={() => setLinking(null)}
                  className="text-ink-muted grid size-4 place-items-center"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLinking(b.num)}
                className="text-ink-muted hover:text-brand inline-flex items-center gap-1 rounded-[8px] px-1.5 py-[3px] text-[11px] font-semibold"
                title="Deux billards du même format, proches, pour 3 poules"
              >
                <Link2 className="size-3" aria-hidden="true" />
                Lier
              </button>
            )}
          </div>
        ) : null}
      </motion.div>
    );
  };

  return (
    <Card
      id="affectation"
      className="mt-3.5"
      title="Billards et poules affectées"
      aside={
        <>
          {issues.ok ? (
            <Chip tone="green" icon={Check}>
              {plural(pouleCount, "poule placée", "poules placées")}
            </Chip>
          ) : (
            <Chip tone="red" icon={TriangleAlert}>
              {[
                issues.unplaced.length ? `${issues.unplaced.length} non placée(s)` : "",
                issues.duplicated.length ? `${issues.duplicated.length} en double` : "",
                issues.overloaded.length
                  ? `B${issues.overloaded.join(", B")} : plus de ${MAX_POULES_PER_TABLE} poules`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Chip>
          )}
          {issues.mixedLinks.length ? (
            <Chip tone="gold" icon={TriangleAlert}>
              Billards liés de formats différents
            </Chip>
          ) : null}
          {locked ? (
            <Chip tone="grey">Figée : des scores sont saisis</Chip>
          ) : (
            <>
              <Button
                size="sm"
                icon={Eraser}
                onClick={clear}
                disabled={!Object.keys(plan.place).length}
              >
                Vider
              </Button>
              {proposed ? (
                <Button size="sm" icon={Shuffle} onClick={() => propose(seed + 1)}>
                  Autre proposition
                </Button>
              ) : (
                <Button size="sm" icon={Sparkles} onClick={() => propose(seed)}>
                  Proposer
                </Button>
              )}
              {dirty ? (
                <>
                  <Button size="sm" icon={Undo2} onClick={() => setPlan(stored)}>
                    Rétablir
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Check}
                    onClick={save}
                    disabled={!issues.ok}
                  >
                    Enregistrer
                  </Button>
                </>
              ) : null}
            </>
          )}
        </>
      }
    >
      <LayoutGroup id="affectation">
        <div className="px-4 pb-4">
          <LoadStrip loads={loads} impossible={impossible} />
          {!locked && (issues.unplaced.length > 0 || dragging !== null) ? (
            <div
              {...dropProps("tray")}
              className={cx(
                "mb-3 flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-[12px] border border-dashed px-3 py-2 transition-colors",
                over === "tray"
                  ? "border-brand-light bg-brand-soft"
                  : issues.unplaced.length
                    ? "border-brand-light/50 bg-brand-soft/40"
                    : "border-line-2",
              )}
            >
              <span
                className={cx(
                  "mr-1 text-[11.5px] font-bold",
                  issues.unplaced.length ? "text-brand-ink" : "text-ink-muted",
                )}
              >
                {issues.unplaced.length
                  ? `À placer (${issues.unplaced.length}) · glissez sur un billard`
                  : "Déposer ici pour retirer"}
              </span>
              <AnimatePresence>{issues.unplaced.map((n) => chip(n))}</AnimatePresence>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
            {anchors.map((b) => tile(b))}
          </div>
        </div>
      </LayoutGroup>
    </Card>
  );
}

/** Pastille de format : 4 points (poule de 4) ou 3 points (poule de 3). */
function PlayerDots({ count }: { count: 3 | 4 }) {
  const pts =
    count === 4
      ? [
          [3, 3],
          [9, 3],
          [3, 9],
          [9, 9],
        ]
      : [
          [6, 2.6],
          [2.8, 9],
          [9.2, 9],
        ];
  return (
    <svg
      viewBox="0 0 12 12"
      className={cx("size-[11px] shrink-0", count === 3 ? "text-ink-muted" : "text-brand-light")}
      aria-hidden="true"
    >
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.9} fill="currentColor" />
      ))}
    </svg>
  );
}

/** Critères de l'optimiseur et charge de chaque billard (barre fine, en matchs). */
function LoadStrip({ loads, impossible }: { loads: BillardLoad[]; impossible: string | null }) {
  const max = Math.max(12, ...loads.map((l) => l.matches));
  const top = Math.max(0, ...loads.map((l) => l.matches));
  return (
    <div className="border-line mb-3 rounded-[12px] border bg-[linear-gradient(180deg,#fbfcff,#f6f8fd)] px-3 py-2.5">
      <p className="text-ink-muted flex items-start gap-1.5 text-[12px] leading-[1.45]">
        <Sparkles className="text-brand-light mt-[2px] size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <b className="text-ink-secondary font-semibold">Proposer</b> : {OPTIMIZER_CRITERIA}
        </span>
      </p>
      {impossible ? (
        <p className="text-alert-ink mt-1.5 text-[12px] font-semibold">{impossible}</p>
      ) : null}
      <div
        className="mt-2 grid gap-x-2 gap-y-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(54px, 1fr))" }}
        aria-label="Charge par billard, en nombre de matchs"
      >
        {loads.map((l) => (
          <div
            key={l.billard}
            className="min-w-0"
            title={`Billard ${l.billard}${l.linkedWith !== undefined ? ` (lié au ${l.linkedWith})` : ""} : ${l.matches} matchs`}
          >
            <div className="flex items-baseline justify-between gap-1 font-mono text-[10.5px] leading-none">
              <span className="text-ink-muted font-semibold">
                B{l.billard}
                {l.linkedWith !== undefined ? (
                  <Link2 className="ml-0.5 inline size-2.5 align-[-1px]" aria-hidden="true" />
                ) : null}
              </span>
              <span
                className={cx(
                  "font-bold tabular-nums",
                  l.matches === 0
                    ? "text-alert-ink"
                    : l.matches === top
                      ? "text-ink"
                      : "text-ink-secondary",
                )}
              >
                {Number.isInteger(l.matches) ? l.matches : l.matches.toFixed(1).replace(".", ",")}
              </span>
            </div>
            <div className="bg-line mt-1 h-[3px] overflow-hidden rounded-full">
              <motion.div
                className={cx(
                  "h-full rounded-full",
                  l.type === "3m10" ? "bg-brand" : "bg-brand-light",
                  l.matches > 18 && "bg-alert",
                )}
                initial={false}
                animate={{ width: `${(l.matches / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
