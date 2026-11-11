/**
 * Primes (SPEC §6) : montants prévus dès le départ, chaque ligne se remplit quand son
 * bénéficiaire est connu (samedi : 3e et 4e des poules Masters ; dimanche : après chaque tour),
 * case « payé » (suivi local), totaux payé / restant et impression pour préparer les chèques.
 *
 * Une seule source de calcul : `primesOf` du domaine, via `progressivePrimes`.
 *
 * Retours du 11 novembre : les primes ne sont plus en permanence en haut de l'écran. Elles
 * s'ouvrent dans un volet repliable (`PrimesPanel`) : le samedi sous les poules Masters, par le
 * bouton « Voir les primes » ; le dimanche en tête de page, replié une fois consulté.
 */
import { Check, ChevronDown, Clock, Coins, Printer, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { RollingNumber } from "@/components/RollingNumber";
import { Button, Card, Chip, PageHead, Tile, cx } from "@/components/ui";
import { useDjMeta } from "@/lib/djMeta";
import { nice } from "@/lib/format";
import { primesTotals, progressivePrimes, type PrimeLine } from "@/lib/primes";
import { useEditLock, useTournament } from "@/store/tournament";

export function euro2(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Feuille des primes du tournoi et suivi « payé » (local au directeur de jeu). */
export function usePrimes(readOnly = false) {
  const { state, id } = useTournament();
  const [meta, update] = useDjMeta(id);
  const lock = useEditLock() || readOnly;
  const sheet = useMemo(() => progressivePrimes(state), [state]);
  const totals = primesTotals(sheet.lines, meta.paid);
  const isPaid = (l: PrimeLine) => Boolean(meta.paid[l.key]) && Boolean(l.name);
  const toggle = (l: PrimeLine) => {
    if (lock || !l.name) return;
    void update((m) => {
      const paid = { ...m.paid };
      if (paid[l.key]) delete paid[l.key];
      else paid[l.key] = new Date().toISOString();
      return { ...m, paid };
    });
  };
  return { state, sheet, totals, isPaid, toggle, lock };
}

/** Case « payé » d'une prime. */
export function PaidBox({
  line,
  paid,
  disabled,
  onToggle,
}: {
  line: PrimeLine;
  paid: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={`Prime payée : ${line.label} ${line.detail}`}
      disabled={disabled || !line.name}
      onClick={onToggle}
      className={cx(
        "inline-grid size-[22px] place-items-center rounded-[7px] border-[1.5px] transition-[background-color,border-color] duration-200 disabled:opacity-40",
        paid ? "bg-ok border-ok text-white" : "border-line-2 bg-surface hover:border-ok",
      )}
    >
      {paid ? (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
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
  );
}

const openPrint = () => {
  const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/tournoi/imprimer/primes`;
  window.open(url, "_blank", "noopener");
};

/** Détail des primes : synthèse de la cagnotte et tableaux Masters / National. */
export function PrimesDetail({
  readOnly = false,
  compact = false,
}: {
  readOnly?: boolean;
  /** Dans un volet : synthèse sur une ligne au lieu des tuiles. */
  compact?: boolean;
}) {
  const { state, sheet, totals, isPaid, toggle, lock } = usePrimes(readOnly);
  const known = sheet.lines.filter((l) => l.name).length;
  const formula = `${state.rules.inscriptionFee} € × ${sheet.players - sheet.juniors} + ${sheet.ffb} € FFB + ${sheet.club} € club`;

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
        className={compact ? "shadow-none" : undefined}
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
              const paid = isPaid(l);
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
                    <PaidBox line={l} paid={paid} disabled={lock} onToggle={() => toggle(l)} />
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
    <>
      {compact ? (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-[12.5px]">
          <Chip tone="gold" icon={Coins}>
            Cagnotte {euro2(sheet.total)}
          </Chip>
          <span className="text-ink-muted">{formula}</span>
          <span className="flex-1" />
          <Chip tone="grey">
            Bénéficiaires connus {known}/{sheet.lines.length}
          </Chip>
          <Chip tone="green">Payé {euro2(totals.paid)}</Chip>
          <Chip tone="blue">Restant {euro2(totals.remaining)}</Chip>
          <Button size="sm" icon={Printer} onClick={openPrint}>
            Imprimer pour les chèques
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Tile label="Cagnotte" value={euro2(sheet.total)} detail={formula} tone="gold" />
          <Tile label="Bénéficiaires connus" value={`${known}/${sheet.lines.length}`} />
          <Tile label="Payé" value={euro2(totals.paid)} detail={`${totals.paidCount} chèque(s)`} />
          <Tile label="Restant" value={euro2(totals.remaining)} tone="blue" />
        </div>
      )}

      <div
        className={cx(
          "grid items-start gap-3.5 lg:grid-cols-2",
          compact ? "border-line border-t px-2 pt-2 pb-2" : "mt-3.5",
        )}
      >
        {block("M", "Masters · 80 %", "gold")}
        {block("N", "National · 20 %", "green")}
      </div>
      {totals.paidCount > 0 && totals.paidCount === sheet.lines.length ? (
        <div
          className={cx(
            "bg-ok-soft text-ok-ink animate-pop flex items-center gap-2 rounded-[12px] px-4 py-3 font-semibold",
            compact ? "mx-4 mb-4" : "mt-3.5",
          )}
        >
          <Check className="size-4" aria-hidden="true" /> Toutes les primes sont payées.
        </div>
      ) : null}
    </>
  );
}

/** Page « Primes » (adresse directe ; les journées l'ouvrent en volet). */
export function Primes({ readOnly = false }: { readOnly?: boolean }) {
  const { state } = useTournament();
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
      <PrimesDetail readOnly={readOnly} />
    </section>
  );
}

/* ---------- Volet repliable ---------- */

/**
 * État ouvert / replié d'un volet, mémorisé dans ce navigateur (confort local) : ouvert à la
 * première consultation, replié par défaut aux suivantes, puis tel que l'utilisateur l'a laissé
 * (un volet rouvert à la main reste ouvert).
 */
export function usePanelOpen(key: string): [boolean, (open: boolean) => void] {
  const storageKey = `pilot5q:panel:${key}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(storageKey) !== "0";
    } catch {
      return true;
    }
  });
  const store = useCallback(
    (v: boolean) => {
      try {
        window.localStorage.setItem(storageKey, v ? "1" : "0");
      } catch {
        /* stockage indisponible : l'état reste pour la session */
      }
    },
    [storageKey],
  );
  // Première consultation : le volet est montré ouvert, et noté comme consulté
  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === null) store(false);
    } catch {
      /* ignoré */
    }
  }, [storageKey, store]);
  const update = useCallback(
    (v: boolean) => {
      setOpen(v);
      store(v);
    },
    [store],
  );
  return [open, update];
}

