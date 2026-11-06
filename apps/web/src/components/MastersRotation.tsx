/**
 * Tours de jeu Masters à l'écran (retours du 6 novembre) : s'il n'y a que 3 billards 3m10 pour
 * les 4 poules Masters, la rotation du livret (`lib/mastersRotation`) par tour indicatif, avec
 * les matchs joués, ceux sur les billards et le prochain à lancer. Imprimable (« Tours de jeu
 * Masters »). Ne rend rien quand chaque poule a son billard, sauf `force`.
 */
import { Check, Printer, RotateCw } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useNavigate } from "react-router";

import { markPrinted } from "@/lib/djMeta";
import { nice, shortName } from "@/lib/format";
import { mastersRotationOf, type RotationRow } from "@/lib/mastersRotation";
import { useTournament } from "@/store/tournament";

import { Button, Card, Chip, cx } from "./ui";

/** Teintes des poules, comme dans la feuille « Tours de jeu » du classeur. */
const POULE_TONE: Record<number, string> = {
  1: "bg-brand-soft text-brand-ink",
  2: "bg-gold-soft text-gold-ink",
  3: "bg-ok-soft text-ok-ink",
  4: "bg-surface-2 text-ink-secondary border border-line-2",
};

export function MastersRotation({
  force = false,
  className,
}: {
  /** Affiche aussi la liste quand chaque poule a son billard. */
  force?: boolean;
  className?: string;
}) {
  const { state, id } = useTournament();
  const navigate = useNavigate();
  const rot = useMemo(() => mastersRotationOf(state), [state]);
  if (rot.rows.length === 0 || (!rot.needed && !force)) return null;

  const n = Math.max(1, Math.min(rot.billards.length, state.poules.QM.length));
  // Les n premiers matchs non joués occupent les billards ; le suivant est le prochain à lancer
  const pending = rot.rows.filter((r) => !r.played);
  const onTable = new Set(pending.slice(0, n).map((r) => r.order));
  const next = rot.needed ? pending[n] : undefined;
  const tours = [...new Set(rot.rows.map((r) => r.tour))];

  const print = () => {
    if (id) void markPrinted(id, ["tours-masters"]);
    const path = "/tournoi/imprimer/tours-masters";
    const win = window.open(
      `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`,
      "_blank",
      "noopener",
    );
    if (!win) void navigate(path);
  };

  return (
    <Card
      id="tours-masters"
      className={className}
      title="Tours de jeu Masters"
      aside={
        <>
          <Chip tone="blue" icon={RotateCw}>
            {rot.billards.length} billards 3m10 · B
            {[...rot.billards].sort((a, b) => a - b).join(", B")}
          </Chip>
          <Button size="sm" icon={Printer} onClick={print}>
            Imprimer
          </Button>
        </>
      }
    >
      <div className="px-4 pb-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-ink-muted max-w-[78ch] text-[12.5px]">
            {rot.needed
              ? `Les poules 1 à ${n} commencent ; le premier billard libéré prend le match suivant de la liste, dans l'ordre. Tours indicatifs, à durée de match égale.`
              : "Chaque poule enchaîne ses matchs sur son billard."}
          </p>
          {next ? (
            <span className="bg-gold-soft text-gold-ink ml-auto inline-flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12px] font-bold">
              Prochain : poule {next.poule} · match {next.match}
              <span className="font-semibold opacity-80">au premier billard libéré</span>
            </span>
          ) : null}
        </div>
        <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {tours.map((t, i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="border-line bg-surface-2/60 rounded-[12px] border p-2"
            >
              <div className="text-ink-muted mb-1.5 flex items-baseline justify-between px-1 text-[10.5px] font-bold tracking-[0.06em] uppercase">
                <span>Tour {t}</span>
                {t === 1 && rot.needed ? <span className="normal-case">départ</span> : null}
              </div>
              <ul className="flex flex-col gap-1">
                {rot.rows
                  .filter((r) => r.tour === t)
                  .map((r) => (
                    <RotationItem
                      key={r.order}
                      row={r}
                      onTable={onTable.has(r.order)}
                      next={next?.order === r.order}
                    />
                  ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

function RotationItem({
  row,
  onTable,
  next,
}: {
  row: RotationRow;
  onTable: boolean;
  next: boolean;
}) {
  const side = (v: string, isName: boolean) => (isName ? shortName(v) : v);
  const names = `${side(row.a, row.aIsName)} – ${side(row.b, row.bIsName)}`;
  return (
    <li
      className={cx(
        "bg-surface flex items-center gap-2 rounded-[9px] border px-2 py-1.5 transition-[border-color,box-shadow] duration-300",
        next
          ? "border-gold shadow-[0_0_0_3px_var(--color-gold-soft)]"
          : onTable
            ? "border-brand-light/50"
            : "border-line",
        row.played && "opacity-70",
      )}
      title={`${row.order}. Poule ${row.poule} · match ${row.match} (${row.label})${row.arbitre ? ` · arbitre ${nice(row.arbitre)}` : ""}`}
    >
      <span
        className={cx(
          "grid h-[22px] min-w-[26px] shrink-0 place-items-center rounded-[6px] px-1 font-mono text-[11px] font-bold",
          POULE_TONE[row.poule] ?? POULE_TONE[4],
        )}
      >
        P{row.poule}
      </span>
      <div className="min-w-0 flex-1 leading-[1.2]">
        <div
          className={cx(
            "truncate text-[12px]",
            row.known ? "font-semibold" : "text-ink-muted italic",
          )}
        >
          {names}
        </div>
        <div className="text-ink-muted truncate text-[10.5px]">
          Match {row.match} · {row.label}
        </div>
      </div>
      {row.played ? (
        <span className="bg-ok grid size-[18px] shrink-0 place-items-center rounded-full text-white">
          <Check className="size-3" strokeWidth={3} aria-label="Joué" />
        </span>
      ) : row.billard !== null ? (
        <span className="text-brand-ink bg-brand-soft shrink-0 rounded-[6px] px-1.5 py-[2px] font-mono text-[10.5px] font-bold">
          B{row.billard}
        </span>
      ) : next ? (
        <span className="text-gold-ink shrink-0 text-[10px] font-extrabold uppercase">
          Prochain
        </span>
      ) : onTable ? (
        <span
          className="bg-brand-light animate-pulse-dot size-[7px] shrink-0 rounded-full"
          aria-label="Sur un billard"
        />
      ) : null}
    </li>
  );
}
