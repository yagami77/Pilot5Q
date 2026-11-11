/**
 * Clôture du tournoi vue par chaque rôle (retours du 11 novembre) : après la clôture par le
 * directeur de jeu, lui ne peut plus rien modifier ; le responsable connecté peut rouvrir.
 */
import type { TournamentEvent } from "@pilot5q/domain";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/Toast";
import { TournamentProvider } from "@/store/tournament";
import { AT, allPlayed, allRanked } from "@/test/weekend";
import { Cockpit } from "@/views/Cockpit";

import { SessionProvider } from "./context";
import { RequireCockpit } from "./guards";
import { LocalAuthProvider, memoryStore } from "./local";
import { DEMO_ACCOUNT } from "./provider";

const TOURNAMENT = "tn2-test";

async function openCockpit(role: "dj" | "responsable" | "demo", events: TournamentEvent[]) {
  const auth = new LocalAuthProvider(memoryStore());
  if (role === "dj") {
    const access = await auth.issueDjAccess({
      stageId: "tn2",
      stageName: "TN 2",
      city: "Ronchin",
      seasonId: "2026-2027",
      tournamentId: TOURNAMENT,
      dj: { name: "MARTIN Paul", email: "paul.martin@exemple.fr", licence: "000001A", phone: "" },
    });
    const login = await auth.loginDj("paul.martin@exemple.fr", access.code);
    expect(login.ok).toBe(true);
  } else if (role === "responsable") {
    const login = await auth.loginResponsable(DEMO_ACCOUNT.username, DEMO_ACCOUNT.password);
    expect(login.ok).toBe(true);
  } else await auth.startDemo();
  render(
    <SessionProvider provider={auth}>
      <MemoryRouter initialEntries={["/tournoi/dimanche"]}>
        <TournamentProvider persist={false} initialId={TOURNAMENT} initialEvents={events}>
          <ToastProvider>
            <Routes>
              <Route
                path="/tournoi/:day"
                element={
                  <RequireCockpit>
                    <Cockpit />
                  </RequireCockpit>
                }
              />
            </Routes>
          </ToastProvider>
        </TournamentProvider>
      </MemoryRouter>
    </SessionProvider>,
  );
  await screen.findByRole("region", { name: "Tâches du dimanche" });
}

/** Tournoi joué, classé, puis clôturé par le directeur de jeu. */
const closedByDj = (): TournamentEvent[] => [
  ...allRanked(),
  { type: "tournament.closed", at: AT, payload: { by: "Martin Paul" } },
];

/** Puis rouvert par le responsable pour correction (pas encore reclôturé). */
const reopenedByResponsable = (): TournamentEvent[] => [
  ...closedByDj(),
  { type: "tournament.reopened", at: AT, payload: { by: "Responsable national" } },
];

const entryButtons = () => screen.queryAllByRole("button", { name: /^Saisir / });
const undo = () => screen.getByRole("button", { name: /^Annuler/ });

beforeEach(() => window.localStorage.setItem(`pilot5q:panel:primes:${TOURNAMENT}`, "0"));

describe("clôture par le directeur de jeu", () => {
  it("le directeur de jeu clôture puis ne peut plus rien modifier, annuler ni rouvrir", async () => {
    await openCockpit("dj", allPlayed());
    expect(entryButtons().length).toBeGreaterThan(0);
    expect(undo()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Clôturer le tournoi" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clôturer le tournoi" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    // Bandeau de consultation seule, signé du directeur de jeu dans le résumé
    expect(
      screen.getByText("Tournoi clôturé : consultation seule, seul le responsable peut le rouvrir"),
    ).toBeInTheDocument();
    expect(screen.getByText(/par Martin Paul\. Toute correction passe désormais/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
    expect(undo()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Revoir les tableaux" }));
    expect(entryButtons()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
  });

  it("la démonstration est verrouillée de la même façon", async () => {
    await openCockpit("demo", closedByDj());
    expect(
      screen.getByText("Tournoi clôturé : consultation seule, seul le responsable peut le rouvrir"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
    expect(undo()).toBeDisabled();
  });

  it("le responsable connecté rouvre le tournoi, puis la saisie d'un tableau", async () => {
    await openCockpit("responsable", closedByDj());
    expect(await screen.findByText(/^Tournoi clôturé le .* par Martin Paul$/)).toBeVisible();
    // Tant qu'il n'a pas rouvert, lui non plus ne modifie rien
    fireEvent.click(screen.getByRole("button", { name: "Revoir les tableaux" }));
    expect(entryButtons()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Rouvrir la saisie" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rouvrir le tournoi" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Rouvrir le tournoi" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByText(/^Tournoi clôturé/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Tournoi rouvert pour correction : vous seul pouvez modifier, puis clôturez de nouveau",
      ),
    ).toBeInTheDocument();
    expect(undo()).toBeEnabled();
    // Correction : le tableau Masters classé se rouvre, ses matchs redeviennent saisissables
    fireEvent.click(screen.getAllByRole("button", { name: "Rouvrir la saisie" })[0]!);
    expect(entryButtons().length).toBeGreaterThan(0);
    // Puis il clôture de nouveau : le tournoi est signé de son nom
    fireEvent.click(screen.getByRole("button", { name: "Clôturer le tournoi" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clôturer le tournoi" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(
      await screen.findByText(/^Tournoi clôturé le .* par Responsable national/),
    ).toBeVisible();
    expect(entryButtons()).toHaveLength(0);
  });
});

describe("tournoi rouvert par le responsable pour correction", () => {
  for (const role of ["dj", "demo"] as const) {
    it(`${role === "dj" ? "le directeur de jeu" : "la démonstration"} ne retrouve pas la saisie`, async () => {
      await openCockpit(role, reopenedByResponsable());
      expect(
        screen.getByText("Tournoi rouvert par le responsable pour correction : consultation seule"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/tournoi rouvert par le responsable national pour correction/),
      ).toBeVisible();
      // Ni annulation, ni clôture, ni réouverture
      expect(undo()).toBeDisabled();
      const close = screen.getByRole("button", { name: "Clôturer le tournoi" });
      expect(close).toBeDisabled();
      expect(close.parentElement?.parentElement).toHaveAttribute(
        "title",
        "Tournoi rouvert par le responsable : lui seul peut le clôturer de nouveau",
      );
      expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
      // Ni saisie d'un score, ni réouverture d'un tableau classé
      fireEvent.click(screen.getByRole("button", { name: "Revoir les tableaux" }));
      expect(entryButtons()).toHaveLength(0);
      expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Mode test/ })).not.toBeInTheDocument();
    });
  }

  it("le responsable, lui, corrige : saisie et annulation actives", async () => {
    await openCockpit("responsable", reopenedByResponsable());
    expect(
      await screen.findByText(
        "Tournoi rouvert pour correction : vous seul pouvez modifier, puis clôturez de nouveau",
      ),
    ).toBeVisible();
    expect(undo()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Clôturer le tournoi" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Revoir les tableaux" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Rouvrir la saisie" })[0]!);
    expect(entryButtons().length).toBeGreaterThan(0);
  });
});
