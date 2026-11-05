/**
 * Documents imprimables (A4, noir sur blanc). Chaque document est une fonction de l'état
 * qui rend une ou plusieurs pages `.print-page`.
 */
import type { BracketMatch, Match, Poule, TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

import { FlowDiagram } from "@/components/FlowDiagram";

import { isValidScore, matchLabels, matchWinner } from "@/lib/engine";
import { clubShort, euros, longDate, nice, shortName } from "@/lib/format";
import { computePrizes } from "@/lib/prizes";
import {
  barragesDone,
  billardType,
  dayDate,
  distanceLabel,
  orderedMatches,
  phaseDistance,
  playerByName,
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
  const info = state.info;
  return (
    <div className="mb-2 flex items-center justify-between border-b-2 border-black pb-1.5">
      <div>
        <b className="text-[14px]">{title}</b>
        <div>
          {info ? `${info.name} · ${info.city}` : ""}
          {subtitle ? ` · ${subtitle}` : ""}
        </div>
      </div>
      {right ? (
        <div className="text-right">
          <b className="text-[13px]">{right}</b>
          {rightSub ? <div>{rightSub}</div> : null}
        </div>
      ) : null}
    </div>
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

/* ---------- Feuille de match d'une poule ---------- */

function MatchSheet({
  state,
  poule,
  phase,
  dayLabel,
}: {
  state: TournamentState;
  poule: Poule;
  phase: "PREQ" | "QN" | "QM";
  dayLabel: string;
}) {
  const d = phaseDistance(state, phase);
  const bills = pouleBillards(state, phase, poule);
  const by = playerByName(state);
  const labels = matchLabels(poule.players.length);
  const ordered = orderedMatches(poule, d);
  const title = {
    PREQ: "FEUILLE DE MATCH · PRÉQUALIFICATIONS",
    QN: "FEUILLE DE MATCH · NATIONAL",
    QM: "FEUILLE DE MATCH · MASTERS",
  }[phase];
  const multi = d.setsGagnants > 1;
  const placeholders =
    poule.players.length === 4
      ? [
          "2 – 3",
          "1 – 4",
          "Perdant M1 – Perdant M2",
          "Gagnant M1 – Gagnant M2",
          "Dernier match du 4",
          "Dernier match du 1",
        ]
      : ["2 – 3", "1 – Gagnant M1", "1 – Perdant M1"];
  return (
    <Page>
      <DocHeader
        state={state}
        title={`${title} · POULE ${poule.num}`}
        subtitle={dayLabel}
        right={`Billard ${bills.join(" & ")}`}
        rightSub={`${billardType(state, bills[0])} · ${distanceLabel(d)}`}
      />
      <table>
        <thead>
          <tr>
            <th className="w-6">#</th>
            <th>Joueur</th>
            <th>Club</th>
            <th className="w-20">Licence</th>
          </tr>
        </thead>
        <tbody>
          {poule.players.map((n, i) => (
            <tr key={n}>
              <td className="text-center font-bold">{i + 1}</td>
              <td className="font-semibold">{nice(n)}</td>
              <td>{clubShort(by.get(n)?.club ?? "")}</td>
              <td className="font-mono">{by.get(n)?.licence ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="h-2" />
      <table>
        <thead>
          <tr>
            <th className="w-8">Ordre</th>
            <th>Match</th>
            <th className="w-16">Gagnant (X)</th>
            <th className="w-28">{multi ? "Sets (points)" : "Score"}</th>
            <th className="w-28">Arbitre</th>
            <th className="w-32">Signatures</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((om, i) => {
            const known = i < 2 || isValidScore(om.match, d) || Boolean(matchWinner(om.match, d));
            const fixed = poule.players.length === 3 ? i < 1 : i < 2;
            return (
              <tr key={om.match.id} className="h-10">
                <td className="text-center">
                  <b>{i + 1}</b>
                  <div className="text-[8.5px] text-[#555]">{labels[i]}</div>
                </td>
                <td>
                  {fixed || known ? (
                    <>
                      {shortName(om.match.a)}
                      <br />
                      {shortName(om.match.b)}
                    </>
                  ) : (
                    <span className="text-[#555]">{placeholders[i]}</span>
                  )}
                </td>
                <td className="text-center text-[13px] leading-[1.6]">
                  {BOX}
                  <br />
                  {BOX}
                </td>
                <td className="font-mono">{scoreText(om.match, multi)}</td>
                <td>{(fixed || known) && om.arbitre ? shortName(om.arbitre) : ""}</td>
                <td />
              </tr>
            );
          })}
        </tbody>
      </table>
      <Foot>
        Ordre des matchs : {labels.join(", ").toLowerCase()}. Les joueurs qui ne jouent pas
        arbitrent. Les deux joueurs vérifient et paraphent la feuille à la fin du match.
        {multi
          ? " Noter les points de chaque set."
          : " Un match valide : un joueur à " + d.pointsParSet + ", l'autre en dessous."}
      </Foot>
    </Page>
  );
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

function JoueursPoules({ state }: { state: TournamentState }) {
  const masters = new Set(state.masters);
  const pouleOf = pouleOfMap(state, "PREQ");
  const list = [...state.players].sort((a, b) => sortFr(a.name, b.name));
  return (
    <Page>
      <DocHeader
        state={state}
        title="LISTE DES JOUEURS · POULE ET BILLARD"
        subtitle={`${longDate(dayDate(state, "vendredi"), true)} · convocation 10h30`}
        right={`${list.length} joueurs`}
      />
      <div className="columns-2 gap-4">
        <table>
          <thead>
            <tr>
              <th>Joueur</th>
              <th className="w-12">Poule</th>
              <th className="w-14">Billard</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const po = pouleOf.get(p.name);
              return (
                <tr key={p.licence}>
                  <td className="font-semibold">{nice(p.name)}</td>
                  <td className="text-center">{masters.has(p.name) ? "M" : (po?.num ?? "—")}</td>
                  <td className="text-center">
                    {po
                      ? pouleBillards(state, "PREQ", po).join(" & ")
                      : masters.has(p.name)
                        ? "samedi"
                        : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Foot>M : Masters préqualifié, entre en lice le samedi.</Foot>
    </Page>
  );
}

function TableauPoules({
  state,
  phase,
  title,
  day,
}: {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  title: string;
  day: Day;
}) {
  const d = phaseDistance(state, phase);
  return (
    <Page>
      <DocHeader
        state={state}
        title={title}
        subtitle={longDate(dayDate(state, day), true)}
        right={distanceLabel(d)}
      />
      <div className="grid grid-cols-3 gap-2">
        {state.poules[phase].map((p) => {
          const bills = pouleBillards(state, phase, p);
          return (
            <table key={p.num}>
              <thead>
                <tr>
                  <th colSpan={2}>
                    Poule {p.num} · Billard {bills.join(" & ")} ({billardType(state, bills[0])})
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.players.map((n, i) => (
                  <tr key={n}>
                    <td className="w-5 text-center">{i + 1}</td>
                    <td>
                      <b>{nice(n)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
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

function FeuillesBarrages({ state }: { state: TournamentState }) {
  const d = state.rules.distances.barrage;
  return (
    <Page>
      <DocHeader
        state={state}
        title="FEUILLES DE MATCH · BARRAGES"
        subtitle={longDate(dayDate(state, "vendredi"), true)}
        right={distanceLabel(d)}
      />
      <table>
        <thead>
          <tr>
            <th className="w-10">Match</th>
            <th className="w-14">Billard</th>
            <th>Joueurs</th>
            <th className="w-16">Gagnant (X)</th>
            <th className="w-24">Score</th>
            <th className="w-28">Arbitre</th>
            <th className="w-32">Signatures</th>
          </tr>
        </thead>
        <tbody>
          {state.barrages.map((m) => (
            <tr key={m.id} className="h-12">
              <td className="font-bold">{m.id}</td>
              <td className="text-center">{m.billard ?? "—"}</td>
              <td>
                {nice(m.a)}
                <br />
                {nice(m.b)}
              </td>
              <td className="text-center text-[13px] leading-[1.6]">
                {BOX}
                <br />
                {BOX}
              </td>
              <td className="font-mono">{scoreText(m, false)}</td>
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <Foot>Arbitrage assuré par le club hôte. Les deux joueurs paraphent la feuille.</Foot>
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

function FeuillesFinales({ state }: { state: TournamentState }) {
  const sheets: { phase: "N" | "M"; m: BracketMatch }[] = [];
  for (const phase of ["M", "N"] as const)
    for (const m of state.brackets[phase]) if (m.round !== "R16") sheets.push({ phase, m });
  return (
    <>
      {sheets.map(({ phase, m }) => {
        const d = phaseDistance(state, phase, m.round);
        const sets = 2 * d.setsGagnants - 1;
        return (
          <Page key={`${phase}-${m.id}`}>
            <DocHeader
              state={state}
              title={`FEUILLE DE MATCH · ${phase === "M" ? "MASTERS" : "NATIONAL"} · ${roundLabel(m.round).toUpperCase()} ${m.slot}`}
              subtitle={longDate(dayDate(state, "dimanche"), true)}
              right={m.billard ? `Billard ${m.billard}` : "Billard à définir"}
              rightSub={distanceLabel(d)}
            />
            <table>
              <thead>
                <tr>
                  <th>Joueur</th>
                  {Array.from({ length: sets }, (_, i) => (
                    <th key={i} className="w-12 text-center">
                      Set {i + 1}
                    </th>
                  ))}
                  <th className="w-12 text-center">Sets</th>
                  <th className="w-24">Signature</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { n: m.a, label: m.labelA ?? "", s: m.setsA },
                    { n: m.b, label: m.labelB ?? "", s: m.setsB },
                  ] as { n: string; label: string; s: number[] | undefined }[]
                ).map(({ n, label, s }, i) => (
                  <tr key={i} className="h-10">
                    <td className="font-semibold">
                      {n ? nice(n) : <span className="text-[#555]">{label}</span>}
                    </td>
                    {Array.from({ length: sets }, (_, k) => (
                      <td key={k} className="text-center font-mono">
                        {s?.[k] ?? ""}
                      </td>
                    ))}
                    <td className="text-center font-mono">
                      {i === 0 ? (m.sa ?? "") : (m.sb ?? "")}
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="mt-2">
              <tbody>
                <tr className="h-9">
                  <td className="w-40 font-bold">Arbitre (nom et licence)</td>
                  <td className="font-mono">{m.arbitre ?? ""}</td>
                  <td className="w-40 font-bold">Heure de début</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <Foot>Pause de 30 minutes minimum entre deux paliers pour un même joueur.</Foot>
          </Page>
        );
      })}
    </>
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
    pages: (s) => Math.max(1, Math.ceil(s.players.length / 45)),
    available: drawn,
    render: (s) => <JoueursPoules state={s} />,
  },
  {
    id: "tableau-poules",
    label: "Tableau des poules du vendredi",
    pages: () => 1,
    available: drawn,
    render: (s) => (
      <TableauPoules state={s} phase="PREQ" title="POULES DU VENDREDI" day="vendredi" />
    ),
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
    label: "Feuilles de match des poules",
    pages: (s) => s.poules.PREQ.length,
    available: drawn,
    render: (s) => (
      <>
        {s.poules.PREQ.map((p) => (
          <MatchSheet
            key={p.num}
            state={s}
            poule={p}
            phase="PREQ"
            dayLabel={longDate(dayDate(s, "vendredi"), true)}
          />
        ))}
      </>
    ),
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
    label: "Feuilles de match des barrages",
    pages: () => 1,
    available: preqClosed,
    render: (s) => <FeuillesBarrages state={s} />,
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
    label: "Poules Masters et National du samedi",
    pages: () => 2,
    available: satReady,
    render: (s) => (
      <>
        <TableauPoules state={s} phase="QM" title="POULES MASTERS" day="samedi" />
        <TableauPoules state={s} phase="QN" title="POULES NATIONAL" day="samedi" />
      </>
    ),
  },
  {
    id: "feuilles-qm",
    label: "Feuilles de match Masters",
    pages: (s) => s.poules.QM.length,
    available: satReady,
    render: (s) => (
      <>
        {s.poules.QM.map((p) => (
          <MatchSheet
            key={p.num}
            state={s}
            poule={p}
            phase="QM"
            dayLabel={longDate(dayDate(s, "samedi"), true)}
          />
        ))}
      </>
    ),
  },
  {
    id: "feuilles-qn",
    label: "Feuilles de match National",
    pages: (s) => s.poules.QN.length,
    available: satReady,
    render: (s) => (
      <>
        {s.poules.QN.map((p) => (
          <MatchSheet
            key={p.num}
            state={s}
            poule={p}
            phase="QN"
            dayLabel={longDate(dayDate(s, "samedi"), true)}
          />
        ))}
      </>
    ),
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
    label: "Feuilles de match des quarts, demies et finales",
    pages: (s) =>
      s.brackets.N.filter((m) => m.round !== "R16").length +
      s.brackets.M.filter((m) => m.round !== "R16").length,
    available: (s) => s.brackets.N.length > 0 || s.brackets.M.length > 0,
    render: (s) => <FeuillesFinales state={s} />,
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
