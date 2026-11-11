import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/Toast";
import { JEUDI_DOCS } from "@/lib/dayTasks";
import { demoEvents } from "@/lib/demo";
import { markPrinted } from "@/lib/djMeta";
import { TournamentProvider } from "@/store/tournament";

import { Jeudi } from "./Jeudi";

/** Le suivi du DJ est gardé par tournoi : chaque test ouvre le sien. */
function renderJeudi(id = "demo") {
  const events = demoEvents().map((e) => ({ ...e, at: "2026-10-29T10:00:00Z" }));
  return render(
    <MemoryRouter>
      <TournamentProvider persist={false} initialId={id} initialEvents={events as never}>
        <ToastProvider>
          <Jeudi />
        </ToastProvider>
      </TournamentProvider>
    </MemoryRouter>,
  );
}

const card = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

/** Tâches restantes, lues sur le bouton « Passer au vendredi » de la barre des tâches. */
const remaining = () =>
  screen
    .getByRole("button", { name: /Passer au vendredi/ })
    .parentElement?.parentElement?.getAttribute("title") ?? "";

// jsdom n'implémente pas le défilement vers une zone (utilisé après le tirage)
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("vue Jeudi", () => {
  it("affiche les tuiles, les têtes de série et lance le tirage des poules", () => {
    renderJeudi();
    expect(screen.getByRole("heading", { name: /Tirage des billards/ })).toBeInTheDocument();
    expect(
      screen.getByText("Inscrits").nextElementSibling?.querySelector("[aria-label]"),
    ).toHaveAttribute("aria-label", "76");
    expect(screen.getByText("Coupade Jules")).toBeInTheDocument();
    expect(screen.getByText("David Nicolas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lancer le tirage" }));
    expect(screen.getByRole("heading", { name: "Serpentin du tirage" })).toBeInTheDocument();
    // Liste statique des poules : une ligne par poule, sans numéros 1 à 4
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(18);
    expect(screen.getByRole("heading", { name: "Documents à imprimer" })).toBeInTheDocument();
    expect(screen.getByText(/17 poules créées/)).toBeInTheDocument();
    // Bouton du jour suivant dans la barre des tâches : désactivé tant que tout n'est pas fait
    const next = screen.getByRole("button", { name: /Passer au vendredi/ });
    expect(next).toBeDisabled();
    expect(next.parentElement?.parentElement).toHaveAttribute(
      "title",
      expect.stringMatching(/Reste à faire : .*Documents imprimés/),
    );
  });

  it("garde l'affectation modifiée des poules du vendredi quand on change un billard d'une phase suivante", () => {
    renderJeudi();
    const card = screen
      .getByRole("heading", { name: "Billards et poules affectées" })
      .closest("section")!;
    const tile = () => within(card).getByRole("group", { name: "Billard 2" });
    // Tournoi d'exemple : la poule 1 est sur le billard 11 ; le DJ la déplace sur le billard 2
    expect(within(tile()).queryByTitle(/^Poule 1 ·/)).toBeNull();
    fireEvent.change(within(card).getByLabelText("Ajouter une poule au billard 2"), {
      target: { value: "1" },
    });
    expect(within(tile()).getByTitle(/^Poule 1 ·/)).toBeInTheDocument();
    // … puis il modifie le billard d'un barrage (phases suivantes)
    const later = screen
      .getByRole("heading", { name: "Billards des phases suivantes" })
      .closest("section")!;
    fireEvent.click(within(later).getByRole("button", { name: "Modifier" }));
    const select = within(later).getByLabelText("Barrages · B1") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.value === "3" ? "4" : "3" } });
    // L'affectation des poules du vendredi n'est pas revenue à celle par défaut
    expect(within(tile()).getByTitle(/^Poule 1 ·/)).toBeInTheDocument();
  });

  it("billards et affectation : rien n'est fait à l'ouverture, le DJ valide les deux parties", async () => {
    renderJeudi("validation");
    const structure = card("Structure des billards");
    const affectation = card("Billards et poules affectées");
    // À l'ouverture du jeudi : les deux tâches restent à faire
    expect(remaining()).toMatch(/Billards définis · Billards des poules affectés/);
    expect(screen.queryByLabelText("Modifier : Billards définis")).toBeNull();
    expect(within(structure).getByText("À valider")).toBeInTheDocument();
    expect(within(affectation).getByText(/17 poules placées · à valider/)).toBeInTheDocument();
    // L'affectation ne se valide qu'une fois les billards validés
    expect(
      within(affectation).getByRole("button", { name: "Valider l'affectation" }),
    ).toBeDisabled();
    expect(within(affectation).getByText("Validez d'abord les billards")).toBeInTheDocument();

    fireEvent.click(within(structure).getByRole("button", { name: "Valider les billards" }));
    expect(await within(structure).findByText("Validés")).toBeInTheDocument();
    expect(within(structure).queryByRole("button", { name: "Valider les billards" })).toBeNull();
    await waitFor(() => expect(remaining()).not.toMatch(/Billards définis/));
    expect(screen.getByLabelText("Modifier : Billards définis")).toBeInTheDocument();
    expect(remaining()).toMatch(/Billards des poules affectés/);

    fireEvent.click(within(affectation).getByRole("button", { name: "Valider l'affectation" }));
    expect(await within(affectation).findByText(/affectation validée/)).toBeInTheDocument();
    expect(within(affectation).queryByRole("button", { name: "Valider l'affectation" })).toBeNull();
    await waitFor(() => expect(remaining()).not.toMatch(/Billards des poules affectés/));
  });

  it("une modification après validation remet la tâche à revalider", async () => {
    renderJeudi("revalidation");
    const structure = card("Structure des billards");
    const affectation = card("Billards et poules affectées");
    fireEvent.click(within(structure).getByRole("button", { name: "Valider les billards" }));
    await within(structure).findByText("Validés");
    fireEvent.click(within(affectation).getByRole("button", { name: "Valider l'affectation" }));
    await within(affectation).findByText(/affectation validée/);

    // Affectation modifiée : à revalider, les billards restent validés
    fireEvent.change(within(affectation).getByLabelText("Ajouter une poule au billard 2"), {
      target: { value: "1" },
    });
    expect(within(affectation).getByText("Modifiée, à revalider")).toBeInTheDocument();
    expect(remaining()).toMatch(/Affectation modifiée, à revalider/);
    expect(remaining()).not.toMatch(/Billards (définis|modifiés)/);
    // Revenir à ce qui était validé (annulation, déplacement inverse) rétablit la validation
    fireEvent.change(within(affectation).getByLabelText("Ajouter une poule au billard 11"), {
      target: { value: "1" },
    });
    expect(within(affectation).getByText(/affectation validée/)).toBeInTheDocument();
    fireEvent.change(within(affectation).getByLabelText("Ajouter une poule au billard 2"), {
      target: { value: "1" },
    });
    fireEvent.click(within(affectation).getByRole("button", { name: "Valider l'affectation" }));
    await within(affectation).findByText(/affectation validée/);
    await waitFor(() => expect(remaining()).not.toMatch(/Affectation/));

    // Structure modifiée sans toucher aux billards utilisés (le 11 passe en 3m10) : seuls les
    // billards sont à revalider, l'affectation reste cohérente et validée
    fireEvent.click(within(structure).getByRole("button", { name: "Modifier" }));
    fireEvent.change(within(structure).getByLabelText("Type du billard 11"), {
      target: { value: "3m10" },
    });
    fireEvent.click(within(structure).getByRole("button", { name: "Enregistrer" }));
    expect(within(structure).getByText("Modifiés, à revalider")).toBeInTheDocument();
    expect(remaining()).toMatch(/Billards modifiés, à revalider/);
    expect(remaining()).not.toMatch(/Affectation/);
    expect(within(affectation).getByText(/affectation validée/)).toBeInTheDocument();
    fireEvent.click(within(structure).getByRole("button", { name: "Valider les billards" }));
    await within(structure).findByText("Validés");

    // Un billard utilisé est retiré (le 10, poule 11) : l'affectation n'est plus cohérente,
    // elle est proposée à nouveau et les deux parties sont à revalider
    fireEvent.click(within(structure).getByRole("button", { name: "Modifier" }));
    fireEvent.click(within(structure).getByRole("button", { name: "Retirer le billard 10" }));
    fireEvent.click(within(structure).getByRole("button", { name: "Enregistrer" }));
    expect(within(structure).getByText("Modifiés, à revalider")).toBeInTheDocument();
    expect(within(affectation).getByText("Modifiée, à revalider")).toBeInTheDocument();
    expect(within(affectation).queryByRole("group", { name: /\b10\b/ })).toBeNull();
    expect(within(affectation).queryByText("Déposez une poule ici")).toBeNull();
    expect(remaining()).toMatch(
      /Billards modifiés, à revalider · Affectation modifiée, à revalider/,
    );
    // … et l'affectation attend de nouveau la validation des billards
    expect(
      within(affectation).getByRole("button", { name: "Valider l'affectation" }),
    ).toBeDisabled();
  });

  it("validations faites, tirage lancé et documents imprimés : le passage au vendredi s'ouvre", async () => {
    renderJeudi("vers-vendredi");
    fireEvent.click(
      within(card("Structure des billards")).getByRole("button", { name: "Valider les billards" }),
    );
    await within(card("Structure des billards")).findByText("Validés");
    fireEvent.click(
      within(card("Billards et poules affectées")).getByRole("button", {
        name: "Valider l'affectation",
      }),
    );
    await within(card("Billards et poules affectées")).findByText(/affectation validée/);
    fireEvent.click(screen.getByRole("button", { name: "Lancer le tirage" }));
    expect(screen.getByRole("button", { name: /Passer au vendredi/ })).toBeDisabled();
    expect(remaining()).toBe("Reste à faire : Documents imprimés");
    // Le tirage fige la structure sans défaire les validations
    expect(within(card("Structure des billards")).getByText("Validés")).toBeInTheDocument();
    await act(async () => {
      await markPrinted("vers-vendredi", JEUDI_DOCS);
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Passer au vendredi/ })).toBeEnabled(),
    );
  });
});
