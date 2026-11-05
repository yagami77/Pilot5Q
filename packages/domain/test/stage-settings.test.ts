/** Paramètres propres à une étape : surcharges de convocation et contrôle de la consolante. */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEASON_SETTINGS,
  consolanteCheck,
  stageSettings,
  type Stage,
} from "../src/index.js";

const stage = (patch: Partial<Stage> = {}): Stage => ({
  id: "tn2-2026-2027",
  season: "2026-2027",
  number: 2,
  kind: "TN",
  name: "TN 2",
  clubId: null,
  city: "Ronchin",
  start: "2026-10-30",
  end: "2026-11-01",
  registrationOpen: null,
  registrationClose: null,
  registrationUrl: "",
  big: 4,
  small: 7,
  djLicence: null,
  tournamentId: null,
  openedAt: null,
  closedAt: null,
  ...patch,
});

describe("stageSettings", () => {
  it("reprend les valeurs de la saison sans surcharge", () => {
    expect(stageSettings(DEFAULT_SEASON_SETTINGS, stage())).toEqual(DEFAULT_SEASON_SETTINGS);
  });

  it("applique les horaires et le canevas de l'étape, ignore les valeurs vides", () => {
    const s = stageSettings(
      DEFAULT_SEASON_SETTINGS,
      stage({
        convocation: { convocationFriday: "11:00", convocationWeekend: " ", mailTemplate: "X" },
      }),
    );
    expect(s.convocationFriday).toBe("11:00");
    expect(s.convocationWeekend).toBe(DEFAULT_SEASON_SETTINGS.convocationWeekend);
    expect(s.mailTemplate).toBe("X");
    expect(s.inscriptionFee).toBe(DEFAULT_SEASON_SETTINGS.inscriptionFee);
  });
});

describe("consolanteCheck (SPEC §5 : au moins 5 billards 2m80)", () => {
  it("autorise la consolante à partir de 5 petits billards", () => {
    expect(consolanteCheck(stage({ small: 5 }), DEFAULT_SEASON_SETTINGS).possible).toBe(true);
    expect(consolanteCheck(stage({ small: 7 }), DEFAULT_SEASON_SETTINGS).reason).toContain(
      "peut avoir lieu",
    );
  });

  it("refuse la consolante en dessous du minimum", () => {
    const c = consolanteCheck(stage({ small: 4 }), DEFAULT_SEASON_SETTINGS);
    expect(c).toMatchObject({ possible: false, small: 4, min: 5 });
    expect(c.reason).toContain("pas de consolante");
  });
});
