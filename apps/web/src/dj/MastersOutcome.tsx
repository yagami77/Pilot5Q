/**
 * Issue des poules Masters, affichée sous les poules une fois la phase classée (retours du
 * 11 novembre) : les 8 qualifiés avec leur quart de finale (SPEC §5 : Q1 = 1er P1 – 2e P4,
 * Q2 = 1er P3 – 2e P2, Q3 = 1er P4 – 2e P1, Q4 = 1er P2 – 2e P3), les 8 éliminés (3e et 4e de
 * chaque poule) avec le montant de leur prime et la case « payé », et le bouton qui ouvre le
 * détail des primes dans un volet repliable. Remplace la tâche « Primes des poules Masters ».
 */
import { ChevronDown, Coins, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Button, Chip, cx } from "@/components/ui";
import { nice, plural } from "@/lib/format";

import { PaidBox, PrimesPanel, euro2, usePrimes } from "./Primes";

/** « 1er P1 » → « 1er poule 1 ». */
const seedLabel = (label: string | undefined) => (label ?? "").replace(/\bP(\d+)\b/, "poule $1");

export function MastersOutcome() {
  const { state, sheet, isPaid, toggle, lock } = usePrimes();
  const [open, setOpen] = useState(false);
  const quarts = state.brackets.M.filter((m) => m.round === "QF").sort((a, b) => a.slot - b.slot);
  const out = sheet.lines.filter((l) => l.when === "samedi");
  if (!state.closed.QM || quarts.length === 0) return null;
  const qualified = quarts.flatMap((m) => [m.a, m.b]).filter(Boolean).length;
  const paid = out.filter(isPaid).length;
  const amount = out[0]?.amount ?? 0;

  return (
    <div id="masters-issue" className="border-line scroll-mt-4 border-t">
      <div className="grid gap-x-5 gap-y-4 px-4 pt-3.5 pb-4 lg:grid-cols-2">
        <section aria-label="Qualifiés pour les quarts de finale">
          <header className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-[13.5px] font-bold">
              {plural(qualified, "qualifié")} pour les quarts
            </h4>
            <Chip tone="gold" icon={Trophy}>
              dimanche
            </Chip>
          </header>
          <ol className="grid gap-2 sm:grid-cols-2">
            {quarts.map((m, i) => (
              <li
                key={m.id}
                className="border-line bg-surface-2/60 animate-slide-in rounded-[12px] border px-3 py-2"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="text-ink-muted mb-1 flex items-center gap-2 text-[10.5px] font-extrabold tracking-[0.07em] uppercase">
                  <span className="bg-gold-soft text-gold-ink rounded-[6px] px-1.5 py-[1px] font-mono tracking-normal">
                    Q{m.slot}
                  </span>
                  Quart {m.slot}
                  {m.billard ? (
                    <span className="text-ink-secondary ml-auto font-mono font-semibold tracking-normal normal-case">
                      Billard {m.billard}
                    </span>
                  ) : null}
                </div>
                {(["a", "b"] as const).map((side) => (
                  <div key={side} className="flex items-baseline gap-2 py-[2px] text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {nice(side === "a" ? m.a : m.b) || "–"}
                    </span>
                    <span className="text-ink-muted shrink-0 text-[11px]">
                      {seedLabel(side === "a" ? m.labelA : m.labelB)}
                    </span>
                  </div>
                ))}
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Éliminés des poules Masters et primes">
          <header className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-[13.5px] font-bold">
              {plural(out.length, "éliminé")} · prime de {euro2(amount)}
            </h4>
            <Chip tone={paid === out.length && paid > 0 ? "green" : "grey"}>
              {paid}/{out.length} payée{paid > 1 ? "s" : ""}
            </Chip>
            <Button
              size="sm"
              icon={Coins}
              iconRight={ChevronDown}
              className={cx(
                "ml-auto [&>svg:last-child]:transition-transform",
                open && "[&>svg:last-child]:rotate-180",
              )}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Masquer les primes" : "Voir les primes"}
            </Button>
          </header>
          <ul className="border-line divide-line divide-y rounded-[12px] border">
            {out.map((l, i) => (
              <li
                key={l.key}
                className={cx(
                  "animate-slide-in flex items-center gap-2.5 px-3 py-[5px] text-[13px] transition-colors duration-300",
                  isPaid(l) && "bg-ok-soft/50",
                )}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <span className="text-ink-muted w-[74px] shrink-0 text-[11px]">{l.detail}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {l.name ? nice(l.name) : "–"}
                </span>
                <span className="font-mono text-[12.5px] font-semibold tabular-nums">
                  {euro2(l.amount)}
                </span>
                <PaidBox line={l} paid={isPaid(l)} disabled={lock} onToggle={() => toggle(l)} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Détail des primes : volet qui s'ouvre sur demande et disparaît quand on le replie */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="primes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <PrimesPanel id="primes" open onToggle={setOpen} title="Primes du tournoi" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
