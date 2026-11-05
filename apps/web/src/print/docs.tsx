/**
 * Documents imprimables (A4, noir sur blanc). Chaque document est une fonction de l'état
 * qui rend une ou plusieurs pages `.print-page`.
 */
import type { Match, Poule, TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

import { FlowDiagram } from "@/components/FlowDiagram";

import { PlayersBoard, PoulesBoard } from "./boards";
import { PrintHeader } from "./brand";
import { SheetPages, barrageSheets, finalSheets, pairPages, pouleSheetPages } from "./sheets";

import { matchWinner } from "@/lib/engine";
import { clubShort, euros, longDate, nice, shortName } from "@/lib/format";
import { computePrizes } from "@/lib/prizes";
import {
  barragesDone,
  billardType,
  dayDate,
  distanceLabel,
  orderedMatches,
  phaseDistance,
  pouleBillards,
  pouleState,
  preqRanking,
  qualifiers,
  roundLabel,
  roundShort,
  type Day,
} from "@/lib/tournament";

export type DocId =
  | "schema"
  | "pointage"
  | "joueurs-poules"
  | "tableau-poules"
  | "premiers-matchs"
  | "feuilles-preq"
  | "classement-preq"
  | "resultats-poules"
  | "tableau-barrages"
  | "feuilles-barrages"
  | "pointage-consolante"
  | "poules-samedi"
  | "feuilles-qm"
  | "feuilles-qn"
  | "tours-masters"
  | "tableau-consolante"
  | "tableaux-finaux"
  | "feuilles-finales"
  | "primes";

export interface DocDef {
  id: DocId;
  label: string;
  /** Page A4 en paysage. */
  landscape?: boolean;
  pages: (state: TournamentState) => number;
  available: (state: TournamentState) => boolean;
  render: (state: TournamentState) => ReactNode;
}

/* ---------- Briques ---------- */

function Page({ children }: { children: ReactNode }) {
  return <section className="print-page print-doc">{children}</section>;
}

/** Titre en minuscules accentuées (« POULES MASTERS » → « Poules Masters »). */
function sentence(title: string): string {
  const low = title.toLowerCase();
  return (low.charAt(0).toUpperCase() + low.slice(1))
    .replace(/\bmasters\b/g, "Masters")
    .replace(/\bnational\b/g, "National")
    .replace(/\btn\b/g, "TN")
    .replace(/ · ([a-zà-ÿ])/g, (_, c: string) => ` · ${c.toUpperCase()}`);
}

function DocHeader({
  state,
  title,
  subtitle,
  right,
  rightSub,
}: {
  state: TournamentState;
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
}) {
  return (
    <PrintHeader
      state={state}
      title={sentence(title)}
      {...(subtitle ? { date: subtitle } : {})}
      right={right}
      rightSub={rightSub}
    />
  );
}

function Foot({ children }: { children: ReactNode }) {
  return <div className="mt-2 text-[9.5px] text-[#555]">{children}</div>;
}

const BOX = "☐";

function scoreText(m: Match, multi: boolean): string {
  if (m.forfait) return m.forfait === "a" ? "forfait – V" : "V – forfait";
  if (m.sa === null || m.sb === null) return "";
  if (multi && m.setsA && m.setsB)
    return `${m.sa}–${m.sb} (${m.setsA.map((a, i) => `${a}-${m.setsB?.[i] ?? ""}`).join(", ")})`;
  return `${m.sa} – ${m.sb}`;
}

/* ---------- Documents ---------- */

function pouleOfMap(state: TournamentState, phase: "PREQ" | "QN" | "QM") {
  const map = new Map<string, Poule>();
  for (const p of state.poules[phase]) for (const n of p.players) map.set(n, p);
  return map;
}

const sortFr = (a: string, b: string) => a.localeCompare(b, "fr");

function Pointage({ state }: { state: TournamentState }) {
  const masters = new Set(state.masters);
  const pouleOf = pouleOfMap(state, "PREQ");
  const list = [...state.players].sort((a, b) => sortFr(a.name, b.name));
  const fee = state.rules.inscriptionFee;
  const juniors = list.filter((p) => p.junior).length;
  return (
    <Page>
      <DocHeader
        state={state}
        title="POINTAGE DES DROITS D'INSCRIPTION"
        subtitle={`${longDate(dayDate(state, "vendredi"), true)} · liste alphabétique`}
        right={`${fee} €`}
        rightSub="U21 exemptés"
      />
      <table>
        <thead>
          <tr>
            <th className="w-7">Payé</th>
            <th>Joueur</th>
            <th className="w-20">Licence</th>
            <th>Club</th>
            <th className="w-24">Poule · billard</th>
            <th className="w-14">Droit</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const m = masters.has(p.name);
            const po = pouleOf.get(p.name);
            return (
              <tr key={p.licence} className={m ? "bg-[#fff1c9]" : undefined}>
                <td className="text-center text-[13px]">{BOX}</td>
                <td className="font-semibold">
                  {nice(p.name)}
                  {m ? (
                    <b className="ml-1.5 text-[8.5px] text-[#8a5a08] uppercase">Masters · samedi</b>
                  ) : null}
                  {p.junior ? (
                    <b className="ml-1.5 rounded-sm border border-black px-1 text-[8.5px] uppercase">
                      U21
                    </b>
                  ) : null}
                </td>
                <td className="font-mono">{p.licence}</td>
                <td>{clubShort(p.club)}</td>
                <td>
                  {m
                    ? "Masters"
                    : po
                      ? `P${po.num} · B${pouleBillards(state, "PREQ", po).join("/")}`
                      : "—"}
                </td>
                <td className="text-center">{p.junior ? "exempté" : `${fee} €`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Foot>
        Fond jaune : Masters préqualifiés, convoqués le samedi (ils règlent leur inscription le
        samedi). U21 : exemptés du droit d'inscription ({juniors} signalé{juniors > 1 ? "s" : ""}).
        Total attendu : {euros(fee * (list.length - juniors))}.
      </Foot>
    </Page>
  );
}

function PremiersMatchs({ state }: { state: TournamentState }) {
  const d = phaseDistance(state, "PREQ");
  return (
    <Page>
      <DocHeader
        state={state}
        title="PREMIERS MATCHS PAR BILLARD"
        subtitle={`${longDate(dayDate(state, "vendredi"), true)} · la poule au numéro le plus élevé commence`}
      />
      <table>
        <thead>
          <tr>
            <th className="w-16">Billard</th>
            <th className="w-16">Poule</th>
            <th>Premier match (2 contre 3)</th>
            <th className="w-32">Arbitre</th>
            <th>Poule suivante</th>
          </tr>
        </thead>
        <tbody>
          {state.billards.map((b) => {
            const poules = state.poules.PREQ.filter((p) =>
              pouleBillards(state, "PREQ", p).includes(b.num),
            ).sort((x, y) => y.num - x.num);
            const first = poules[0];
            const om = first ? orderedMatches(first, d)[0] : undefined;
            return (
              <tr key={b.num}>
                <td className="font-bold">
                  {b.num} <span className="font-normal text-[#555]">{b.type}</span>
                </td>
                <td>{first ? `Poule ${first.num}` : "—"}</td>
                <td>{om ? `${nice(om.match.a)} – ${nice(om.match.b)}` : "libre"}</td>
                <td>{om?.arbitre ? shortName(om.arbitre) : ""}</td>
                <td>
                  {poules
                    .slice(1)
                    .map((p) => `Poule ${p.num}`)
                    .join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Page>
  );
}

function ClassementPreq({ state }: { state: TournamentState }) {
  const ranking = preqRanking(state);
  const size = state.rules.barrageSize;
  const natTo = size + state.rules.nationalSize - size / 2;
  return (
    <Page>
      <DocHeader
        state={state}
        title="CLASSEMENT DES PRÉQUALIFICATIONS"
        subtitle={longDate(dayDate(state, "vendredi"), true)}
        right={`${ranking.length} classés`}
      />
      <table>
        <thead>
          <tr>
            <th className="w-8">Place</th>
            <th>Joueur</th>
            <th className="w-12">Poule</th>
            <th className="w-8">Rang</th>
            <th className="w-8">Pm</th>
            <th className="w-8">Ps</th>
            <th className="w-12">Faits</th>
            <th className="w-12">Subis</th>
            <th className="w-12">Moy.</th>
            <th className="w-20">Suite</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r) => (
            <tr key={r.name} className={r.place <= size ? "bg-[#eef2fb]" : undefined}>
              <td className="text-center font-bold">{r.place}</td>
              <td className="font-semibold">{nice(r.name)}</td>
              <td className="text-center">{r.poule}</td>
              <td className="text-center">{r.rang ?? "–"}</td>
              <td className="text-center font-mono">{r.ptm}</td>
              <td className="text-center font-mono">{r.pts}</td>
              <td className="text-center font-mono">{r.faits}</td>
              <td className="text-center font-mono">{r.subis}</td>
              <td className="text-center font-mono">{r.moy.toFixed(3)}</td>
              <td>{r.place <= size ? "Barrage" : r.place <= natTo ? "National" : "Consolante*"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Foot>
        Classement : rang dans la poule, points de match, points de set, moyenne, ordre d'arrivée.
        Poules de 3 : +2 Pm et +1 Ps. * Consolante sur volontariat.
      </Foot>
    </Page>
  );
}

function ResultatsPoules({
  state,
  phase,
  title,
}: {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  title: string;
}) {
  const d = phaseDistance(state, phase);
  const multi = d.setsGagnants > 1;
  const poules = state.poules[phase];
  const chunks: Poule[][] = [];
  for (let i = 0; i < poules.length; i += 6) chunks.push(poules.slice(i, i + 6));
  return (
    <>
      {chunks.map((chunk, ci) => (
        <Page key={ci}>
          <DocHeader state={state} title={title} subtitle={`page ${ci + 1}/${chunks.length}`} />
          <div className="grid grid-cols-2 gap-2">
            {chunk.map((p) => {
              const rows = pouleState(state, phase, p).rows;
              return (
                <div key={p.num}>
                  <table>
                    <thead>
                      <tr>
                        <th colSpan={5}>Poule {p.num}</th>
                      </tr>
                      <tr>
                        <th className="w-5">#</th>
                        <th>Joueur</th>
                        <th className="w-7">Pm</th>
                        <th className="w-7">Ps</th>
                        <th className="w-12">Moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.name}>
                          <td className="text-center">{r.rang ?? "–"}</td>
                          <td className="font-semibold">{nice(r.name)}</td>
                          <td className="text-center font-mono">{r.ptm}</td>
                          <td className="text-center font-mono">{r.pts}</td>
                          <td className="text-center font-mono">{r.moy.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="mt-1">
                    <tbody>
                      {orderedMatches(p, d).map((om) => (
                        <tr key={om.match.id}>
                          <td>
                            {shortName(om.match.a)} – {shortName(om.match.b)}
                          </td>
                          <td className="w-28 text-right font-mono">
                            {scoreText(om.match, multi)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </Page>
      ))}
    </>
  );
}

function TableauBarrages({ state }: { state: TournamentState }) {
  const ranking = preqRanking(state);
  const placeOf = new Map(ranking.map((r) => [r.name, r.place]));
  const d = state.rules.distances.barrage;
  return (
    <Page>
      <DocHeader
        state={state}
        title="BARRAGES"
        subtitle={`${longDate(dayDate(state, "vendredi"), true)} · vainqueurs → Masters, perdants → National`}
        right={distanceLabel(d)}
      />
      <table>
        <thead>
          <tr>
            <th className="w-10">Match</th>
            <th className="w-14">Billard</th>
            <th>Joueur A (place)</th>
            <th className="w-20">Score</th>
            <th>Joueur B (place)</th>
            <th>Vainqueur</th>
          </tr>
        </thead>
        <tbody>
          {state.barrages.map((m) => {
            const w = matchWinner(m, d);
            return (
              <tr key={m.id} className="h-8">
                <td className="font-bold">{m.id}</td>
                <td className="text-center">
                  {m.billard ?? "—"}
                  <div className="text-[8.5px] text-[#555]">
                    {m.billard ? billardType(state, m.billard) : ""}
                  </div>
                </td>
                <td>
                  <b>{nice(m.a)}</b> ({placeOf.get(m.a) ?? "–"})
                </td>
                <td className="text-center font-mono">{scoreText(m, false)}</td>
                <td>
                  <b>{nice(m.b)}</b> ({placeOf.get(m.b) ?? "–"})
                </td>
                <td className="font-semibold">{w ? nice(w) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Page>
  );
}

function PointageConsolante({ state }: { state: TournamentState }) {
  const q = qualifiers(state);
  const ranking = preqRanking(state);
  const placeOf = new Map(ranking.map((r) => [r.name, r.place]));
  return (
    <Page>
      <DocHeader
        state={state}
        title="CONSOLANTE · VOLONTAIRES"
        subtitle={`${longDate(dayDate(state, "samedi"), true)} · ${distanceLabel(state.rules.distances.cls)} · maximum ${state.rules.consolanteMax} joueurs`}
        right={`${q.consolante.length} éligibles`}
      />
      <table>
        <thead>
          <tr>
            <th className="w-10">Joue</th>
            <th className="w-10">Place</th>
            <th>Joueur</th>
          </tr>
        </thead>
        <tbody>
          {q.consolante.map((n) => (
            <tr key={n}>
              <td className="text-center text-[13px]">{BOX}</td>
              <td className="text-center">{placeOf.get(n) ?? "–"}</td>
              <td className="font-semibold">{nice(n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Foot>Tableau à élimination directe dans l'ordre du classement de sortie des poules.</Foot>
    </Page>
  );
}

function ToursMasters({ state }: { state: TournamentState }) {
  const d = phaseDistance(state, "QM");
  const big = state.billards.filter((b) => b.type === "3m10");
  return (
    <Page>
      <DocHeader
        state={state}
        title="TOURS DE JEU · MASTERS"
        subtitle={`${longDate(dayDate(state, "samedi"), true)} · ${distanceLabel(d)} · ${big.length} billards 3m10`}
      />
      <table>
        <thead>
          <tr>
            <th className="w-10">Tour</th>
            {big.map((b) => (
              <th key={b.num}>Billard {b.num}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((round) => (
            <tr key={round} className="h-9">
              <td className="text-center font-bold">{round + 1}</td>
              {big.map((b) => {
                const poules = state.poules.QM.filter((p) =>
                  pouleBillards(state, "QM", p).includes(b.num),
                );
                return (
                  <td key={b.num}>
                    {poules.map((p) => {
                      const om = orderedMatches(p, d)[round];
                      return om ? (
                        <div key={p.num}>
                          <span className="text-[9px] text-[#555]">P{p.num} · </span>
                          {shortName(om.match.a)} – {shortName(om.match.b)}
                        </div>
                      ) : null;
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Foot>
        Quand deux poules partagent un billard, elles alternent leurs tours. Le tableau suit l'ordre
        du code sportif : 2–3, 1–4, perdants, gagnants, dernier de 4, dernier de 1.
      </Foot>
    </Page>
  );
}

function BracketTable({
  state,
  phase,
  title,
}: {
  state: TournamentState;
  phase: "N" | "M" | "CLS";
  title: string;
}) {
  const b = state.brackets[phase];
  const rounds = (["R16", "QF", "SF", "F"] as const).filter((r) => b.some((m) => m.round === r));
  return (
    <Page>
      <DocHeader
        state={state}
        title={title}
        subtitle={longDate(dayDate(state, phase === "CLS" ? "samedi" : "dimanche"), true)}
      />
      {rounds.map((r) => {
        const d = phaseDistance(state, phase, r);
        return (
          <table key={r} className="mb-2">
            <thead>
              <tr>
                <th colSpan={5}>
                  {roundLabel(r)} · {distanceLabel(d)}
                </th>
              </tr>
            </thead>
            <tbody>
              {b
                .filter((m) => m.round === r)
                .map((m) => (
                  <tr key={m.id} className="h-7">
                    <td className="w-10 font-bold">
                      {roundShort(r)}
                      {m.slot}
                    </td>
                    <td className="w-14 text-center">{m.billard ? `B${m.billard}` : ""}</td>
                    <td>{m.a ? nice(m.a) : <span className="text-[#555]">{m.labelA}</span>}</td>
                    <td className="w-28 text-center font-mono">
                      {scoreText(m, d.setsGagnants > 1)}
                    </td>
                    <td>{m.b ? nice(m.b) : <span className="text-[#555]">{m.labelB}</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        );
      })}
    </Page>
  );
}

function Primes({ state }: { state: TournamentState }) {
  const p = computePrizes(state);
  const block = (title: string, total: number, lines: typeof p.masters.lines) => (
    <table className="mb-3">
      <thead>
        <tr>
          <th colSpan={4}>
            {title} · {euros(total)}
          </th>
        </tr>
        <tr>
          <th>Palier</th>
          <th className="w-14">Nombre</th>
          <th className="w-20">Par joueur</th>
          <th>Bénéficiaires</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.label}>
            <td className="font-semibold">{l.label}</td>
            <td className="text-center">{l.count}</td>
            <td className="text-right font-mono">{euros(l.amount)}</td>
            <td>{l.players.map(nice).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <Page>
      <DocHeader
        state={state}
        title="PRIMES"
        subtitle={longDate(dayDate(state, "dimanche"), true)}
        right={euros(p.cagnotte)}
        rightSub="cagnotte"
      />
      <p className="mb-2">
        Cagnotte : {state.rules.inscriptionFee} € × {p.payers} joueurs non juniors + {euros(p.ffb)}{" "}
        FFB + {euros(p.club)} club = <b>{euros(p.cagnotte)}</b>. Masters 80 %, National 20 %.
      </p>
      {block("Masters", p.masters.total, p.masters.lines)}
      {block("National", p.national.total, p.national.lines)}
      <Foot>Les primes des éliminés peuvent être réglées dès le samedi soir.</Foot>
    </Page>
  );
}

/* ---------- Registre ---------- */

const drawn = (s: TournamentState) => s.poules.PREQ.length > 0;
const preqClosed = (s: TournamentState) => Boolean(s.closed.PREQ);
const satReady = (s: TournamentState) => s.poules.QM.length > 0 || s.poules.QN.length > 0;

export const DOCS: DocDef[] = [
  {
    id: "schema",
    label: "Schéma du TN (A4 paysage)",
    landscape: true,
    pages: () => 1,
    available: (s) => s.players.length > 0,
    render: (s) => (
      <section className="print-page print-doc print-landscape">
        <DocHeader
          state={s}
          title="SCHÉMA DU TOURNOI"
          subtitle={`${longDate(dayDate(s, "jeudi"), true)} → ${longDate(dayDate(s, "dimanche"), true)}`}
          right={`${s.players.length} inscrits`}
        />
        <div className="mt-2">
          <FlowDiagram print />
        </div>
        <Foot>
          Chaque ruban est un groupe de joueurs qui passe d'une étape à la suivante, sa largeur est
          proportionnelle au nombre. Or : Masters · vert : National · bleu : qualifications du
          vendredi · gris : consolante. Étapes à venir en pointillé.
        </Foot>
      </section>
    ),
  },
  {
    id: "pointage",
    label: "Liste alphabétique · pointage des droits d'inscription",
    pages: (s) => Math.max(1, Math.ceil(s.players.length / 40)),
    available: (s) => s.players.length > 0,
    render: (s) => <Pointage state={s} />,
  },
  {
    id: "joueurs-poules",
    label: "Liste des joueurs par poule et billard",
    pages: (s) => Math.max(1, Math.ceil(s.players.length / 120)),
    available: drawn,
    render: (s) => <PlayersBoard state={s} />,
  },
  {
    id: "tableau-poules",
    label: "Tableau des poules du vendredi (affichage)",
    landscape: true,
    pages: () => 1,
    available: drawn,
    render: (s) => <PoulesBoard state={s} phase="PREQ" title="Poules du vendredi" day="vendredi" />,
  },
  {
    id: "premiers-matchs",
    label: "Premiers matchs par billard",
    pages: () => 1,
    available: drawn,
    render: (s) => <PremiersMatchs state={s} />,
  },
  {
    id: "feuilles-preq",
    label: "Feuilles de match des poules (A4 paysage, 2 par page)",
    landscape: true,
    pages: (s) => pouleSheetPages(s, "PREQ", "vendredi").length,
    available: drawn,
    render: (s) => <SheetPages pages={pouleSheetPages(s, "PREQ", "vendredi")} />,
  },
  {
    id: "classement-preq",
    label: "Classement des préqualifications",
    pages: (s) => Math.max(1, Math.ceil(s.players.length / 45)),
    available: preqClosed,
    render: (s) => <ClassementPreq state={s} />,
  },
  {
    id: "resultats-poules",
    label: "Résultats des poules",
    pages: (s) => Math.ceil(s.poules.PREQ.length / 6),
    available: preqClosed,
    render: (s) => (
      <ResultatsPoules state={s} phase="PREQ" title="RÉSULTATS DES POULES · PRÉQUALIFICATIONS" />
    ),
  },
  {
    id: "tableau-barrages",
    label: "Tableau des barrages",
    pages: () => 1,
    available: preqClosed,
    render: (s) => <TableauBarrages state={s} />,
  },
  {
    id: "feuilles-barrages",
    label: "Feuilles de match des barrages (2 par page)",
    landscape: true,
    pages: (s) => pairPages(barrageSheets(s)).length,
    available: preqClosed,
    render: (s) => <SheetPages pages={pairPages(barrageSheets(s))} />,
  },
  {
    id: "pointage-consolante",
    label: "Pointage des volontaires consolante",
    pages: () => 1,
    available: preqClosed,
    render: (s) => <PointageConsolante state={s} />,
  },
  {
    id: "poules-samedi",
    label: "Poules Masters et National du samedi (affichage)",
    landscape: true,
    pages: () => 2,
    available: satReady,
    render: (s) => (
      <>
        <PoulesBoard state={s} phase="QM" title="Poules Masters" day="samedi" />
        <PoulesBoard state={s} phase="QN" title="Poules National" day="samedi" />
      </>
    ),
  },
  {
    id: "feuilles-qm",
    label: "Feuilles de match Masters (2 par page)",
    landscape: true,
    pages: (s) => pouleSheetPages(s, "QM", "samedi").length,
    available: satReady,
    render: (s) => <SheetPages pages={pouleSheetPages(s, "QM", "samedi")} />,
  },
  {
    id: "feuilles-qn",
    label: "Feuilles de match National (2 par page)",
    landscape: true,
    pages: (s) => pouleSheetPages(s, "QN", "samedi").length,
    available: satReady,
    render: (s) => <SheetPages pages={pouleSheetPages(s, "QN", "samedi")} />,
  },
  {
    id: "tours-masters",
    label: "Tours de jeu Masters",
    pages: () => 1,
    available: (s) => s.poules.QM.length > 0,
    render: (s) => <ToursMasters state={s} />,
  },
  {
    id: "tableau-consolante",
    label: "Tableau de la consolante",
    pages: () => 1,
    available: (s) => s.brackets.CLS.length > 0,
    render: (s) => <BracketTable state={s} phase="CLS" title="CONSOLANTE" />,
  },
  {
    id: "tableaux-finaux",
    label: "Tableaux National et Masters",
    pages: () => 2,
    available: (s) => s.brackets.N.length > 0 || s.brackets.M.length > 0,
    render: (s) => (
      <>
        {s.brackets.M.length > 0 ? (
          <BracketTable state={s} phase="M" title="TABLEAU FINAL · MASTERS" />
        ) : null}
        {s.brackets.N.length > 0 ? (
          <BracketTable state={s} phase="N" title="TABLEAU FINAL · NATIONAL" />
        ) : null}
      </>
    ),
  },
  {
    id: "feuilles-finales",
    label: "Feuilles de match des quarts, demies et finales (2 par page)",
    landscape: true,
    pages: (s) => pairPages(finalSheets(s)).length,
    available: (s) => s.brackets.N.length > 0 || s.brackets.M.length > 0,
    render: (s) => <SheetPages pages={pairPages(finalSheets(s))} />,
  },
  {
    id: "primes",
    label: "Tableau des primes",
    pages: () => 1,
    available: (s) => s.players.length > 0 && barragesDone(s),
    render: (s) => <Primes state={s} />,
  },
];

export function docById(id: string): DocDef | undefined {
  return DOCS.find((d) => d.id === id);
}

/** Documents proposés pour une journée (et un moment de la journée). */
export function docsFor(day: Day, state: TournamentState): DocDef[] {
  const ids: DocId[] =
    day === "jeudi"
      ? ["pointage", "joueurs-poules", "tableau-poules", "premiers-matchs", "feuilles-preq"]
      : day === "vendredi"
        ? state.closed.B
          ? [
              "classement-preq",
              "resultats-poules",
              "tableau-barrages",
              "pointage-consolante",
              "poules-samedi",
              "feuilles-qm",
              "feuilles-qn",
              "tours-masters",
            ]
          : state.closed.PREQ
            ? [
                "classement-preq",
                "resultats-poules",
                "tableau-barrages",
                "feuilles-barrages",
                "pointage-consolante",
              ]
            : ["feuilles-preq", "premiers-matchs", "tableau-poules", "pointage"]
        : day === "samedi"
          ? [
              "poules-samedi",
              "feuilles-qm",
              "feuilles-qn",
              "tours-masters",
              "tableau-consolante",
              "tableaux-finaux",
              "primes",
            ]
          : ["tableaux-finaux", "feuilles-finales", "primes"];
  ids.push("schema");
  return ids.map(docById).filter((d): d is DocDef => Boolean(d) && d!.available(state));
}
