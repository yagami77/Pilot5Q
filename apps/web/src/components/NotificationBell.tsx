/**
 * Cloche des notifications (barre haute) : compteur des non lues, panneau des dernières
 * notifications (forfait saisi par le responsable, nouvel inscrit…) avec leur impact.
 * Les notifications arrivent en direct depuis l'espace responsable (autre onglet).
 */
import { Bell, CheckCheck, Info, LayoutGrid, UserPlus, UserX } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { clock, shortDate } from "@/lib/format";
import { useNotifications, type Notification } from "@/lib/notifications";
import { useTournament } from "@/store/tournament";

import { cx } from "./ui";

export const KIND_ICON = {
  forfait: UserX,
  inscription: UserPlus,
  info: Info,
  billards: LayoutGrid,
} as const;

export const KIND_TONE: Record<Notification["kind"], string> = {
  forfait: "bg-alert-soft text-alert-ink",
  inscription: "bg-ok-soft text-ok-ink",
  info: "bg-brand-soft text-brand-ink",
  billards: "bg-gold-soft text-gold-ink",
};

function when(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const isoDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return same ? clock(d) : `${shortDate(isoDay)} · ${clock(d)}`;
}

export function NotificationItem({ n, compact = false }: { n: Notification; compact?: boolean }) {
  const Icon = KIND_ICON[n.kind];
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cx("grid size-7 shrink-0 place-items-center rounded-full", KIND_TONE[n.kind])}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <b className="min-w-0 flex-1 truncate text-[13px]">{n.title}</b>
          <span className="text-ink-muted shrink-0 font-mono text-[10.5px]">{when(n.at)}</span>
        </div>
        {!compact && n.body ? (
          <p className="text-ink-muted mt-0.5 text-[12px] leading-snug">{n.body}</p>
        ) : null}
        {n.impact ? (
          <p className="text-ink-secondary mt-1 text-[12px] font-semibold">→ {n.impact}</p>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { id } = useTournament();
  const { notifications, unread, markRead } = useNotifications(id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const prevUnread = useRef(unread.length);

  // Arrivée d'une notification : la cloche oscille
  useEffect(() => {
    if (unread.length > prevUnread.current) {
      void controls.start({
        rotate: [0, -16, 13, -9, 6, 0],
        transition: { duration: 0.7, ease: "easeInOut" },
      });
    }
    prevUnread.current = unread.length;
  }, [unread.length, controls]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Notifications${unread.length ? ` : ${unread.length} non lue(s)` : ""}`}
        className={cx(
          "border-line-2 bg-surface hover:bg-brand-soft relative grid size-8 place-items-center rounded-[10px] border transition-colors",
          open && "bg-brand-soft",
        )}
      >
        <motion.span animate={controls} className="grid origin-top place-items-center">
          <Bell className="size-4" aria-hidden="true" />
        </motion.span>
        <AnimatePresence>
          {unread.length ? (
            <motion.span
              key={unread.length}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 22 }}
              className="bg-alert absolute -top-1.5 -right-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white px-1 font-mono text-[9.5px] font-bold text-white"
            >
              {unread.length > 9 ? "9+" : unread.length}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="bg-surface border-line shadow-raised absolute top-[calc(100%+6px)] right-0 z-50 w-[360px] max-w-[calc(100vw-24px)] origin-top-right overflow-hidden rounded-[14px] border"
          >
            <div className="border-line flex items-center gap-2 border-b px-3.5 py-2.5">
              <span className="text-ink-muted text-[11px] font-bold tracking-[0.06em] uppercase">
                Notifications
              </span>
              {unread.length ? (
                <button
                  type="button"
                  onClick={() => void markRead()}
                  className="text-brand ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold"
                >
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  Tout marquer comme lu
                </button>
              ) : null}
            </div>
            <ul className="max-h-[400px] overflow-auto">
              <AnimatePresence initial={false}>
                {notifications.map((n) => (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                    className={cx(
                      "border-line border-b px-3.5 py-2.5 last:border-b-0",
                      !n.read && "bg-brand-soft/50",
                    )}
                    onMouseEnter={() => {
                      if (!n.read) void markRead(n.id);
                    }}
                  >
                    <NotificationItem n={n} />
                  </motion.li>
                ))}
              </AnimatePresence>
              {notifications.length === 0 ? (
                <li className="text-ink-muted px-3.5 py-6 text-center text-[12.5px]">
                  Aucune notification. Les forfaits et inscriptions saisis par le responsable
                  national apparaîtront ici.
                </li>
              ) : null}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Bandeau des notifications non lues, dans la journée concernée, avec leur impact. */
export function NotificationBanner() {
  const { id } = useTournament();
  const { unread, markRead } = useNotifications(id);
  return (
    <AnimatePresence initial={false}>
      {unread.length ? (
        <motion.div
          key="banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="no-print overflow-hidden"
        >
          <div className="border-[#f2d48a] bg-gold-soft/70 mt-1 mb-2 rounded-[14px] border px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <Bell className="text-gold-ink size-4" aria-hidden="true" />
              <b className="text-gold-ink text-[13px]">
                {unread.length > 1
                  ? `${unread.length} nouvelles notifications`
                  : "Nouvelle notification"}
              </b>
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-gold-ink hover:bg-gold-soft ml-auto rounded-[8px] px-2 py-1 text-[12px] font-bold"
              >
                C'est noté
              </button>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {unread.slice(0, 4).map((n) => (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface/80 rounded-[10px] px-3 py-2"
                >
                  <NotificationItem n={n} compact />
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
