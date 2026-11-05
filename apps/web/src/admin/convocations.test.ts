/** Convocations : horaires et canevas propres à un TN, email d'activation du DJ. */
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";

import { clubConvocation, djActivationMail, djLoginLink, playerConvocations } from "./convocations";
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
