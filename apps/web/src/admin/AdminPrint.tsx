/** Documents imprimables (A4) de l'espace du responsable : liste ordonnée, points d'un TN (le classement glissant est un PDF, voir `rankingPdf`). */
import type { Stage } from "@pilot5q/domain";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { Button } from "@/components/ui";
import { dateRange } from "@/lib/format";

import { SeasonProvider, useSeason } from "./store";
import { stageAcceptance } from "./stage";
import type { SeasonDocument } from "./persistence";
import { dec } from "./ui";

function Page({ children }: { children: ReactNode }) {
  return <section className="print-page print-doc">{children}</section>;
}

function Head({ title, sub, right }: { title: string; sub: string; right?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between border-b-2 border-black pb-1.5">
      <div>
        <b className="text-[14px]">{title}</b>
        <div>{sub}</div>
      </div>
      {right ? <b className="text-[12px]">{right}</b> : null}
    </div>
  );
}

const chunk = <T,>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out.length ? out : [[]];
};

function stageSub(doc: SeasonDocument, stage: Stage): string {
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  return `${stage.name} ${stage.season} · ${stage.city}${club ? ` · ${club.name}` : ""}${stage.start ? ` · ${dateRange(stage.start, stage.end)}` : ""}`;
}

/** Liste ordonnée des acceptés : 8 Masters puis l'ordre du serpentin, U21 signalés. */
export function OrderedListDoc({ doc, stage }: { doc: SeasonDocument; stage: Stage }) {
  const { accepted, waiting } = stageAcceptance(doc, stage);
  const pages = chunk(accepted, 45);
  return (
    <>
      {pages.map((rows, k) => (
        <Page key={k}>
          <Head
            title="LISTE ORDONNÉE DES PARTICIPANTS"
            sub={stageSub(doc, stage)}
            right={`${accepted.length} acceptés · page ${k + 1}/${pages.length}`}
          />
          <table>
            <thead>
              <tr>
                <th>Rang</th>
                <th>Nom</th>
                <th>Club</th>
                <th>Licence</th>
                <th>Place</th>
                <th>Tableau</th>
                <th>U21</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.licence} className={p.seed <= 8 ? "bg-[#ececec] font-bold" : undefined}>
                  <td className="font-mono">{p.seed}</td>
                  <td>{p.name}</td>
                  <td>{p.club}</td>
                  <td className="font-mono">{p.licence}</td>
                  <td className="font-mono">
                    {p.place === null ? "nouveau" : String(p.place).replace(".", ",")}
                  </td>
                  <td>{p.seed <= 8 ? "Masters (samedi)" : "Vendredi"}</td>
                  <td>{p.junior ? "U21" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {k === pages.length - 1 && waiting.length > 0 ? (
            <>
              <div className="mt-3 mb-1 font-bold">LISTE D'ATTENTE ({waiting.length})</div>
              <table>
                <tbody>
                  {waiting.map((p, i) => (
                    <tr key={p.licence}>
                      <td className="font-mono">{i + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.club}</td>
                      <td className="font-mono">{p.licence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          <div className="mt-2 text-[9.5px] text-[#555]">
            Place : classement glissant en cours ; sinon dernier classement connu (9 si ≤ 8, sinon P
            + 0,5) ; sinon nouveau joueur dans l'ordre d'inscription (SPEC §2).
          </div>
        </Page>
      ))}
    </>
  );
}

/** Points attribués à l'issue d'un TN (classement final du tournoi). */
export function PointsDoc({ doc, stage }: { doc: SeasonDocument; stage: Stage }) {
  const closure = doc.closures[stage.id];
  const awards = closure?.awards ?? [];
  const pages = chunk(awards, 50);
  const origin = { M: "Masters", N: "National", CLS: "Consolante", PREQ: "Vendredi" };
  return (
    <>
      {pages.map((part, k) => (
        <Page key={k}>
          <Head
            title="CLASSEMENT FINAL DU TOURNOI · POINTS ATTRIBUÉS"
            sub={stageSub(doc, stage)}
            right={`page ${k + 1}/${pages.length}`}
          />
          <table>
            <thead>
              <tr>
                <th>Place</th>
                <th>Nom</th>
                <th>Club</th>
                <th>Tableau</th>
                <th>Barème</th>
                <th>Décimale</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {part.map((a, i) => (
                <tr key={a.name}>
                  <td className="font-mono">{k * 50 + i + 1}</td>
                  <td>{a.name}</td>
                  <td>{a.club}</td>
                  <td>{a.abandon ? "Abandon" : origin[a.origin]}</td>
                  <td className="font-mono">{a.points}</td>
                  <td className="font-mono">{dec(a.decimal, 4)}</td>
                  <td className="font-mono font-bold">
                    {dec(a.abandon ? 0 : a.points + a.decimal, 4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      ))}
    </>
  );
}

/** Nom de fichier proposé par « Enregistrer au format PDF » (titre du document). */
export function pdfTitle(kind: string | undefined, stage: Stage | undefined) {
  const what = kind === "liste" ? "Liste des participants" : "Points du tournoi";
  return stage ? `${what} - ${stage.name} ${stage.season} ${stage.city}` : what;
}

function PrintShell() {
  const { ready, doc } = useSeason();
  const { doc: kind, stageId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stageForTitle = doc?.stages.find((s) => s.id === stageId);
  const title = pdfTitle(kind, stageForTitle);
  const auto = params.get("pdf") === "1";
  const printed = useRef(false);

  // Le titre de la page devient le nom du PDF ; `?pdf=1` ouvre directement l'enregistrement.
  useEffect(() => {
    if (!ready || !doc) return;
    const previous = document.title;
    document.title = title;
    let timer: number | undefined;
    if (auto && !printed.current) {
      printed.current = true;
      timer = window.setTimeout(() => {
        void document.fonts?.ready.then(() => window.print());
      }, 400);
    }
    return () => {
      document.title = previous;
      if (timer) window.clearTimeout(timer);
    };
  }, [ready, doc, title, auto]);

  if (!ready)
    return <div className="text-ink-muted grid min-h-[60vh] place-items-center">Chargement…</div>;
  if (!doc)
    return (
      <div className="text-ink-muted grid min-h-[60vh] place-items-center">
        Aucune saison ouverte.
      </div>
    );
  const stage = doc.stages.find((s) => s.id === stageId);
  const content =
    kind === "liste" && stage ? (
      <OrderedListDoc doc={doc} stage={stage} />
    ) : kind === "points" && stage ? (
      <PointsDoc doc={doc} stage={stage} />
    ) : (
      <p className="text-ink-muted text-center">Document introuvable.</p>
    );
  const label = kind === "liste" ? "Liste ordonnée" : "Points du tournoi";
  return (
    <div className="min-h-screen bg-[#e9edf5] print:bg-white">
      <div className="no-print bg-surface border-line sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Button
            icon={ArrowLeft}
            size="sm"
            onClick={() => {
              if (window.history.length > 1) void navigate(-1);
              else void navigate("/responsable");
            }}
          >
            Retour
          </Button>
          <div className="text-ink-muted min-w-0 flex-1 truncate text-[13px]">
            {label} · A4 · PDF : choisir « Enregistrer au format PDF » comme imprimante
          </div>
          <Button icon={FileDown} onClick={() => window.print()}>
            Télécharger en PDF
          </Button>
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-[210mm] px-2 py-6 print:p-0">{content}</div>
    </div>
  );
}

export function AdminPrint() {
  return (
    <SeasonProvider>
      <PrintShell />
    </SeasonProvider>
  );
}
