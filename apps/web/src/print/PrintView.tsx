/**
 * Vue d'impression plein écran : un ou plusieurs documents en A4, bouton « Imprimer ».
 *
 * Ouverte avec `?imprimer=1` (bouton « Imprimer » du centre d'impression), la vue lance
 * elle-même la boîte d'impression du navigateur, une seule fois, quand le document est prêt
 * (polices chargées, rendu terminé). Sans le paramètre (« Aperçu »), elle attend le bouton.
 */
import type { TournamentState } from "@pilot5q/domain";
import { ArrowLeft, Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";

import { Button } from "@/components/ui";
import { markPrinted } from "@/lib/djMeta";
import { useTournament } from "@/store/tournament";

import { docById, type DocDef } from "./docs";
import { AUTO_PRINT_PARAM, whenPrintReady } from "./launch";

/**
 * Titre de l'onglet pendant l'impression : c'est le nom que le navigateur propose pour le
 * fichier quand on choisit « Enregistrer au format PDF » (« TN 2 Ronchin - Tableau des barrages »).
 */
export function printTitle(state: TournamentState, docs: DocDef[]): string {
  const tournament = [state.info?.name, state.info?.city].filter(Boolean).join(" ");
  const what =
    docs.length === 1
      ? (docs[0]?.label ?? "").replace(/\s*\([^)]*\)\s*$/, "")
      : `Documents (${docs.length})`;
  return [tournament, what].filter(Boolean).join(" - ");
}

export function PrintView() {
  const { ready, id, state } = useTournament();
  const { doc } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const auto = params.get(AUTO_PRINT_PARAM) === "1";
  const sheets = useRef<HTMLDivElement>(null);
  // Impression directe déjà lancée (survit au double montage de React StrictMode)
  const launched = useRef(false);

  const docs = useMemo(
    () =>
      (doc ?? "")
        .split("+")
        .map(docById)
        .filter((d): d is DocDef => Boolean(d)),
    [doc],
  );
  const usable = ready && Boolean(id) && Boolean(state.info) && docs.length > 0;

  // Suivi « documents imprimés » des tâches du jour : noté au lancement de l'impression
  // (un simple aperçu ne compte pas)
  const print = useCallback(() => {
    if (id)
      void markPrinted(
        id,
        docs.map((d) => d.id),
      );
    window.print();
  }, [id, docs]);

  const title = usable ? printTitle(state, docs) : null;
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  useEffect(() => {
    if (!auto || !usable || launched.current) return;
    let cancelled = false;
    void whenPrintReady(sheets.current ?? document).then(() => {
      if (cancelled || launched.current) return;
      launched.current = true;
      // Paramètre retiré de l'adresse : recharger la page ne relance pas l'impression
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(AUTO_PRINT_PARAM);
          return next;
        },
        { replace: true },
      );
      print();
    });
    return () => {
      cancelled = true;
    };
  }, [auto, usable, print, setParams]);

  if (!ready) {
    return <div className="text-ink-muted grid min-h-[60vh] place-items-center">Chargement…</div>;
  }
  if (!id || !state.info) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen bg-[#e9edf5] print:bg-white">
      <div className="no-print bg-surface border-line sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
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
          <div className="min-w-0 flex-1">
            <div className="text-ink-secondary truncate text-[13px] font-semibold">
              {docs.map((d) => d.label).join(" · ") || "Document introuvable"} ·{" "}
              {docs.reduce((n, d) => n + d.pages(state), 0)} page(s) A4
            </div>
            <div className="text-ink-muted truncate text-[11.5px]">
              Pour garder le document : dans la boîte d'impression, choisir « Enregistrer au format
              PDF ».
            </div>
          </div>
          <Button variant="primary" icon={Printer} onClick={print} disabled={docs.length === 0}>
            Imprimer
          </Button>
        </div>
      </div>
      <div
        ref={sheets}
        className={`mx-auto px-2 py-6 print:p-0 ${docs.some((d) => d.landscape) ? "max-w-[297mm]" : "max-w-[210mm]"}`}
      >
        {docs.length === 0 ? (
          <p className="text-ink-muted text-center">Aucun document à afficher.</p>
        ) : (
          docs.map((d) => <div key={d.id}>{d.render(state)}</div>)
        )}
      </div>
    </div>
  );
}
