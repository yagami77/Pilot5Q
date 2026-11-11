/**
 * Suivi local du directeur de jeu, hors journal du tournoi : documents imprimés, forfaits de
 * dernière minute vérifiés, validations du jeudi (billards, affectation), primes payées, texte
 * d'informations aux joueurs.
 *
 * Persistance idb-keyval (`pilot5q:dj:<tournamentId>`), diffusion entre onglets par
 * `BroadcastChannel("pilot5q")` (la vue d'impression s'ouvre dans un autre onglet).
 */
import { get, set } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";

/** Validation explicite : empreinte de ce qui a été validé (voir `lib/jeudiValidation`). */
export interface Validation {
  signature: string;
  /** Horodatage ISO de la validation. */
  at: string;
}

export interface DjMeta {
  /** Documents ouverts pour impression : id → horodatage ISO. */
  printed: Record<string, string>;
  /** Journées dont les forfaits de dernière minute ont été vérifiés. */
  forfaitsChecked: Record<string, string>;
  /**
   * Validations du jeudi par le DJ : structure des billards, affectation des poules du vendredi.
   * On garde l'empreinte de ce qui a été validé : toute modification ultérieure se voit.
   */
  validated: Partial<Record<"billards" | "affectation", Validation>>;
  /** Primes payées : clé de ligne → horodatage ISO. */
  paid: Record<string, string>;
  /** Informations aux joueurs (logistique, hébergement, restauration). */
  info: { text: string; subject: string; updatedAt: string | null };
}

export const emptyMeta = (): DjMeta => ({
  printed: {},
  forfaitsChecked: {},
  validated: {},
  paid: {},
  info: { text: "", subject: "", updatedAt: null },
});

export const djMetaKey = (tournamentId: string) => `pilot5q:dj:${tournamentId}`;
const CHANNEL = "pilot5q";

const cache = new Map<string, DjMeta>();
const listeners = new Set<(tid: string) => void>();

function announce(tid: string): void {
  for (const fn of listeners) fn(tid);
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "djmeta", tournamentId: tid });
    bc.close();
  } catch {
    /* canal indisponible */
  }
}

export async function loadMeta(tid: string): Promise<DjMeta> {
  try {
    const raw = await get<Partial<DjMeta>>(djMetaKey(tid));
    const m = { ...emptyMeta(), ...(raw ?? {}) };
    cache.set(tid, m);
    return m;
  } catch {
    return cache.get(tid) ?? emptyMeta();
  }
}

/** Modifie le suivi (lecture fraîche, écriture, diffusion). */
export async function updateMeta(tid: string, fn: (m: DjMeta) => DjMeta): Promise<DjMeta> {
  const next = fn(await loadMeta(tid));
  cache.set(tid, next);
  try {
    await set(djMetaKey(tid), next);
  } catch {
    /* stockage indisponible : reste en mémoire */
  }
  announce(tid);
  return next;
}

/** Note des documents comme imprimés. */
export function markPrinted(tid: string, ids: string[]): Promise<DjMeta> {
  const at = new Date().toISOString();
  return updateMeta(tid, (m) => {
    const printed = { ...m.printed };
    for (const id of ids) printed[id] = at;
    return { ...m, printed };
  });
}

/** Suivi du DJ pour un tournoi, rafraîchi en direct. */
export function useDjMeta(tid: string | null | undefined) {
  const [meta, setMeta] = useState<DjMeta>(() => (tid ? cache.get(tid) : null) ?? emptyMeta());
  useEffect(() => {
    if (!tid) return;
    let alive = true;
    const load = () =>
      void loadMeta(tid).then((m) => {
        if (alive) setMeta(m);
      });
    load();
    const local = (x: string) => {
      if (x === tid) load();
    };
    listeners.add(local);
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = (e: MessageEvent<{ type?: string; tournamentId?: string }>) => {
          if (e.data?.type === "djmeta" && e.data.tournamentId === tid) load();
        };
      } catch {
        bc = null;
      }
    }
    return () => {
      alive = false;
      listeners.delete(local);
      bc?.close();
    };
  }, [tid]);
  const update = useCallback(
    async (fn: (m: DjMeta) => DjMeta) => {
      if (!tid) return;
      setMeta(await updateMeta(tid, fn));
    },
    [tid],
  );
  return [meta, update] as const;
}
