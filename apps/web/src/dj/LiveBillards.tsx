/**
 * Vue billards en direct (vendredi, en tête de la grille de saisie) : un bloc par billard avec
 * ses poules et leurs matchs restants, billards libres ou bientôt libres, poules en retard, et
 * déplacement en un clic d'une poule vers un billard libre du même format (événement
 * `billards.assigned`, notification locale « billards » pour prévenir les joueurs).
 * Règles de calcul : voir `lib/billardsLive.ts`.
 */
import { ArrowRight, Clock, MoveRight } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useMemo } from "react";

import { useToast } from "@/components/Toast";
import { Button, Chip, cx } from "@/components/ui";
import { liveBillards, movePouleAssignments, type LiveBillard } from "@/lib/billardsLive";
import { nice, plural } from "@/lib/format";
import { addNotification } from "@/lib/notifications";
import { useEditLock, useTournament } from "@/store/tournament";

const SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;

export function LiveBillards({ onOpen }: { onOpen?: (poule: number) => void }) {
  const { state, id, dispatch } = useTournament();
  const toast = useToast();
  const ro = useEditLock();
  const live = useMemo(() => liveBillards(state, "PREQ"), [state]);
  const free = live.billards.filter((b) => b.status === "libre").length;
  const soon = live.billards.filter((b) => b.status === "bientot").length;
  const late = live.poules.filter((p) => p.late);

  const move = (poule: number, to: number, from: number[]) => {
    const players = state.poules.PREQ.find((p) => p.num === poule)?.players ?? [];
    dispatch({
      type: "billards.assigned",
      payload: { phase: "PREQ", assignments: movePouleAssignments(state, "PREQ", poule, to) },
    });
    if (id)
      void addNotification({
        tournamentId: id,
        kind: "billards",
        title: `Poule ${poule} déplacée sur le billard ${to}`,
        body: `Joueurs à prévenir : ${players.map(nice).join(", ")}.`,
        impact: `Billard ${from.join(" & ")} → billard ${to}`,
      });
    toast(`Poule ${poule} → billard ${to} · joueurs à prévenir`);
  };

  if (state.billards.length === 0 || state.poules.PREQ.length === 0) return null;

  return (
    <section id="billards-live" className="card mb-3.5 scroll-mt-4" aria-label="Billards en direct">
      <header className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <h3 className="flex items-center gap-2 text-[14px] font-bold">
          <span className="bg-brand-light animate-live-pulse size-2 rounded-full" aria-hidden />
          Billards en direct
        </h3>
        <span className="text-ink-muted text-[12px]">
          {live.started
            ? `${Math.round(live.average * 10) / 10} matchs restants par poule en moyenne`
            : "les poules n'ont pas commencé"}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {free ? (
            <Chip tone="green">{plural(free, "billard libre", "billards libres")}</Chip>
          ) : null}
          {soon ? <Chip tone="gold">{plural(soon, "bientôt libre", "bientôt libres")}</Chip> : null}
          {late.length ? (
            <Chip tone="red" icon={Clock}>
              {plural(late.length, "poule en retard", "poules en retard")}
            </Chip>
          ) : null}
        </span>
      </header>

      {live.suggestions.length && !ro ? (
        <div className="bg-brand-soft/70 border-line mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-[11px] border px-3 py-2">
          <MoveRight className="text-brand size-4 shrink-0" aria-hidden="true" />
          <span className="text-brand-ink text-[12.5px] font-semibold">
            Billard libre du même format :
          </span>
          {live.suggestions.map((s) => (
            <Button
              key={`${s.poule}-${s.to}`}
              size="sm"
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => move(s.poule, s.to, s.from)}
            >
              Déplacer la poule {s.poule} sur le billard {s.to}
            </Button>
          ))}
        </div>
      ) : null}

      <LayoutGroup id="billards-live">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 px-4 pt-1 pb-3.5">
          {live.billards.map((b) => (
            <BillardBlock key={b.num} billard={b} onOpen={onOpen} />
          ))}
        </div>
      </LayoutGroup>
    </section>
  );
}

function BillardBlock({
  billard: b,
  onOpen,
}: {
  billard: LiveBillard;
  onOpen?: (poule: number) => void;
}) {
  const statusLabel =
    b.status === "libre"
      ? "Libre"
      : b.status === "bientot"
        ? "Bientôt libre"
        : `${plural(Math.ceil(b.load), "match", "matchs")}`;
  return (
    <motion.div
      layout
      layoutDependency={b.poules.map((p) => p.num).join(",")}
      transition={{ layout: SPRING }}
      style={{ borderRadius: 12 }}
      className={cx(
        "flex min-w-0 flex-col gap-1 border px-2.5 pt-2 pb-2 transition-[background-color,border-color] duration-500",
        b.status === "libre"
          ? "border-[#bfe6d2] bg-[linear-gradient(180deg,#fff,var(--color-ok-soft))]"
          : b.status === "bientot"
            ? "border-[#f2d48a] bg-[linear-gradient(180deg,#fff,var(--color-gold-soft))]"
            : "border-line bg-surface",
      )}
      data-billard={b.num}
    >
      <div className="flex items-baseline gap-1.5">
        <b className="font-mono text-[15px] font-extrabold">B{b.num}</b>
        <span
          className={cx(
            "rounded-[5px] px-1 font-mono text-[9.5px] font-bold",
            b.type === "3m10" ? "bg-brand-soft text-brand-ink" : "bg-surface-2 text-ink-muted",
          )}
        >
          {b.type}
        </span>
      </div>
      <div className="flex min-h-[22px] flex-col gap-[3px]">
        {b.poules.map((p) => (
          <motion.button
            key={p.num}
            layoutId={`lb-poule-${p.num}-${b.num === p.billards[0] ? "main" : b.num}`}
            layoutDependency={b.num}
            transition={SPRING}
            type="button"
            onClick={onOpen ? () => onOpen(p.num) : undefined}
            title={`Poule ${p.num} : ${plural(p.remaining, "match restant", "matchs restants")}${p.late ? " · en retard" : ""}`}
            className={cx(
              "flex items-center gap-1.5 rounded-[7px] px-1.5 py-[2px] text-left text-[11.5px] font-semibold",
              p.remaining === 0
                ? "text-ink-muted"
                : p.late
                  ? "bg-alert-soft text-alert-ink"
                  : "bg-surface-2 text-ink",
            )}
          >
            <span className="whitespace-nowrap">P{p.num}</span>
            <span className="bg-line relative h-[4px] min-w-[18px] flex-1 overflow-hidden rounded-full">
              <motion.span
                className={cx(
                  "absolute inset-y-0 left-0 rounded-full",
                  p.remaining === 0 ? "bg-ok" : p.late ? "bg-alert" : "bg-brand-light",
                )}
                initial={false}
                animate={{ width: `${p.total ? ((p.total - p.remaining) / p.total) * 100 : 100}%` }}
                transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </span>
            <span className="w-3 text-right font-mono text-[10.5px] tabular-nums">
              {p.remaining === 0 ? "✓" : p.remaining}
            </span>
          </motion.button>
        ))}
      </div>
      <span
        className={cx(
          "text-[10.5px] font-bold",
          b.status === "libre"
            ? "text-ok-ink"
            : b.status === "bientot"
              ? "text-gold-ink"
              : "text-ink-muted",
        )}
      >
        {statusLabel}
      </span>
    </motion.div>
  );
}
