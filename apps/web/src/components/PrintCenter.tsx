/**
 * Centre d'impression : documents cochables selon la phase, aperçu papier, impression directe.
 *
 * « Imprimer » ouvre la vue A4 des documents cochés et lance la boîte d'impression du
 * navigateur ; « Aperçu » ouvre la même vue sans imprimer.
 *
 * La fenêtre a une hauteur fixe : l'aperçu (portrait, paysage, une ou plusieurs pages) défile
 * dans son cadre sans jamais changer la taille de la fenêtre. Auparavant la hauteur suivait
 * l'aperçu : au survol du schéma (paysage, plus court), la fenêtre centrée rétrécissait, la
 * ligne glissait sous la souris, le survol passait à la ligne voisine, la fenêtre regrandissait,
 * et ainsi de suite (scintillement).
 */
import type { TournamentState } from "@pilot5q/domain";
import { Eye, Printer, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { markPrinted } from "@/lib/djMeta";
import { docsFor, type DocDef } from "@/print/docs";
import { openPrintView, printPath } from "@/print/launch";
import type { Day } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { useToast } from "./Toast";
import { Button } from "./ui";

/** Aperçu papier réduit d'un document (rendu coûteux : mémorisé par document et par état). */
const Preview = memo(function Preview({ doc, state }: { doc: DocDef; state: TournamentState }) {
  return (
    <div
      // `zoom` réduit aussi l'encombrement (contrairement à `transform`) : pas de vide à faire défiler
      style={{ width: doc.landscape ? "297mm" : "210mm", zoom: doc.landscape ? 0.5 : 0.72 }}
      aria-hidden="true"
    >
      {doc.render(state)}
    </div>
  );
});

export function PrintCenter({
  day,
  open,
  onClose,
}: {
  day: Day;
  open: boolean;
  onClose: () => void;
}) {
  const { state, id } = useTournament();
  const navigate = useNavigate();
  const toast = useToast();
  const docs = useMemo(() => docsFor(day, state), [day, state]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(docs.map((d) => d.id)));
  const [previewId, setPreviewId] = useState<string | null>(null);
  // La ligne survolée se met en évidence tout de suite ; l'aperçu suit sans bloquer le survol
  const shownId = useDeferredValue(previewId);

  useEffect(() => {
    if (open) {
      setChecked(new Set(docs.map((d) => d.id)));
      setPreviewId(docs[0]?.id ?? null);
    }
  }, [open, docs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selected = docs.filter((d) => checked.has(d.id));
  const pages = selected.reduce((n, d) => n + d.pages(state), 0);
  const preview = docs.find((d) => d.id === shownId) ?? selected[0];

  /** Ouvre la vue A4 des documents cochés ; `print` : lance aussi la boîte d'impression. */
  const go = (print: boolean) => {
    if (selected.length === 0) {
      toast("Cochez au moins un document");
      return;
    }
    const ids = selected.map((d) => d.id);
    // Suivi « documents imprimés » : seulement quand l'impression est lancée
    if (print && id) void markPrinted(id, ids);
    // Nouvel onglet ; s'il est bloqué par le navigateur, la vue s'ouvre dans l'onglet courant
    if (!openPrintView(ids, print)) void navigate(printPath(ids, print));
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="no-print fixed inset-0 z-[70] grid place-items-center bg-[rgb(15_27_51/0.35)] p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Imprimer"
            className="bg-surface shadow-raised grid h-[min(90vh,820px)] w-full max-w-[980px] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[20px] md:grid-cols-[320px_minmax(0,1fr)]"
            initial={{ scale: 0.97, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-line flex min-h-0 flex-col p-[18px] md:border-r">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px]">Imprimer</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="bg-surface-2 border-line grid size-8 place-items-center rounded-[10px] border"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-ink-muted mt-1.5 mb-2.5 text-[12px]">
                Documents proposés pour cette étape. Survolez une ligne pour voir son aperçu.
              </p>
              {/* La liste défile dans la colonne : la fenêtre ne change jamais de taille */}
              <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-2">
                {docs.length === 0 ? (
                  <p className="text-ink-muted text-[13px]">
                    Aucun document disponible pour le moment.
                  </p>
                ) : null}
                {docs.map((d) => (
                  <label
                    key={d.id}
                    className={`flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[10px] border px-2.5 py-1.5 text-[13px] leading-[1.3] transition-colors ${
                      previewId === d.id
                        ? "bg-brand-soft border-brand/30"
                        : "bg-surface-2 border-line"
                    }`}
                    onMouseEnter={() => setPreviewId(d.id)}
                  >
                    <input
                      type="checkbox"
                      className="accent-brand shrink-0"
                      checked={checked.has(d.id)}
                      onFocus={() => setPreviewId(d.id)}
                      onChange={(e) => {
                        const next = new Set(checked);
                        if (e.target.checked) next.add(d.id);
                        else next.delete(d.id);
                        setChecked(next);
                        setPreviewId(d.id);
                      }}
                    />
                    <span className="min-w-0 flex-1">{d.label}</span>
                    <span className="text-ink-muted shrink-0 font-mono text-[11px] tabular-nums">
                      {d.pages(state)} p.
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex shrink-0 gap-2 pt-3">
                <Button icon={Eye} onClick={() => go(false)}>
                  Aperçu
                </Button>
                <Button
                  variant="primary"
                  icon={Printer}
                  className="flex-1"
                  onClick={() => go(true)}
                >
                  Imprimer{pages > 0 ? ` · ${pages} p.` : ""}
                </Button>
              </div>
              <p className="text-ink-muted mt-2.5 shrink-0 text-[11.5px] leading-[1.4]">
                « Imprimer » ouvre la boîte d'impression. Pour garder les documents pour plus tard,
                y choisir « Enregistrer au format PDF ».
              </p>
            </div>
            <div className="hidden min-h-0 overflow-auto bg-[#e9edf5] p-5 md:block">
              {preview ? <Preview doc={preview} state={state} /> : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
