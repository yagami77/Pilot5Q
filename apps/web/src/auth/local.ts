/**
 * Implémentation locale de `AuthProvider` (IndexedDB via idb-keyval, clés `pilot5q:auth:*`).
 *
 * RAPPEL : rien n'est protégé ici (voir l'en-tête de `provider.ts`). Les empreintes SHA-256 salées
 * évitent seulement de laisser les mots de passe en clair dans le stockage du navigateur ; le
 * verrouillage après 5 échecs illustre le comportement attendu du serveur.
 */
import { del, get, set } from "idb-keyval";

import {
  DEMO_ACCOUNT,
  type AuthProvider,
  type AuthResult,
  type DemoSession,
  type DjAccess,
  type DjSession,
  type IssueDjAccess,
  type ResponsableAccount,
  type ResponsableSession,
  type Session,
} from "./provider";

/** Stockage clé-valeur asynchrone (IndexedDB en production, mémoire en test). */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export const idbStore: KeyValueStore = {
  get: <T>(key: string) => get<T>(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
};

export function memoryStore(): KeyValueStore {
  const m = new Map<string, unknown>();
  return {
    get: <T>(key: string) => Promise.resolve(structuredClone(m.get(key)) as T | undefined),
    set: (key, value) => {
      m.set(key, structuredClone(value));
      return Promise.resolve();
    },
    del: (key) => {
      m.delete(key);
      return Promise.resolve();
    },
  };
}

export const AUTH_KEYS = {
  session: "pilot5q:auth:session",
  accounts: "pilot5q:auth:accounts",
  dj: "pilot5q:auth:dj",
  attempts: "pilot5q:auth:attempts",
} as const;

/** Échecs tolérés avant verrouillage, et durée du verrouillage. */
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 5 * 60 * 1000;

interface StoredAccount extends ResponsableAccount {
  salt: string;
  hash: string;
}

interface StoredDjAccess extends DjAccess {
  salt: string;
  hash: string;
}

type Attempts = Record<string, { count: number; lockedUntil: number | null }>;

/* ---------- Primitives ---------- */

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Code à 6 chiffres tiré uniformément (rejet des valeurs biaisées). */
export function generateCode(): string {
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  for (;;) {
    const v = new DataView(randomBytes(4).buffer).getUint32(0);
    if (v < limit) return String(v % 1_000_000).padStart(6, "0");
  }
}

/** « 048 213 » ou « 048213 » → « 048213 » (null si ce n'est pas 6 chiffres). */
export function normalizeCode(input: string): string | null {
  const digits = input.replace(/[\s.-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (u: string) => u.trim().toLowerCase();

/** Empreinte SHA-256 salée (repli FNV si Web Crypto est indisponible, ex. page non sécurisée). */
export async function digest(salt: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${secret}`);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) return hex(new Uint8Array(await subtle.digest("SHA-256", data)));
  let h = 0x811c9dc5;
  for (const b of data) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return `fnv-${h.toString(16)}`;
}

const strip = <T extends { salt: string; hash: string }>(x: T): Omit<T, "salt" | "hash"> => {
  const { salt: _salt, hash: _hash, ...rest } = x;
  return rest;
};

/* ---------- Fournisseur local ---------- */

export class LocalAuthProvider implements AuthProvider {
  constructor(
    private readonly store: KeyValueStore = idbStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async read<T>(key: string, fallback: T): Promise<T> {
    try {
      return (await this.store.get<T>(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  private async write(key: string, value: unknown): Promise<void> {
    try {
      await this.store.set(key, value);
    } catch {
      /* stockage indisponible (navigation privée) : la session reste en mémoire */
    }
  }

  private async accounts(): Promise<StoredAccount[]> {
    const list = await this.read<StoredAccount[]>(AUTH_KEYS.accounts, []);
    if (list.length > 0) return list;
    // Premier lancement : compte de démonstration.
    const salt = hex(randomBytes(16));
    const demo: StoredAccount = {
      username: DEMO_ACCOUNT.username,
      displayName: DEMO_ACCOUNT.displayName,
      createdAt: this.now().toISOString(),
      demo: true,
      salt,
      hash: await digest(salt, DEMO_ACCOUNT.password),
    };
    await this.write(AUTH_KEYS.accounts, [demo]);
    return [demo];
  }

  private djAccesses(): Promise<StoredDjAccess[]> {
    return this.read<StoredDjAccess[]>(AUTH_KEYS.dj, []);
  }

  /** Vérifie le verrouillage d'une identité ; renvoie le message d'erreur s'il y a lieu. */
  private async locked(key: string): Promise<string | null> {
    const a = (await this.read<Attempts>(AUTH_KEYS.attempts, {}))[key];
    const t = this.now().getTime();
    if (a?.lockedUntil && a.lockedUntil > t) {
      const min = Math.ceil((a.lockedUntil - t) / 60000);
      return `Trop d'essais. Réessayez dans ${min} minute${min > 1 ? "s" : ""}.`;
    }
    return null;
  }

  private async fail(key: string): Promise<number> {
    const all = await this.read<Attempts>(AUTH_KEYS.attempts, {});
    const prev = all[key];
    const expired = prev?.lockedUntil !== null && (prev?.lockedUntil ?? 0) <= this.now().getTime();
    const count = (expired ? 0 : (prev?.count ?? 0)) + 1;
    all[key] = {
      count: count >= MAX_ATTEMPTS ? 0 : count,
      lockedUntil: count >= MAX_ATTEMPTS ? this.now().getTime() + LOCK_MS : null,
    };
    await this.write(AUTH_KEYS.attempts, all);
    return MAX_ATTEMPTS - count;
  }

  private async succeed(key: string): Promise<void> {
    const all = await this.read<Attempts>(AUTH_KEYS.attempts, {});
    if (!(key in all)) return;
    delete all[key];
    await this.write(AUTH_KEYS.attempts, all);
  }

  /* ----- Sessions ----- */

  async currentSession(): Promise<Session | null> {
    const s = await this.read<Session | null>(AUTH_KEYS.session, null);
    if (!s || s.role !== "dj") return s;
    // Droits du DJ recalculés à chaque chargement : retrait d'accès, clôture.
    const access = (await this.djAccesses()).find(
      (a) => a.stageId === s.stageId && normalizeEmail(a.dj.email) === s.email,
    );
    if (!access || access.tournamentId !== s.tournamentId) {
      await this.store.del(AUTH_KEYS.session).catch(() => undefined);
      return null;
    }
    const next: DjSession = { ...s, readOnly: access.closedAt !== null, closedAt: access.closedAt };
    if (next.readOnly !== s.readOnly) await this.write(AUTH_KEYS.session, next);
    return next;
  }

  async loginResponsable(
    username: string,
    password: string,
  ): Promise<AuthResult<ResponsableSession>> {
    const u = normalizeUsername(username);
    if (!u || !password) {
      return {
        ok: false,
        error: "champ-manquant",
        message: "Saisissez l'identifiant et le mot de passe.",
      };
    }
    const lock = await this.locked(`resp:${u}`);
    if (lock) return { ok: false, error: "verrouille", message: lock };
    const account = (await this.accounts()).find((a) => a.username === u);
    if (!account || (await digest(account.salt, password)) !== account.hash) {
      const left = await this.fail(`resp:${u}`);
      return {
        ok: false,
        error: left <= 0 ? "verrouille" : "identifiants",
        message:
          left <= 0
            ? "Trop d'essais. Réessayez dans 5 minutes."
            : `Identifiant ou mot de passe incorrect (${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}).`,
      };
    }
    await this.succeed(`resp:${u}`);
    const session: ResponsableSession = {
      role: "responsable",
      username: account.username,
      displayName: account.displayName,
      startedAt: this.now().toISOString(),
    };
    await this.write(AUTH_KEYS.session, session);
    return { ok: true, session };
  }

  async loginDj(email: string, code: string): Promise<AuthResult<DjSession>> {
    const e = normalizeEmail(email);
    const c = normalizeCode(code);
    if (!e || !code.trim()) {
      return { ok: false, error: "champ-manquant", message: "Saisissez votre email et le code." };
    }
    if (!c) {
      return { ok: false, error: "code", message: "Le code compte exactement 6 chiffres." };
    }
    const lock = await this.locked(`dj:${e}`);
    if (lock) return { ok: false, error: "verrouille", message: lock };
    const candidates = (await this.djAccesses())
      .filter((a) => normalizeEmail(a.dj.email) === e)
      .sort((x, y) => y.issuedAt.localeCompare(x.issuedAt));
    let match: StoredDjAccess | undefined;
    for (const a of candidates) {
      if ((await digest(a.salt, c)) === a.hash) {
        match = a;
        break;
      }
    }
    if (!match) {
      const left = await this.fail(`dj:${e}`);
      return {
        ok: false,
        error: left <= 0 ? "verrouille" : candidates.length === 0 ? "identifiants" : "code",
        message:
          left <= 0
            ? "Trop d'essais. Réessayez dans 5 minutes."
            : candidates.length === 0
              ? "Aucun tournoi n'est ouvert pour cet email. Vérifiez l'adresse indiquée dans l'email d'activation."
              : `Code incorrect (${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}).`,
      };
    }
    await this.succeed(`dj:${e}`);
    const session: DjSession = {
      role: "dj",
      email: e,
      displayName: match.dj.name || e,
      stageId: match.stageId,
      stageName: match.stageName,
      tournamentId: match.tournamentId,
      startedAt: this.now().toISOString(),
      readOnly: match.closedAt !== null,
      closedAt: match.closedAt,
    };
    await this.write(AUTH_KEYS.session, session);
    return { ok: true, session };
  }

  async startDemo(): Promise<DemoSession> {
    const session: DemoSession = {
      role: "demo",
      displayName: "Démonstration",
      startedAt: this.now().toISOString(),
    };
    await this.write(AUTH_KEYS.session, session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.store.del(AUTH_KEYS.session);
    } catch {
      /* ignoré */
    }
  }

  /* ----- Accès des directeurs de jeu ----- */

  private async saveAccess(access: Omit<StoredDjAccess, "salt" | "hash">): Promise<DjAccess> {
    const salt = hex(randomBytes(16));
    const stored: StoredDjAccess = { ...access, salt, hash: await digest(salt, access.code) };
    const list = (await this.djAccesses()).filter((a) => a.stageId !== access.stageId);
    await this.write(AUTH_KEYS.dj, [...list, stored]);
    return strip(stored);
  }

  async issueDjAccess(input: IssueDjAccess): Promise<DjAccess> {
    return this.saveAccess({
      ...input,
      dj: { ...input.dj, email: normalizeEmail(input.dj.email) },
      code: generateCode(),
      issuedAt: this.now().toISOString(),
      closedAt: null,
    });
  }

  async regenerateDjCode(stageId: string): Promise<DjAccess | null> {
    const current = (await this.djAccesses()).find((a) => a.stageId === stageId);
    if (!current) return null;
    // L'ancien code cesse de fonctionner ; une session déjà ouverte reste valide.
    return this.saveAccess({
      ...strip(current),
      code: generateCode(),
      issuedAt: this.now().toISOString(),
    });
  }

  async getDjAccess(stageId: string): Promise<DjAccess | null> {
    const a = (await this.djAccesses()).find((x) => x.stageId === stageId);
    return a ? strip(a) : null;
  }

  async listDjAccess(): Promise<DjAccess[]> {
    return (await this.djAccesses()).map(strip);
  }

  async revokeDjAccess(stageId: string): Promise<void> {
    const list = await this.djAccesses();
    await this.write(
      AUTH_KEYS.dj,
      list.filter((a) => a.stageId !== stageId),
    );
  }

  async setStageClosed(stageId: string, closedAt: string | null): Promise<void> {
    const list = await this.djAccesses();
    await this.write(
      AUTH_KEYS.dj,
      list.map((a) => (a.stageId === stageId ? { ...a, closedAt } : a)),
    );
  }

  /* ----- Comptes des responsables ----- */

  async listAccounts(): Promise<ResponsableAccount[]> {
    return (await this.accounts()).map(strip);
  }

  async createAccount(username: string, displayName: string, password: string): Promise<void> {
    const u = normalizeUsername(username);
    if (!/^[a-z0-9._-]{3,}$/.test(u)) {
      throw new Error("Identifiant : au moins 3 caractères (lettres, chiffres, . _ -).");
    }
    if (password.length < 8) throw new Error("Mot de passe : au moins 8 caractères.");
    const list = await this.accounts();
    if (list.some((a) => a.username === u)) throw new Error("Cet identifiant existe déjà.");
    const salt = hex(randomBytes(16));
    await this.write(AUTH_KEYS.accounts, [
      ...list,
      {
        username: u,
        displayName: displayName.trim() || u,
        createdAt: this.now().toISOString(),
        demo: false,
        salt,
        hash: await digest(salt, password),
      },
    ]);
  }

  async changePassword(username: string, password: string): Promise<void> {
    if (password.length < 8) throw new Error("Mot de passe : au moins 8 caractères.");
    const u = normalizeUsername(username);
    const list = await this.accounts();
    if (!list.some((a) => a.username === u)) throw new Error("Compte introuvable.");
    const salt = hex(randomBytes(16));
    const hash = await digest(salt, password);
    await this.write(
      AUTH_KEYS.accounts,
      // Un compte de démonstration dont le mot de passe change n'est plus affiché en clair.
      list.map((a) => (a.username === u ? { ...a, salt, hash, demo: false } : a)),
    );
  }
}
