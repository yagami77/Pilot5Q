/** Page d'une étape : inscriptions, liste ordonnée, liste d'attente, convocations, ouverture, clôture. */
import { Navigate, useParams } from "react-router";

import { Card, PageHead } from "@/components/ui";

import { StageStatusChip } from "./Dashboard";
import { useSeasonDoc } from "./store";

export function StagePage() {
  const doc = useSeasonDoc();
  const { stageId } = useParams();
  const stage = doc.stages.find((s) => s.id === stageId);
  if (!stage) return <Navigate to="/responsable" replace />;
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title={`${stage.name} · ${stage.city || "ville à définir"}`}
        help={club ? club.name : "Club hôte à désigner dans le calendrier."}
      >
        <StageStatusChip stage={stage} now={new Date().toISOString()} />
      </PageHead>
      <Card bodyClassName="text-ink-muted p-6 text-center text-[13px]">
        Import des inscrits, liste ordonnée, liste d'attente, convocations et ouverture au directeur
        de jeu : étape suivante.
      </Card>
    </>
  );
}
