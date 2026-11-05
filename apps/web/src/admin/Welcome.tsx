/** Première ouverture de l'espace du responsable : charger la démonstration ou partir de zéro. */
import { Sparkles, FilePlus2, ArrowRight } from "lucide-react";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { Button, Card, Chip, PageHead } from "@/components/ui";
import inscriptions from "@/data/tn-exemple-inscriptions.json";

import { SEASON_FIXTURE, demoSeason, emptySeason, type DemoInscription } from "./demo";
import { useSeason } from "./store";
import { Field, Input } from "./ui";

export function Welcome() {
  const { open } = useSeason();
  const toast = useToast();
  const [season, setSeason] = useState("2026-2027");
  const order = (inscriptions as { registrations: DemoInscription[] }).registrations;
  return (
    <>
      <PageHead
        eyebrow="Responsable national"
        title="Ouvrir une saison"
        help="Le calendrier, les clubs hôtes, la base joueurs et le classement glissant restent dans ce navigateur jusqu'à l'arrivée du serveur partagé."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="animate-fade-up flex flex-col"
          bodyClassName="flex flex-1 flex-col gap-4 p-6"
        >
          <span className="bg-gold-soft text-gold-ink grid size-11 place-items-center rounded-[12px]">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[20px]">Charger la saison de démonstration</h2>
            <p className="text-ink-muted mt-1">
              Saison {SEASON_FIXTURE.season} : calendrier réel des 5 TN,{" "}
              {SEASON_FIXTURE.clubs.length} clubs hôtes, {SEASON_FIXTURE.players.length} joueurs,
              classement glissant reconstitué avant le TN 2 et les {order.length} inscrits du
              tournoi d'exemple.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="blue">5 TN</Chip>
            <Chip tone="gold">{SEASON_FIXTURE.windowBefore.length} classés</Chip>
            <Chip tone="grey">noms et licences fictifs</Chip>
          </div>
          <Button
            variant="primary"
            size="lg"
            iconRight={ArrowRight}
            className="mt-auto self-start"
            onClick={() => {
              open(demoSeason(order));
              toast("Saison de démonstration chargée");
            }}
          >
            Charger la démonstration
          </Button>
        </Card>
        <Card
          className="animate-fade-up flex flex-col [animation-delay:80ms]"
          bodyClassName="flex flex-1 flex-col gap-4 p-6"
        >
          <span className="bg-brand-soft text-brand grid size-11 place-items-center rounded-[12px]">
            <FilePlus2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[20px]">Créer une saison vide</h2>
            <p className="text-ink-muted mt-1">
              Cinq étapes à renseigner, aucun club ni joueur : à compléter par import ou saisie.
            </p>
          </div>
          <Field label="Saison">
            <Input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2027-2028"
            />
          </Field>
          <Button
            size="lg"
            className="mt-auto self-start"
            onClick={() => {
              if (!/^\d{4}-\d{4}$/.test(season)) {
                toast("Saison attendue au format 2027-2028");
                return;
              }
              open(emptySeason(season));
              toast(`Saison ${season} créée`);
            }}
          >
            Créer la saison
          </Button>
        </Card>
      </div>
    </>
  );
}
