/** Convocations : horaires et canevas propres à un TN, email d'activation du DJ. */
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";

import { DEFAULT_MAIL_TEMPLATE, type TournamentState } from "@pilot5q/domain";

import {
  POULE_UNKNOWN,
  clubConvocation,
  datesText,
  djActivationMail,
  djLoginLink,
  placementOf,
  playerConvocations,
} from "./convocations";
import { demoSeason, type DemoInscription } from "./demo";
import { stageAcceptance } from "./stage";

const order = (inscriptions as { registrations: DemoInscription[] }).registrations;

describe("convocations d'un TN", () => {
  const doc = demoSeason(order);
  const base = doc.stages.find((s) => s.number === 2)!;
  const accepted = stageAcceptance(doc, base).accepted;

  it("utilisent les horaires de la saison sans surcharge", () => {
    const friday = playerConvocations(doc, base, accepted)[20]!;
    expect(friday.body).toContain("10h30");
  });

  it("utilisent les horaires et le canevas propres au TN", () => {
    const stage = {
      ...base,
      convocation: { convocationFriday: "11:15", mailTemplate: "Salut {{prenom}} : {{heure}}" },
    };
    const friday = playerConvocations(doc, stage, accepted)[20]!;
    expect(friday.body).toMatch(/^Salut .+ à 11h15$/);
    expect(clubConvocation(doc, stage, accepted, "").body).toContain("vendredi 11:15");
  });

  it("canevas par défaut : horaires du vendredi et du samedi (Masters), poule pas encore connue", () => {
    expect(doc.settings.mailTemplate).toBe(DEFAULT_MAIL_TEMPLATE);
    const mails = playerConvocations(doc, base, accepted);
    const friday = mails[20]!;
    expect(friday.body).toContain("En cas de forfait merci de prévenir au plus vite");
    expect(friday.body).toContain(`du ${datesText(base.start, base.end)}.`);
    expect(friday.body).toMatch(
      /Convocation : vendredi \d+ \S+ à 10h30\. Poule communiquée après le tirage\.\n/,
    );
    expect(friday.body).not.toContain("{{");
    const master = mails[0]!;
    const weekend = base.big <= 3 ? "8h00" : "8h30";
    expect(master.body).toMatch(
      new RegExp(`Convocation : samedi \\d+ \\S+ à ${weekend}\\. Préqualifié\\(e\\) Masters`),
    );
    expect(POULE_UNKNOWN).not.toContain("{{");
  });

  it("dates lisibles après « du » et poule connue après le tirage", () => {
    expect(datesText("2026-10-30", "2026-11-01")).toBe("30 octobre au 1er novembre 2026");
    const p = accepted[20]!;
    const state = {
      poules: { PREQ: [{ num: 7, players: [p.name], billards: [4, 5], matches: [] }] },
    } as unknown as TournamentState;
    const placement = placementOf(state);
    expect(placement[p.name]).toEqual({ poule: 7, billard: 4 });
    const mail = playerConvocations(doc, base, accepted, placement)[20]!;
    expect(mail.body).toContain("à 10h30. Poule 7, billard 4.");
  });

  it("l'email d'activation du DJ contient le lien, l'email et le code", () => {
    const link = djLoginLink("https://exemple.fr", "/Pilot5Q/", "dj@exemple.fr");
    expect(link).toBe("https://exemple.fr/Pilot5Q/?acces=dj&email=dj%40exemple.fr");
    const mail = djActivationMail(
      base,
      { name: "MARTIN PAUL", email: "dj@exemple.fr" },
      link,
      "048213",
      76,
    );
    expect(mail.to).toBe("dj@exemple.fr");
    expect(mail.body).toContain(link);
    expect(mail.body).toContain("048 213");
    expect(mail.body).toContain("Bonjour Paul");
  });
});
