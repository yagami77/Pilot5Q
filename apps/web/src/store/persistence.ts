/** Persistance locale du journal d'événements (IndexedDB via idb-keyval). */
import type { TournamentEvent } from "@pilot5q/domain";
import { del, get, set } from "idb-keyval";

const CURRENT_KEY = "pilot5q:current";
export const eventsKey = (tournamentId: string) => `pilot5q:events:${tournamentId}`;

export interface TournamentSummary {
  id: string;
  name: string;
  city: string;
  updatedAt: string;
}

const INDEX_KEY = "pilot5q:index";

export async function loadCurrentId(): Promise<string | null> {
  try {
    return (await get<string>(CURRENT_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveCurrentId(id: string | null): Promise<void> {
  try {
    if (id === null) await del(CURRENT_KEY);
    else await set(CURRENT_KEY, id);
  } catch {
    /* stockage indisponible (navigation privée) : on continue en mémoire */
  }
}

export async function loadEvents(id: string): Promise<TournamentEvent[]> {
  try {
    return (await get<TournamentEvent[]>(eventsKey(id))) ?? [];
  } catch {
    return [];
  }
}

export async function saveEvents(id: string, events: TournamentEvent[]): Promise<void> {
  await set(eventsKey(id), events);
}

export async function loadIndex(): Promise<TournamentSummary[]> {
  try {
    return (await get<TournamentSummary[]>(INDEX_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function upsertIndex(summary: TournamentSummary): Promise<void> {
  try {
    const list = (await loadIndex()).filter((s) => s.id !== summary.id);
    await set(INDEX_KEY, [summary, ...list].slice(0, 20));
  } catch {
    /* ignoré */
  }
}

export async function removeTournament(id: string): Promise<void> {
  try {
    await del(eventsKey(id));
    const list = (await loadIndex()).filter((s) => s.id !== id);
    await set(INDEX_KEY, list);
  } catch {
    /* ignoré */
  }
}
