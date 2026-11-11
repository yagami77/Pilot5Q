/**
 * Demande de confirmation d'un geste important (clôture ou réouverture du tournoi) : fenêtre
 * modale centrée, Échap ou clic hors de la fenêtre pour renoncer, focus sur « Annuler » à
 * l'ouverture pour qu'Entrée ne valide pas par mégarde.
 */
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button, cx } from "./ui";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Annuler",
  icon: Icon,
  tone = "brand",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  icon: LucideIcon;
  tone?: "brand" | "gold";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="no-print fixed inset-0 z-[80] grid place-items-center bg-[rgb(15_27_51/0.35)] p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-surface border-line w-full max-w-[460px] rounded-[16px] border p-5 shadow-[var(--shadow-raised)]"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  tone === "gold" ? "bg-gold-soft text-gold-ink" : "bg-brand-soft text-brand",
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-[17px] font-extrabold tracking-[-0.01em]">
                  {title}
                </h2>
                <div className="text-ink-secondary mt-1.5 text-[13px] leading-[1.5]">
                  {children}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2.5">
              <Button autoFocus onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button variant="primary" icon={Icon} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