/** Volet des primes : en-tête toujours visible (cagnotte, payé), détail repliable. */
export function PrimesPanel({
  open,
  onToggle,
  id,
  title = "Primes",
  aside,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  id?: string;
  title?: string;
  aside?: ReactNode;
}) {
  const { sheet, totals } = usePrimes();
  const bodyId = useId();
  const known = sheet.lines.filter((l) => l.name).length;
  return (
    <section id={id} className="card scroll-mt-4 overflow-hidden" aria-label={title}>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="hover:bg-surface-2 flex w-full flex-wrap items-center gap-2.5 px-4 py-3 text-left transition-colors"
      >
        <span className="bg-gold-soft text-gold-ink grid size-7 shrink-0 place-items-center rounded-full">
          <Coins className="size-4" aria-hidden="true" />
        </span>
        <span className="text-[14px] font-bold">{title}</span>
        <span className="text-gold-ink font-mono text-[13px] font-bold tabular-nums">
          {euro2(sheet.total)}
        </span>
        <span className="text-ink-muted text-[12px]">
          {totals.paidCount}/{known} payée{totals.paidCount > 1 ? "s" : ""} · restant{" "}
          {euro2(totals.remaining)}
        </span>
        {aside}
        <span className="text-brand ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold">
          {open ? "Replier" : "Afficher le détail"}
          <ChevronDown
            className={cx("size-4 transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={bodyId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-line border-t pt-3">
              <PrimesDetail compact />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
