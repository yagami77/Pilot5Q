/**
 * Contrat d'authentification de Pilot5Q.
 *
 * SÉCURITÉ : l'implémentation actuelle (`LocalAuthProvider`) tourne entièrement dans le
 * navigateur. Elle sert à structurer les parcours (deux rôles, code du directeur de jeu, droits
 * qui expirent à la clôture) mais NE PROTÈGE RIEN : les comptes, empreintes et codes sont dans
 * IndexedDB, lisibles et modifiables par quiconque a accès à l'ordinateur. La sécurité réelle
 * viendra avec le serveur partagé : comptes en base, mots de passe hachés côté serveur (Argon2),
 * codes à usage limité envoyés par email (lien de connexion), sessions signées, contrôle des
 * droits sur chaque requête. Le serveur implémentera la même interface `AuthProvider` : les vues
 * n'auront pas à changer.
 */

/** Coordonnées du directeur de jeu (saisies par le responsable dans la page du TN). */
export interface DjIdentity {
  /** « NOM Prénom ». */
  name: string;
  email: string;
  licence: string;
  phone: string;
}

/** Session du responsable national. */
export interface ResponsableSession {
  role: "responsable";
  username: string;
  displayName: string;
  startedAt: string;
}

/** Session d'un directeur de jeu : limitée à SON tournoi. */
export interface DjSession {
  role: "dj";
  email: string;
  displayName: string;
  stageId: string;
  stageName: string;
  /** Journal du tournoi dans le cockpit. */
  tournamentId: string;
  startedAt: string;
  /** Tournoi clôturé : consultation seule, plus aucune modification. */
  readOnly: boolean;
  closedAt: string | null;
}

/** Session de démonstration (tournoi d'exemple, sans compte). */
export interface DemoSession {
  role: "demo";
  displayName: string;
  startedAt: string;
}

export type Session = ResponsableSession | DjSession | DemoSession;

export type AuthError =
  "identifiants" | "code" | "verrouille" | "revoque" | "champ-manquant" | "indisponible";

export type AuthResult<S extends Session = Session> =
  { ok: true; session: S } | { ok: false; error: AuthError; message: string };

/** Accès d'un directeur de jeu à un tournoi, tel que le voit le responsable. */
export interface DjAccess {
  stageId: string;
  stageName: string;
  city: string;
  seasonId: string;
  tournamentId: string;
  dj: DjIdentity;
  /**
   * Code à 6 chiffres. Gardé en clair en local pour que le responsable puisse le retransmettre ;
   * le serveur ne gardera qu'une empreinte et enverra lui-même le code.
   */
  code: string;
  issuedAt: string;
  /** Clôture du tournoi : au-delà, l'accès devient lecture seule. */
  closedAt: string | null;
}

/** Données nécessaires pour ouvrir un tournoi à un directeur de jeu. */
export interface IssueDjAccess {
  stageId: string;
  stageName: string;
  city: string;
  seasonId: string;
  tournamentId: string;
  dj: DjIdentity;
}

/** Compte de responsable national (sans secret). */
export interface ResponsableAccount {
  username: string;
  displayName: string;
  createdAt: string;
  demo: boolean;
}

export interface AuthProvider {
  /** Session en cours (droits recalculés : un accès retiré ferme la session). */
  currentSession(): Promise<Session | null>;
  loginResponsable(username: string, password: string): Promise<AuthResult<ResponsableSession>>;
  loginDj(email: string, code: string): Promise<AuthResult<DjSession>>;
  startDemo(): Promise<DemoSession>;
  logout(): Promise<void>;

  /* Côté responsable : accès des directeurs de jeu. */
  issueDjAccess(input: IssueDjAccess): Promise<DjAccess>;
  regenerateDjCode(stageId: string): Promise<DjAccess | null>;
  getDjAccess(stageId: string): Promise<DjAccess | null>;
  listDjAccess(): Promise<DjAccess[]>;
  revokeDjAccess(stageId: string): Promise<void>;
  /** Clôture (date) ou réouverture (null) du tournoi : règle la lecture seule du DJ. */
  setStageClosed(stageId: string, closedAt: string | null): Promise<void>;

  /* Comptes des responsables. */
  listAccounts(): Promise<ResponsableAccount[]>;
  createAccount(username: string, displayName: string, password: string): Promise<void>;
  changePassword(username: string, password: string): Promise<void>;
}

/** Compte de démonstration, affiché en clair sur l'écran de connexion du prototype. */
export const DEMO_ACCOUNT = {
  username: "responsable",
  password: "5quilles-demo",
  displayName: "Responsable national (démo)",
} as const;
