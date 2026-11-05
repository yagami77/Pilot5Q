/** Vue d'impression plein écran : un ou plusieurs documents, bouton « Imprimer ». */
import { ArrowLeft, Printer } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui";
import { useTournament } from "@/store/tournament";

import { docById } from "./docs";

export function PrintView() {
  const { ready, id, state } = useTournament();
  const { doc } = useParams();
  const navigate = useNavigate();
  if (!ready) {
    return <div className="text-ink-muted grid min-h-[60vh] place-items-center">Chargement…</div>;
  }
  if (!id || !state.info) return <Navigate to="/" replace />;
  const docs = (doc ?? "")
    .split("+")
    .map(docById)
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  return (
    <div className="min-h-screen bg-[#e9edf5] print:bg-white">
      <div className="no-print bg-surface border-line sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Button
            icon={ArrowLeft}
            size="sm"
            onClick={() => {
              if (window.history.length > 1) void navigate(-1);
              else void navigate("/tournoi");
            }}
          >
            Retour au cockpit
          </Button>
          <div className="text-ink-muted min-w-0 flex-1 truncate text-[13px]">
            {docs.map((d) => d.label).join(" · ") || "Document introuvable"} ·{" "}
            {docs.reduce((n, d) => n + d.pages(state), 0)} page(s) A4
          </div>
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-[210mm] px-2 py-6 print:p-0">
        {docs.length === 0 ? (
          <p className="text-ink-muted text-center">Aucun document à afficher.</p>
        ) : (
          docs.map((d) => <div key={d.id}>{d.render(state)}</div>)
        )}
      </div>
    </div>
  );
}
