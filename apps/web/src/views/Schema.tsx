/** Schéma du tournoi : diagramme de flux du week-end, calculé depuis l'état réel. */
import { Printer, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { FlowDiagram } from "@/components/FlowDiagram";
import { PhaseRail } from "@/components/PhaseRail";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Chip, PageHead } from "@/components/ui";
import { FLOW_COLORS } from "@/lib/flow";
import { dateRange, plural } from "@/lib/format";
import { dayStatuses } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { currentDay } from "./Cockpit";

export function Schema() {
  const { ready, id, state } = useTournament();
  const navigate = useNavigate();
  const [replay, setReplay] = useState(0);
  if (!ready) {
    return (
      <div className="text-ink-muted grid min-h-[60vh] place-items-center text-sm">
        Chargement du tournoi…
      </div>
    );
  }
  if (!id || !state.info) return <Navigate to="/" replace />;
  const day = currentDay(dayStatuses(state));
  const legend: [string, string][] = [
    [FLOW_COLORS.gold, "Parcours Masters"],
    [FLOW_COLORS.green, "Parcours National"],
    [FLOW_COLORS.blue, "Qualifications du vendredi"],
    [FLOW_COLORS.grey, "Consolante"],
  ];
  return (
    <>
      <TopBar />
      <PhaseRail current={day} />
      <main className="mx-auto max-w-[1440px] px-4 pt-3 pb-20">
        <section className="animate-fade-up">
          <PageHead
            eyebrow={`${state.info.name} · ${dateRange(state.info.dates[0], state.info.dates[1])}`}
            title="Le schéma du tournoi, du jeudi au dimanche"
            help="Chaque ruban est un groupe de joueurs qui passe d'une étape à la suivante, sa largeur est proportionnelle au nombre. Survolez une étape pour suivre son parcours. Les étapes terminées sont en couleur pleine, celles à venir en pointillé."
          >
            <Chip>{plural(state.players.length, "inscrit")}</Chip>
            <Button icon={RotateCcw} onClick={() => setReplay((n) => n + 1)}>
              Rejouer
            </Button>
            <Button
              variant="primary"
              icon={Printer}
              onClick={() => {
                const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/tournoi/imprimer/schema`;
                const win = window.open(url, "_blank", "noopener");
                if (!win) void navigate("/tournoi/imprimer/schema");
              }}
            >
              Imprimer le schéma
            </Button>
          </PageHead>
          <Card>
            <div className="overflow-x-auto px-2.5 pt-2 pb-3.5">
              <FlowDiagram replayKey={replay} />
            </div>
            <div className="text-ink-muted flex flex-wrap gap-3.5 px-[18px] pb-3.5 text-[12px]">
              {legend.map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <i
                    className="inline-block h-2 w-[18px] rounded-[4px]"
                    style={{ background: c }}
                  />
                  {l}
                </span>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}
