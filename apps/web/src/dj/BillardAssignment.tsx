/**
 * Affectation des billards du vendredi, logique inversée (retours du 5 novembre) : on part des
 * billards et on y dépose les poules (glisser-déposer ou menu), 1 à 3 par billard. Deux billards
 * du même format peuvent être liés pour accueillir 3 poules. « Proposer » remplit une
 * affectation de départ ; un contrôle signale les poules non placées, en double ou les billards
 * de plus de 3 poules. Le résultat alimente `billards.assigned` (phase PREQ).
 */
import type { Billard } from "@pilot5q/domain";
import { Check, Link2, Unlink, Plus, Sparkles, TriangleAlert, Undo2, X } from "lucide-react";
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
  planToAssignments,
  proposePlan,
  removePoule,
  tablesOf,
  unlinkTables,
  type TablePlan,
} from "@/lib/assign";
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
  useEffect(() => setPlan(stored), [stored]);

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

  const propose = () => {
    setPlan(proposePlan(pouleCount, state.billards));
    setLinking(null);
    toast("Affectation proposée · ajustez puis enregistrez");
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

  const chip = (n: number, opts: { starts?: boolean; onRemove?: () => void } = {}) => (
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
        "group/chip bg-surface border-line-2 inline-flex items-center gap-1 rounded-[9px] border py-[4px] pr-1.5 pl-2 text-[12px] font-bold shadow-[0_1px_0_rgb(15_27_51/0.04)] select-none",
        !locked && "cursor-grab active:cursor-grabbing",
        dragging === n && "opacity-40",
        issues.duplicated.includes(n) && "border-alert text-alert-ink",
      )}
      title={opts.starts ? "Numéro le plus élevé : commence sur ce billard" : undefined}
    >
      Poule <span className="font-mono">{n}</span>
      {opts.starts ? (
        <span className="bg-gold-soft text-gold-ink rounded-[5px] px-1 text-[9.5px] font-extrabold">
          1er
        </span>
      ) : null}
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

  const tile = (b: Billard) => {
    const tables = tablesOf(plan, b.num);
    const linked = tables.length > 1;
    const poules = plan.place[b.num] ?? [];
    const over3 = poules.length > MAX_POULES_PER_TABLE;
    const starts = poules.length > 1 ? Math.max(...poules) : null;
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
          <span
            className={cx(
              "ml-auto font-mono text-[11px] font-bold",
              over3 ? "text-alert-ink" : poules.length ? "text-ink-secondary" : "text-ink-muted",
            )}
          >
            {poules.length}/{MAX_POULES_PER_TABLE}
          </span>
        </div>
        <div className="flex min-h-[28px] flex-wrap content-start gap-1.5">
          {poules.map((n) =>
            chip(n, {
              starts: starts === n,
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
              <Button size="sm" icon={Sparkles} onClick={propose}>
                Proposer
              </Button>
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
          <p className="text-ink-muted mb-2.5 text-[12.5px]">
            En général 2 poules par billard ; 3 poules sur 2 billards liés du même format et
            proches. Les poules fortes ne sont pas prioritaires sur les 3m10. Sur un billard
            partagé, la poule au numéro le plus élevé commence.
          </p>
          {!locked && (issues.unplaced.length > 0 || dragging !== null) ? (
            <div
              {...dropProps("tray")}
              className={cx(
                "mb-3 flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-[12px] border border-dashed px-3 py-2 transition-colors",
                over === "tray"
                  ? "border-brand-light bg-brand-soft"
                  : issues.unplaced.length
                    ? "border-alert bg-alert-soft/50"
                    : "border-line-2",
              )}
            >
              <span
                className={cx(
                  "mr-1 text-[11.5px] font-bold",
                  issues.unplaced.length ? "text-alert-ink" : "text-ink-muted",
                )}
              >
                {issues.unplaced.length
                  ? `À placer (${issues.unplaced.length})`
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
