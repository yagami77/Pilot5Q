/** Documents imprimables (A4) de l'espace du responsable : liste ordonnée, classement glissant, points d'un TN. */
import { latestStage, rankingRows, windowStages, type Stage } from "@pilot5q/domain";
import { ArrowLeft, Printer } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router";

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

/** Classement glissant, A4. */
export function RankingDoc({ doc }: { doc: SeasonDocument }) {
  const rows = rankingRows(doc.ranking);
  const last = latestStage(doc.ranking);
  const stages = last ? windowStages(last.season, last.tn) : [];
  const pages = chunk(rows, 50);
  const title = last
    ? `CLASSEMENT GLISSANT 5 QUILLES APRÈS TN${last.tn} ${last.season}`
    : "CLASSEMENT GLISSANT 5 QUILLES";
  return (
    <>
      {pages.map((part, k) => (
        <Page key={k}>
          <Head
            title={title}
            sub="4 meilleurs résultats sur les 5 derniers TN (somme simple sinon) · départage : moyenne"
            right={`page ${k + 1}/${pages.length}`}
          />
          <table className="text-[10px]">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Nom</th>
                <th>Club</th>
                <th>Licence</th>
                <th>Points</th>
                <th>Moy.</th>
                <th>Nb</th>
                {stages.map((s) => (
                  <th key={`${s.season}${s.tn}`}>
                    TN{s.tn} {s.season.slice(2, 4)}-{s.season.slice(7, 9)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {part.map((r) => (
                <tr key={r.licence || r.name}>
                  <td className="font-mono">{r.position}</td>
                  <td>{r.name}</td>
                  <td>{r.club}</td>
                  <td className="font-mono">{r.licence}</td>
                  <td className="font-mono font-bold">{dec(r.pts, 3)}</td>
                  <td className="font-mono">{dec(r.moy, 3)}</td>
                  <td className="font-mono">{r.count}</td>
                  {stages.map((s) => {
                    const res = r.results.find((x) => x.season === s.season && x.tn === s.tn);
                    return (
                      <td key={`${s.season}${s.tn}`} className="font-mono">
                        {res ? dec(res.pts, 2) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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

function PrintShell() {
  const { ready, doc } = useSeason();
  const { doc: kind, stageId } = useParams();
  const navigate = useNavigate();
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
    kind === "classement" ? (
      <RankingDoc doc={doc} />
    ) : kind === "liste" && stage ? (
      <OrderedListDoc doc={doc} stage={stage} />
    ) : kind === "points" && stage ? (
      <PointsDoc doc={doc} stage={stage} />
    ) : (
      <p className="text-ink-muted text-center">Document introuvable.</p>
    );
  const label =
    kind === "classement"
      ? "Classement glissant"
      : kind === "liste"
        ? "Liste ordonnée"
        : "Points du tournoi";
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
          <div className="text-ink-muted min-w-0 flex-1 truncate text-[13px]">{label} · A4</div>
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
