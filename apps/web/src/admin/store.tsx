/**
 * Store de la saison du responsable national : document en mémoire, sauvegarde automatique
 * dans IndexedDB (clés `pilot5q:season:*`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  loadCurrentSeasonId,
  loadSeason,
  removeSeason,
  saveCurrentSeasonId,
  saveSeason,
  type SeasonDocument,
} from "./persistence";
import { migrateSeason } from "./stage";

export interface SeasonStore {
  ready: boolean;
  /** Document de la saison ouverte (null : aucune saison chargée). */
  doc: SeasonDocument | null;
  saving: boolean;
  savedAt: Date | null;
  /** Applique une transformation pure au document et l'enregistre. */
  update: (fn: (doc: SeasonDocument) => SeasonDocument) => void;
  /** Remplace la saison ouverte. */
  open: (doc: SeasonDocument) => void;
  /** Supprime la saison ouverte de ce navigateur. */
  destroy: () => void;
}

const Ctx = createContext<SeasonStore | null>(null);

export function SeasonProvider({
  children,
  initial = null,
  persist = true,
}: {
  children: ReactNode;
  initial?: SeasonDocument | null;
  persist?: boolean;
}) {
  const [doc, setDoc] = useState<SeasonDocument | null>(initial);
  const [ready, setReady] = useState(!persist);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    (async () => {
      const id = await loadCurrentSeasonId();
      if (cancelled) return;
      if (id) {
        const loaded = await loadSeason(id);
        if (cancelled) return;
        if (loaded) setDoc(migrateSeason(loaded));
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  useEffect(() => {
    if (!persist || !ready || !doc || !dirty.current) return;
    let cancelled = false;
    setSaving(true);
    const timer = window.setTimeout(() => {
      saveSeason(doc)
        .then(() => {
          if (!cancelled) setSavedAt(new Date());
        })
        .catch(() => {
          /* stockage indisponible : l'état reste en mémoire */
        })
        .finally(() => {
          if (!cancelled) setSaving(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, persist, ready]);

  const update = useCallback((fn: (d: SeasonDocument) => SeasonDocument) => {
    dirty.current = true;
    setDoc((prev) => (prev ? { ...fn(prev), updatedAt: new Date().toISOString() } : prev));
  }, []);

  const open = useCallback(
    (next: SeasonDocument) => {
      dirty.current = true;
      setDoc(next);
      if (persist) void saveCurrentSeasonId(next.id);
    },
    [persist],
  );

  const destroy = useCallback(() => {
    const current = doc?.id ?? null;
    dirty.current = false;
    setDoc(null);
    setSavedAt(null);
    if (persist) {
      void saveCurrentSeasonId(null);
      if (current) void removeSeason(current);
    }
  }, [doc, persist]);

  const value = useMemo<SeasonStore>(
    () => ({ ready, doc, saving, savedAt, update, open, destroy }),
    [ready, doc, saving, savedAt, update, open, destroy],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeason(): SeasonStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSeason doit être utilisé sous <SeasonProvider>");
  return ctx;
}

/** Document garanti (les pages sont protégées par AdminLayout). */
export function useSeasonDoc(): SeasonDocument {
  const { doc } = useSeason();
  if (!doc) throw new Error("Aucune saison ouverte");
  return doc;
}
