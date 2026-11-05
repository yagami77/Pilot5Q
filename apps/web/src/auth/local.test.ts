/** Authentification locale : comptes du responsable, code du DJ, verrouillage, clôture. */
import { describe, expect, it } from "vitest";

import {
  AUTH_KEYS,
  LOCK_MS,
  LocalAuthProvider,
  generateCode,
  memoryStore,
  normalizeCode,
} from "./local";
import { DEMO_ACCOUNT, type IssueDjAccess } from "./provider";

function setup(start = "2026-11-05T10:00:00Z") {
  let t = new Date(start).getTime();
  const store = memoryStore();
  const auth = new LocalAuthProvider(store, () => new Date(t));
  return { auth, store, advance: (ms: number) => (t += ms) };
}

const ISSUE: IssueDjAccess = {
  stageId: "tn2-2026-2027",
  stageName: "TN 2",
  city: "Ronchin",
  seasonId: "2026-2027",
  tournamentId: "tn2-2026-2027-abc",
  dj: { name: "MARTIN Paul", email: " Paul.Martin@Exemple.fr ", licence: "000001A", phone: "" },
};

describe("codes", () => {
  it("génère des codes de 6 chiffres", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it("accepte les espaces à la saisie", () => {
    expect(normalizeCode("048 213")).toBe("048213");
    expect(normalizeCode("12345")).toBeNull();
    expect(normalizeCode("12a456")).toBeNull();
  });
});

describe("responsable", () => {
  it("se connecte avec le compte de démonstration, pas avec un mauvais mot de passe", async () => {
    const { auth } = setup();
    const bad = await auth.loginResponsable(DEMO_ACCOUNT.username, "faux");
    expect(bad).toMatchObject({ ok: false, error: "identifiants" });
    const ok = await auth.loginResponsable(" Responsable ", DEMO_ACCOUNT.password);
    expect(ok.ok).toBe(true);
    expect(await auth.currentSession()).toMatchObject({
      role: "responsable",
      username: "responsable",
    });
  });

  it("ne garde pas le mot de passe en clair", async () => {
    const { auth, store } = setup();
    await auth.listAccounts();
    expect(JSON.stringify(await store.get(AUTH_KEYS.accounts))).not.toContain(
      DEMO_ACCOUNT.password,
    );
  });

  it("verrouille après 5 échecs pendant 5 minutes", async () => {
    const { auth, advance } = setup();
    for (let i = 0; i < 5; i++) await auth.loginResponsable("responsable", "faux");
    const locked = await auth.loginResponsable("responsable", DEMO_ACCOUNT.password);
    expect(locked).toMatchObject({ ok: false, error: "verrouille" });
    advance(LOCK_MS + 1);
    expect((await auth.loginResponsable("responsable", DEMO_ACCOUNT.password)).ok).toBe(true);
  });

  it("crée un compte et change un mot de passe (le compte démo cesse d'être affiché)", async () => {
    const { auth } = setup();
    await auth.createAccount("Alberto", "Alberto C.", "motdepasse-long");
    await expect(auth.createAccount("alberto", "", "motdepasse-long")).rejects.toThrow();
    expect((await auth.loginResponsable("alberto", "motdepasse-long")).ok).toBe(true);
    await auth.changePassword("responsable", "nouveau-secret");
    const demo = (await auth.listAccounts()).find((a) => a.username === "responsable");
    expect(demo?.demo).toBe(false);
    expect((await auth.loginResponsable("responsable", DEMO_ACCOUNT.password)).ok).toBe(false);
  });
});

describe("directeur de jeu", () => {
  it("se connecte avec email + code et n'obtient que son tournoi", async () => {
    const { auth } = setup();
    const access = await auth.issueDjAccess(ISSUE);
    expect(access.code).toMatch(/^\d{6}$/);
    expect(access.dj.email).toBe("paul.martin@exemple.fr");
    const res = await auth.loginDj("PAUL.MARTIN@exemple.fr", access.code.replace(/(\d{3})/, "$1 "));
    expect(res.ok).toBe(true);
    const s = await auth.currentSession();
    expect(s).toMatchObject({
      role: "dj",
      tournamentId: ISSUE.tournamentId,
      stageId: ISSUE.stageId,
      readOnly: false,
    });
  });

  it("refuse un mauvais code, un email inconnu et un code mal formé", async () => {
    const { auth } = setup();
    const access = await auth.issueDjAccess(ISSUE);
    const wrong = access.code === "000000" ? "111111" : "000000";
    expect(await auth.loginDj("paul.martin@exemple.fr", wrong)).toMatchObject({
      ok: false,
      error: "code",
    });
    expect(await auth.loginDj("autre@exemple.fr", access.code)).toMatchObject({
      ok: false,
      error: "identifiants",
    });
    expect(await auth.loginDj("paul.martin@exemple.fr", "12")).toMatchObject({
      ok: false,
      error: "code",
    });
  });

  it("un code régénéré remplace l'ancien", async () => {
    const { auth } = setup();
    const first = await auth.issueDjAccess(ISSUE);
    let second = await auth.regenerateDjCode(ISSUE.stageId);
    while (second && second.code === first.code)
      second = await auth.regenerateDjCode(ISSUE.stageId);
    expect((await auth.loginDj(ISSUE.dj.email, first.code)).ok).toBe(false);
    expect((await auth.loginDj(ISSUE.dj.email, second!.code)).ok).toBe(true);
  });

  it("passe en lecture seule après la clôture, y compris pour une session ouverte", async () => {
    const { auth } = setup();
    const access = await auth.issueDjAccess(ISSUE);
    await auth.loginDj(ISSUE.dj.email, access.code);
    await auth.setStageClosed(ISSUE.stageId, "2026-11-08T19:00:00Z");
    expect(await auth.currentSession()).toMatchObject({ role: "dj", readOnly: true });
    await auth.logout();
    const again = await auth.loginDj(ISSUE.dj.email, access.code);
    expect(again.ok && again.session.readOnly).toBe(true);
    await auth.setStageClosed(ISSUE.stageId, null);
    expect(await auth.currentSession()).toMatchObject({ readOnly: false });
  });

  it("perd sa session quand le responsable retire l'accès", async () => {
    const { auth } = setup();
    const access = await auth.issueDjAccess(ISSUE);
    await auth.loginDj(ISSUE.dj.email, access.code);
    await auth.revokeDjAccess(ISSUE.stageId);
    expect(await auth.currentSession()).toBeNull();
  });

  it("le code n'est jamais stocké sans empreinte et la session ne le contient pas", async () => {
    const { auth, store } = setup();
    const access = await auth.issueDjAccess(ISSUE);
    await auth.loginDj(ISSUE.dj.email, access.code);
    expect(JSON.stringify(await store.get(AUTH_KEYS.session))).not.toContain(access.code);
  });
});
