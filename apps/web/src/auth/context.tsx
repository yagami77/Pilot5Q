/**
 * Contexte d'authentification : session courante et actions de connexion, branchés sur un
 * `AuthProvider` (local aujourd'hui, serveur demain).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setRole } from "@/admin/role";

import { LocalAuthProvider } from "./local";
import type {
  AuthProvider,
  AuthResult,
  DemoSession,
  DjSession,
  ResponsableSession,
  Session,
} from "./provider";

/** Fournisseur par défaut de l'application. */
export const localAuth: AuthProvider = new LocalAuthProvider();

export interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  provider: AuthProvider;
  loginResponsable: (u: string, p: string) => Promise<AuthResult<ResponsableSession>>;
  loginDj: (email: string, code: string) => Promise<AuthResult<DjSession>>;
  startDemo: () => Promise<DemoSession>;
  logout: () => Promise<void>;
  /** Relit la session (après une clôture ou un retrait d'accès). */
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

function syncRole(s: Session | null) {
  if (s?.role === "responsable") setRole("responsable");
  else if (s) setRole("dj");
}

export function SessionProvider({
  children,
  provider = localAuth,
}: {
  children: ReactNode;
  provider?: AuthProvider;
}) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(async () => {
    const s = await provider.currentSession().catch(() => null);
    syncRole(s);
    setSession(s);
    setReady(true);
  }, [provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loginResponsable = useCallback(
    async (u: string, p: string) => {
      const r = await provider.loginResponsable(u, p);
      if (r.ok) {
        syncRole(r.session);
        setSession(r.session);
      }
      return r;
    },
    [provider],
  );

  const loginDj = useCallback(
    async (email: string, code: string) => {
      const r = await provider.loginDj(email, code);
      if (r.ok) {
        syncRole(r.session);
        setSession(r.session);
      }
      return r;
    },
    [provider],
  );

  const startDemo = useCallback(async () => {
    const s = await provider.startDemo();
    syncRole(s);
    setSession(s);
    return s;
  }, [provider]);

  const logout = useCallback(async () => {
    await provider.logout();
    setSession(null);
  }, [provider]);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, session, provider, loginResponsable, loginDj, startDemo, logout, refresh }),
    [ready, session, provider, loginResponsable, loginDj, startDemo, logout, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth doit être utilisé sous <SessionProvider>");
  return ctx;
}

/** Session de DJ en lecture seule (tournoi clôturé) : utile aux vues du cockpit. */
export function useReadOnly(): boolean {
  const ctx = useContext(Ctx);
  return ctx?.session?.role === "dj" && ctx.session.readOnly;
}
