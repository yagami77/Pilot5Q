/**
 * Journaux de test : le week-end réel du tournoi d'exemple (TN 2 de Ronchin) arrêté à différents
 * moments, et le rendu d'une vue du cockpit sur l'un de ces journaux.
 */
import type { TournamentEvent } from "@pilot5q/domain";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";

import { realWeekendEvents } from "@/admin/realWeekend";
import { ToastProvider } from "@/components/Toast";
import { demoEvents } from "@/lib/demo";
import { TournamentProvider, type EventInput } from "@/store/tournament";

export const AT = "2026-10-30T10:00:00.000Z";

const stamp = (e: EventInput): TournamentEvent => ({ ...e, at: AT }) as TournamentEvent;

/** Tournoi d'exemple avant le tirage. */
export const BASE: TournamentEvent[] = demoEvents().map(stamp);
/** Suite du journal : tout le week-end, scores réels, phases classées. */
export const PLAYED: TournamentEvent[] = realWeekendEvents(BASE).map(stamp);

const indexOf = (pred: (e: TournamentEvent) => boolean) => PLAYED.findIndex(pred);
const closedAt = (phase: string) =>
  indexOf((e) => e.type === "phase.closed" && e.payload.phase === phase);
const withoutConsolante = (events: TournamentEvent[]) =>
  events.filter(
    (e) =>
      e.type !== "consolante.created" &&
      !(e.type === "score.entered" && e.payload.phase === "CLS") &&
      !(e.type === "phase.closed" && e.payload.phase === "CLS"),
  );

/** Vendredi soir : barrages classés, consolante pas encore créée. */
export function fridayDone(): TournamentEvent[] {
  return [...BASE, ...PLAYED.slice(0, closedAt("B") + 1)];
}

/** Samedi matin avec la consolante du tournoi d'exemple (19 joueurs). */
export function saturdayWithConsolante(): TournamentEvent[] {
  const created = PLAYED.find((e) => e.type === "consolante.created");
  return created ? [...fridayDone(), created] : fridayDone();
}

/** Samedi : poules Masters classées, National pas commencé, pas de consolante. */
export function mastersRanked(): TournamentEvent[] {
  return [...fridayDone(), ...PLAYED.slice(closedAt("QN") + 1, closedAt("QM") + 1)];
}

/** Dimanche matin : quarts prêts à jouer. */
export function sundayStart(consolante = true): TournamentEvent[] {
  const firstQuarter = indexOf(
    (e) =>
      e.type === "score.entered" && e.payload.phase === "N" && e.payload.matchId.includes("QF"),
  );
  const events = [...BASE, ...PLAYED.slice(0, firstQuarter)];
  return consolante ? events : withoutConsolante(events);
}

/** Tout est joué, les tableaux du dimanche et la consolante ne sont pas encore classés. */
export function allPlayed(consolante = true): TournamentEvent[] {
  const events = [...BASE, ...PLAYED].filter(
    (e) => !(e.type === "phase.closed" && ["M", "N", "CLS"].includes(e.payload.phase)),
  );
  return consolante ? events : withoutConsolante(events);
}

/** Tout est joué et classé (le tournoi n'est pas clôturé). */
export function allRanked(): TournamentEvent[] {
  return [...BASE, ...PLAYED];
}

/** Même tournoi avec seulement 4 billards de 2m80 : consolante sans objet (SPEC §5). */
export function fewSmallTables(events: TournamentEvent[]): TournamentEvent[] {
  return events.map((e) => {
    if (e.type !== "tournament.created") return e;
    let small = 0;
    const billards = e.payload.billards.map((b) =>
      b.type === "2m80" && ++small > 4 ? { ...b, type: "3m10" as const } : b,
    );
    return { ...e, payload: { ...e.payload, billards } };
  });
}

/** Rend une vue du cockpit sur un journal (store en mémoire, routeur, toasts). */
export function renderView(
  ui: ReactElement,
  events: TournamentEvent[],
  path = "/tournoi",
): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TournamentProvider persist={false} initialId="test" initialEvents={events}>
        <ToastProvider>{ui}</ToastProvider>
      </TournamentProvider>
    </MemoryRouter>,
  );
}
