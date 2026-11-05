/**
 * Notifications du directeur de jeu (contrat partagé avec l'espace responsable).
 *
 * - Persistance locale (idb-keyval), une liste par tournoi : `pilot5q:notifications:<tournamentId>`.
 * - Diffusion en direct entre onglets : `BroadcastChannel("pilot5q")` et, en secours, l'événement
 *   `storage` (clé `pilot5q:notifications:ping`). Dans un même onglet, un bus local prévient les
 *   abonnés.
 * - Le responsable écrit avec `addNotification` (forfait, inscription…) ; le DJ lit avec
 *   `useNotifications` (cloche, bandeau de la journée).
 */
import { get, set } from "idb-keyval";
import { useCallback, useEffect, useMemo, useState } from "react";

export type NotificationKind = "forfait" | "inscription" | "info" | "billards";

export interface Notification {
  id: string;
  tournamentId: string;
  /** Horodatage ISO 8601. */
  at: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Impact pour le DJ (« Poule 5 passe à 3 joueurs »). */
  impact?: string;
  read: boolean;
}

/** Alias explicite (évite la confusion avec l'API `Notification` du navigateur). */
export type DjNotification = Notification;

export type NotificationInput = Omit<Notification, "id" | "at" | "read"> &
  Partial<Pick<Notification, "id" | "at" | "read">>;

export const notificationsKey = (tournamentId: string) => `pilot5q:notifications:${tournamentId}`;
const CHANNEL = "pilot5q";
const PING_KEY = "pilot5q:notifications:ping";

interface ChangeMessage {
  type: "notifications";
  tournamentId: string;
}

/* ---------- diffusion ---------- */

const local = new Set<(tournamentId: string) => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch {
    channel = null;
  }
  return channel;
}

function announce(tournamentId: string): void {
  for (const fn of local) fn(tournamentId);
  const msg: ChangeMessage = { type: "notifications", tournamentId };
  try {
    getChannel()?.postMessage(msg);
  } catch {
    /* canal fermé */
  }
  try {
    window.localStorage.setItem(PING_KEY, JSON.stringify({ ...msg, at: Date.now() }));
  } catch {
    /* stockage indisponible */
  }
}

/** S'abonne aux changements (même onglet et autres onglets). Rend la fonction de désabonnement. */
export function subscribeNotifications(fn: (tournamentId: string) => void): () => void {
  local.add(fn);
  let bc: BroadcastChannel | null = null;
  const onMessage = (e: MessageEvent<ChangeMessage>) => {
    if (e.data?.type === "notifications") fn(e.data.tournamentId);
  };
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.addEventListener("message", onMessage);
    } catch {
      bc = null;
    }
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PING_KEY || !e.newValue) return;
    try {
      const msg = JSON.parse(e.newValue) as ChangeMessage;
      if (msg.type === "notifications") fn(msg.tournamentId);
    } catch {
      /* message illisible */
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    local.delete(fn);
    bc?.removeEventListener("message", onMessage);
    bc?.close();
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/* ---------- persistance ---------- */

/** Notifications d'un tournoi, la plus récente en premier. */
export async function listNotifications(tournamentId: string): Promise<Notification[]> {
  try {
    const list = (await get<Notification[]>(notificationsKey(tournamentId))) ?? [];
    return [...list].sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

async function save(tournamentId: string, list: Notification[]): Promise<void> {
  try {
    await set(notificationsKey(tournamentId), list);
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

function newId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `n-${Date.now().toString(36)}-${rnd}`;
}

/** Ajoute une notification et prévient les autres onglets. */
export async function addNotification(input: NotificationInput): Promise<Notification> {
  const n: Notification = {
    id: input.id ?? newId(),
    at: input.at ?? new Date().toISOString(),
    read: input.read ?? false,
    tournamentId: input.tournamentId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    ...(input.impact !== undefined ? { impact: input.impact } : {}),
  };
  const list = await listNotifications(n.tournamentId);
  await save(n.tournamentId, [n, ...list.filter((x) => x.id !== n.id)].slice(0, 200));
  announce(n.tournamentId);
  return n;
}

/** Marque comme lues les notifications données (toutes si `ids` est omis). */
export async function markRead(tournamentId: string, ids?: string | string[]): Promise<void> {
  const only = ids === undefined ? null : new Set(Array.isArray(ids) ? ids : [ids]);
  const list = await listNotifications(tournamentId);
  let changed = false;
  const next = list.map((n) => {
    if (n.read || (only && !only.has(n.id))) return n;
    changed = true;
    return { ...n, read: true };
  });
  if (!changed) return;
  await save(tournamentId, next);
  announce(tournamentId);
}

/* ---------- hook ---------- */

export interface NotificationsHook {
  notifications: Notification[];
  unread: Notification[];
  add: (input: Omit<NotificationInput, "tournamentId">) => Promise<Notification | null>;
  markRead: (ids?: string | string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

/** Notifications d'un tournoi, rafraîchies en direct (même onglet et autres onglets). */
export function useNotifications(tournamentId: string | null | undefined): NotificationsHook {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    if (!tournamentId) {
      setNotifications([]);
      return;
    }
    setNotifications(await listNotifications(tournamentId));
  }, [tournamentId]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (!tournamentId) return;
      void listNotifications(tournamentId).then((l) => {
        if (alive) setNotifications(l);
      });
    };
    if (!tournamentId) setNotifications([]);
    load();
    const off = subscribeNotifications((tid) => {
      if (tid === tournamentId) load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [tournamentId]);

  const add = useCallback(
    async (input: Omit<NotificationInput, "tournamentId">) =>
      tournamentId ? addNotification({ ...input, tournamentId }) : null,
    [tournamentId],
  );
  const mark = useCallback(
    async (ids?: string | string[]) => {
      if (tournamentId) await markRead(tournamentId, ids);
    },
    [tournamentId],
  );
  const unread = useMemo(() => notifications.filter((n) => !n.read), [notifications]);

  return { notifications, unread, add, markRead: mark, refresh };
}
