import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoEvents } from "@/lib/demo";
import { TournamentProvider } from "@/store/tournament";

import { PrintCenter } from "./PrintCenter";
import { ToastProvider } from "./Toast";

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderCenter(onClose = vi.fn()) {
  const events = demoEvents().map((e) => ({ ...e, at: "2026-10-29T10:00:00Z" }));
  render(
    <MemoryRouter initialEntries={["/tournoi/jeudi"]}>
      <TournamentProvider persist={false} initialId="demo" initialEvents={events as never}>
        <ToastProvider>
          <PrintCenter day="jeudi" open onClose={onClose} />
          <Where />
        </ToastProvider>
      </TournamentProvider>
    </MemoryRouter>,
  );
  return { onClose, dialog: screen.getByRole("dialog", { name: "Imprimer" }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("centre d'impression", () => {
  it("propose « Imprimer » (principal) et « Aperçu », avec l'aide sur le PDF", () => {
    const { dialog } = renderCenter();
    // Avant le tirage : pointage (3 pages) et schéma (1 page)
    expect(within(dialog).getByRole("button", { name: "Imprimer · 4 p." })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Aperçu" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Ouvrir/ })).toBeNull();
    expect(within(dialog).getByText(/Enregistrer au format PDF/)).toBeInTheDocument();
  });

  it("« Imprimer » ouvre la vue A4 avec l'impression directe, « Aperçu » sans", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(window);
    const { dialog, onClose } = renderCenter();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Imprimer/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0]![0])).toMatch(
      /\/tournoi\/imprimer\/pointage\+schema\?imprimer=1$/,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    // L'onglet du cockpit ne bouge pas
    expect(screen.getByTestId("where").textContent).toBe("/tournoi/jeudi");
    fireEvent.click(within(dialog).getByRole("button", { name: "Aperçu" }));
    expect(String(open.mock.calls[1]![0])).toMatch(/\/tournoi\/imprimer\/pointage\+schema$/);
    expect(screen.getByTestId("where").textContent).toBe("/tournoi/jeudi");
  });

  it("n'ouvre que les documents cochés et suit le total de pages", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(window);
    const { dialog } = renderCenter();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Schéma du TN/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Imprimer · 3 p." }));
    expect(String(open.mock.calls[0]![0])).toMatch(/\/tournoi\/imprimer\/pointage\?imprimer=1$/);
  });

  it("onglet bloqué par le navigateur : la vue s'ouvre dans l'onglet courant", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { dialog } = renderCenter();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Imprimer/ }));
    expect(screen.getByTestId("where").textContent).toBe(
      "/tournoi/imprimer/pointage+schema?imprimer=1",
    );
  });

  it("la fenêtre garde une hauteur fixe, quel que soit l'aperçu survolé", () => {
    const { dialog } = renderCenter();
    const height = () => dialog.className.match(/\bh-\[[^\]]+\]/)?.[0];
    expect(height()).toBe("h-[min(90vh,820px)]");
    const rows = within(dialog).getAllByRole("checkbox");
    // Survol du schéma (paysage, plus court) : seule la mise en évidence de la ligne change
    const schema = rows[rows.length - 1]!.closest("label")!;
    const before = dialog.className;
    fireEvent.mouseEnter(schema);
    expect(schema.className).toMatch(/bg-brand-soft/);
    expect(dialog.className).toBe(before);
    expect(dialog.querySelector(".print-landscape")).not.toBeNull();
  });
});
