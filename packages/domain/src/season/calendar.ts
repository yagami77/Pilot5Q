/**
 * Calendrier d'une saison : statut d'une étape et paramètres par défaut.
 */
import { DEFAULT_RULES } from "../rules.js";
import { DEFAULT_MAIL_TEMPLATE } from "./convocation.js";
import type { SeasonSettings, Stage, StageStatus } from "./types.js";

/** Paramètres par défaut d'une saison (SPEC §8, outil de référence). */
export const DEFAULT_SEASON_SETTINGS: SeasonSettings = {
  minTables: 8,
  minBigTables: 3,
  playersPerTable: 8,
  extraPlayers: 8,
  maxPlayers: 100,
  waitlistPriority: 34,
  consolanteMinSmallTables: 5,
  inscriptionFee: 30,
  ffbShare: 450,
  clubShare: 200,
  prizesMasters: [
    { label: "Vainqueur", pct: 20, count: 1 },
    { label: "Finaliste", pct: 12, count: 1 },
    { label: "Demi-finalistes", pct: 8, count: 2 },
    { label: "Quarts de finale", pct: 4, count: 4 },
    { label: "3es et 4es de poule", pct: 2, count: 8 },
  ],
  prizesNational: [
    { label: "Vainqueur", pct: 8, count: 1 },
    { label: "Finaliste", pct: 4, count: 1 },
    { label: "Demi-finalistes", pct: 2, count: 2 },
    { label: "Quarts de finale", pct: 1, count: 4 },
  ],
  convocationFriday: "10:30",
  convocationWeekend: "08:30",
  convocationWeekendThreeBig: "08:00",
  distances: DEFAULT_RULES.distances,
  mailTemplate: DEFAULT_MAIL_TEMPLATE,
};

/** Statut d'une étape à l'instant `now` (ISO 8601). */
export function stageStatus(stage: Stage, now: string): StageStatus {
  if (stage.closedAt) return "cloture";
  if (stage.openedAt || stage.tournamentId) return "ouvert-dj";
  if (stage.registrationOpen && now < stage.registrationOpen) return "a-venir";
  if (stage.registrationClose && now >= stage.registrationClose) return "inscriptions-closes";
  if (stage.registrationOpen) return "inscriptions-ouvertes";
  return "a-venir";
}

/** Libellé d'un statut. */
export function stageStatusLabel(status: StageStatus): string {
  return {
    "a-venir": "À venir",
    "inscriptions-ouvertes": "Inscriptions ouvertes",
    "inscriptions-closes": "Inscriptions clôturées",
    "ouvert-dj": "Tournoi ouvert au DJ",
    cloture: "Clôturé",
  }[status];
}

/** Dimanche d'un vendredi (AAAA-MM-JJ). */
export function sundayOf(friday: string): string {
  const [y, m, d] = friday.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + 2));
  return dt.toISOString().slice(0, 10);
}

/** Vérifie qu'un club peut accueillir un TN (SPEC §1). */
export function hostCapable(
  big: number,
  small: number,
  settings: SeasonSettings,
): { ok: boolean; reason: string } {
  if (big + small < settings.minTables)
    return { ok: false, reason: `Il faut au moins ${settings.minTables} billards` };
  if (big < settings.minBigTables)
    return { ok: false, reason: `Il faut au moins ${settings.minBigTables} billards 3m10` };
  return { ok: true, reason: "" };
}

/**
 * Paramètres effectifs d'une étape : ceux de la saison, surchargés par les horaires et le canevas
 * propres à l'étape (`stage.convocation`). Une surcharge vide est ignorée.
 */
export function stageSettings(settings: SeasonSettings, stage: Stage): SeasonSettings {
  const o = stage.convocation ?? {};
  const pick = (v: string | undefined, d: string) => (v !== undefined && v.trim() !== "" ? v : d);
  return {
    ...settings,
    convocationFriday: pick(o.convocationFriday, settings.convocationFriday),
    convocationWeekend: pick(o.convocationWeekend, settings.convocationWeekend),
    convocationWeekendThreeBig: pick(
      o.convocationWeekendThreeBig,
      settings.convocationWeekendThreeBig,
    ),
    mailTemplate: pick(o.mailTemplate, settings.mailTemplate),
  };
}

/** Résultat du contrôle de la consolante d'une étape. */
export interface ConsolanteCheck {
  possible: boolean;
  /** Billards 2m80 disponibles. */
  small: number;
  /** Minimum exigé (SPEC §5, §8 : 5). */
  min: number;
  reason: string;
}

/** La consolante n'a lieu que si l'étape dispose d'au moins 5 billards 2m80 (SPEC §5, §8). */
export function consolanteCheck(stage: Stage, settings: SeasonSettings): ConsolanteCheck {
  const min = settings.consolanteMinSmallTables;
  const small = stage.small;
  const possible = small >= min;
  const reason = possible
    ? `${small} billards 2m80 pour un minimum de ${min} : la consolante peut avoir lieu.`
    : `${small} billard${small > 1 ? "s" : ""} 2m80 pour un minimum de ${min} : pas de consolante sur cette étape.`;
  return { possible, small, min, reason };
}
