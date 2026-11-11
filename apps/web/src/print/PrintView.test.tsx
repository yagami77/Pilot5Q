import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoEvents } from "@/lib/demo";
import { TournamentProvider } from "@/store/tournament";

import { PrintView } from "./PrintView";

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderView(path: string) {
  const events = demoEvents().map((e) => ({ ...e, at: "2026-10-29T10:00:00Z" }));
  // StrictMode : les effets sont montés deux fois, comme en développement
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <TournamentProvider persist={false} initialId="demo" initialEvents={events as never}>
          <Routes>
            <Route
              path="/tournoi/imprimer/:doc"
              element={
                <>
                  <PrintView />
                  <Where />
                </>
              }
            />
          </Routes>
        </TournamentProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 250)));

describe("vue d'impression", () => {
  let print: ReturnType<typeof vi.spyOn>;
  let title: string;

  beforeEach(() => {
    title = document.title;
    print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "fonts");
    document.title = title;
  });

  it("« Imprimer » : lance la boîte d'impression une seule fois, même sous StrictMode", async () => {
    renderView("/tournoi/imprimer/pointage?imprimer=1");
    expect(print).not.toHaveBeenCalled();
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
    // Le paramètre est retiré : recharger la page ne relance pas l'impression
    expect(screen.getByTestId("where").textContent).toBe("/tournoi/imprimer/pointage");
    // Le titre de l'onglet sert de nom au PDF enregistré
    expect(document.title).toMatch(/Ronchin - Liste alphabétique/);
  });

  it("n'imprime qu'une fois les polices chargées", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load: () => gate.then(() => []), ready: gate },
    });
    renderView("/tournoi/imprimer/pointage?imprimer=1");
    await settle();
    expect(print).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("« Aperçu » : n'imprime pas tant qu'on ne clique pas sur « Imprimer »", async () => {
    renderView("/tournoi/imprimer/pointage");
    await settle();
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByText(/Enregistrer au format PDF/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Imprimer" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("n'imprime pas un document introuvable", async () => {
    renderView("/tournoi/imprimer/inconnu?imprimer=1");
    await settle();
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByText("Aucun document à afficher.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimer" })).toBeDisabled();
  });
});
