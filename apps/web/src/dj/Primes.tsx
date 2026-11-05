/**
 * Page « Primes », ouverte dès le samedi : montants prévus dès le départ (SPEC §6), chaque
 * ligne se remplit quand son bénéficiaire est connu (samedi : 3e et 4e des poules Masters ;
 * dimanche : après chaque tour), case « payé » (suivi local), totaux payé / restant et
 * impression pour préparer les chèques.
 */
import { Check, Clock, Printer, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";

import { RollingNumber } from "@/components/RollingNumber";
import { Card, Chip, PageHead, Tile, cx } from "@/components/ui";
import { Button } from "@/components/ui";
import { useDjMeta } from "@/lib/djMeta";
import { nice } from "@/lib/format";
import { primesTotals, progressivePrimes, type PrimeLine } from "@/lib/primes";
import { useTournament } from "@/store/tournament";

export function euro2(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function Primes({ readOnly = false }: { readOnly?: boolean }) {
  const { state, id } = useTournament();
  const [meta, update] = useDjMeta(id);
  const sheet = useMemo(() => progressivePrimes(state), [state]);
  const totals = primesTotals(sheet.lines, meta.paid);
  const known = sheet.lines.filter((l) => l.name).length;

  const toggle = (l: PrimeLine) => {
    if (readOnly || !l.name) return;
    void update((m) => {
      const paid = { ...m.paid };
      if (paid[l.key]) delete paid[l.key];
      else paid[l.key] = new Date().toISOString();
      return { ...m, paid };
    });
  };

  const openPrint = () => {
    const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/tournoi/imprimer/primes`;
    window.open(url, "_blank", "noopener");
  };

  const block = (phase: "M" | "N", title: string, tone: "gold" | "green") => {
    const lines = sheet.lines.filter((l) => l.phase === phase);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return (
      <Card
        title={title}
        aside={
          <Chip tone={tone} icon={Trophy}>
            <RollingNumber value={euro2(total)} />
          </Chip>
        }
        bodyClassName="pb-1.5"
      >
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-ink-muted text-left text-[10.5px] tracking-[0.06em] uppercase">
              <th className="px-4 py-1.5">Palier</th>
              <th className="px-2 py-1.5">Bénéficiaire</th>
              <th className="px-2 py-1.5 text-right">Montant</th>
              <th className="px-4 py-1.5 text-center">Payé</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const paid = Boolean(meta.paid[l.key]) && Boolean(l.name);
              const firstOfLabel = lines.findIndex((x) => x.label === l.label) === i;
              return (
                <tr
                  key={l.key}
                  className={cx(
                    "border-line transition-colors duration-300",
                    firstOfLabel && "border-t",
                    paid && "bg-ok-soft/50",
                  )}
                >
                  <td className="px-4 py-[6px] align-middle">
                    {firstOfLabel ? <b>{l.label}</b> : null}
                    <div className="text-ink-muted text-[11px]">{l.detail}</div>
                  </td>
                  <td className="px-2 py-[6px]">
                    <AnimatePresence mode="wait" initial={false}>
                      {l.name ? (
                        <motion.span
                          key={l.name}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-semibold"
                        >
                          {nice(l.name)}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="wait"
                          className="text-ink-muted inline-flex items-center gap-1 text-[11.5px]"
                        >
                          <Clock className="size-3" aria-hidden="true" />
                          connu {l.when === "samedi" ? "samedi" : "dimanche"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </td>
                  <td className="px-2 py-[6px] text-right font-mono font-semibold tabular-nums">
                    {euro2(l.amount)}
                  </td>
                  <td className="px-4 py-[6px] text-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={paid}
                      aria-label={`Prime payée : ${l.label} ${l.detail}`}
                      disabled={readOnly || !l.name}
                      onClick={() => toggle(l)}
                      className={cx(
                        "inline-grid size-[22px] place-items-center rounded-[7px] border-[1.5px] transition-[background-color,border-color] duration-200 disabled:opacity-40",
                        paid
                          ? "bg-ok border-ok text-white"
                          : "border-line-2 bg-surface hover:border-ok",
                      )}
                    >
                      {paid ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="size-3.5"
                          fill="none"
                          aria-hidden="true"
                        >
                          <motion.path
                            d="M5 12.5l4.2 4.2L19 7"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.35 }}
                          />
                        </svg>
                      ) : null}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  };

  return (
    <section className="cascade">
      <PageHead
        eyebrow={`${state.info?.name ?? ""} · ${state.info?.city ?? ""}`}
        title="Primes"
        help="Montants prévus dès le départ ; chaque ligne se remplit quand son bénéficiaire est connu. Cochez « payé » au moment de remettre le chèque."
      >
        <Button icon={Printer} onClick={openPrint}>
          Imprimer pour les chèques
        </Button>
      </PageHead>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile
          label="Cagnotte"
          value={euro2(sheet.total)}
          detail={`${state.rules.inscriptionFee} € × ${sheet.players - sheet.juniors} + ${sheet.ffb} € FFB + ${sheet.club} € club`}
          tone="gold"
        />
        <Tile label="Bénéficiaires connus" value={`${known}/${sheet.lines.length}`} />
        <Tile label="Payé" value={euro2(totals.paid)} detail={`${totals.paidCount} chèque(s)`} />
        <Tile label="Restant" value={euro2(totals.remaining)} tone="blue" />
      </div>

      <div className="mt-3.5 grid items-start gap-3.5 lg:grid-cols-2">
        {block("M", "Masters · 80 %", "gold")}
        {block("N", "National · 20 %", "green")}
      </div>
      {totals.paidCount > 0 && totals.paidCount === sheet.lines.length ? (
        <div className="bg-ok-soft text-ok-ink animate-pop mt-3.5 flex items-center gap-2 rounded-[12px] px-4 py-3 font-semibold">
          <Check className="size-4" aria-hidden="true" /> Toutes les primes sont payées.
        </div>
      ) : null}
    </section>
  );
}
