/** Centre d'impression : documents cochables selon la phase, aperçu papier, ouverture. */
import { Printer, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { docsFor } from "@/print/docs";
import type { Day } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { useToast } from "./Toast";
import { Button } from "./ui";

export function PrintCenter({
  day,
  open,
  onClose,
}: {
  day: Day;
  open: boolean;
  onClose: () => void;
}) {
  const { state } = useTournament();
  const navigate = useNavigate();
  const toast = useToast();
  const docs = useMemo(() => docsFor(day, state), [day, state]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(docs.map((d) => d.id)));
  const [previewId, setPreviewId] = useState<string | null>(null);

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
  const preview = docs.find((d) => d.id === previewId) ?? selected[0];

  const go = () => {
    if (selected.length === 0) {
      toast("Cochez au moins un document");
      return;
    }
    const path = `/tournoi/imprimer/${selected.map((d) => d.id).join("+")}`;
    const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
    const win = window.open(url, "_blank", "noopener");
    if (!win) void navigate(path);
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
            className="bg-surface shadow-raised grid max-h-[90vh] w-full max-w-[980px] grid-cols-1 overflow-hidden rounded-[20px] md:grid-cols-[320px_1fr]"
            initial={{ scale: 0.97, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-line flex max-h-[90vh] flex-col gap-2 overflow-auto p-[18px] md:border-r">
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
              <p className="text-ink-muted mb-1 text-[12px]">
                Documents proposés pour cette étape. Chaque document s'ouvre en vue A4 avec un
                bouton « Imprimer ».
              </p>
              {docs.length === 0 ? (
                <p className="text-ink-muted text-[13px]">
                  Aucun document disponible pour le moment.
                </p>
              ) : null}
              {docs.map((d) => (
                <label
                  key={d.id}
                  className={`border-line flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-[13px] ${
                    previewId === d.id ? "bg-brand-soft" : "bg-surface-2"
                  }`}
                  onMouseEnter={() => setPreviewId(d.id)}
                >
                  <input
                    type="checkbox"
                    className="accent-brand"
                    checked={checked.has(d.id)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(d.id);
                      else next.delete(d.id);
                      setChecked(next);
                      setPreviewId(d.id);
                    }}
                  />
                  <span className="min-w-0 flex-1">{d.label}</span>
                  <span className="text-ink-muted font-mono text-[11px]">{d.pages(state)} p.</span>
                </label>
              ))}
              <div className="mt-auto flex gap-2 pt-3">
                <Button onClick={onClose}>Fermer</Button>
                <Button variant="primary" icon={Printer} className="flex-1" onClick={go}>
                  Ouvrir {pages > 0 ? `· ${pages} p.` : ""}
                </Button>
              </div>
            </div>
            <div className="hidden overflow-auto bg-[#e9edf5] p-5 md:block">
              {preview ? (
                <div
                  className="origin-top-left"
                  style={
                    preview.landscape
                      ? { width: "297mm", transform: "scale(0.5)", marginBottom: "-50%" }
                      : { width: "210mm", transform: "scale(0.72)", marginBottom: "-28%" }
                  }
                  aria-hidden="true"
                >
                  {preview.render(state)}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
