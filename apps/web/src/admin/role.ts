/** Rôle courant (responsable national ou directeur de jeu), mémorisé dans ce navigateur. */
import { useCallback, useSyncExternalStore } from "react";

export type Role = "responsable" | "dj";

const KEY = "pilot5q:role";
const listeners = new Set<() => void>();

function read(): Role {
  try {
    return window.localStorage.getItem(KEY) === "responsable" ? "responsable" : "dj";
  } catch {
    return "dj";
  }
}

export function setRole(role: Role): void {
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    /* navigation privée */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRole(): [Role, (r: Role) => void] {
  const role = useSyncExternalStore(subscribe, read, () => "dj" as Role);
  const update = useCallback((r: Role) => setRole(r), []);
  return [role, update];
}

export const ROLE_LABELS: Record<Role, string> = {
  responsable: "Responsable national",
  dj: "Directeur de jeu",
};
