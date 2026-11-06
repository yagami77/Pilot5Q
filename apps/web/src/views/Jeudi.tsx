/** Jeudi : structure des billards, tirages, création des poules du vendredi, documents. */
import type { Billard } from "@pilot5q/domain";
import { Check, Pencil, Play, Plus, Printer, Shuffle, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { DayTasks } from "@/components/DayTasks";
import { PouleCard } from "@/components/PouleCard";
import { Serpentin } from "@/components/Serpentin";
import { PrintCenter } from "@/components/PrintCenter";
import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, PageHead, Select, Tile, cx } from "@/components/ui";
import { BillardAssignment } from "@/dj/BillardAssignment";
import { planToAssignments, proposePlan } from "@/lib/assign";
import { drawFridayPoules } from "@/lib/forfaits";
import { pouleSizes } from "@/lib/engine";
import { longDate, nice, plural } from "@/lib/format";
import { drawLaterPhaseEvents, preqPouleCount } from "@/lib/setup";
import {
  bigTables,
  clubOf,
  dayDate,
  distanceLabel,
  phaseDistance,
  pouleBillards,
  smallTables,
} from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

export function Jeudi() {
  const { state, dispatch, dispatchMany, amendBillards } = useTournament();
  const toast = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const [drawSeq, setDrawSeq] = useState(0);
  const [serpDone, setSerpDone] = useState(true);
  const [unresolved, setUnresolved] = useState<number[]>([]);

  const ro = useEditLock();
  const drawn = state.poules.PREQ.length > 0;
  const locked =
    ro ||
    Boolean(state.closed.PREQ) ||
    state.poules.PREQ.some((p) => p.matches.some((m) => m.sa !== null));
  const players = state.players;
  const juniors = players.filter((p) => p.junior).length;
  const masters = players.slice(0, state.rules.mastersPrequalified);
  const field = players.slice(state.rules.mastersPrequalified).map((p) => p.name);
  const sizes = pouleSizes(field.length, state.rules.maxPoulesOf3);
  const nb4 = sizes.filter((s) => s === 4).length;
  const nb3 = sizes.length - nb4;
  const pouleCount = preqPouleCount(state);
  const d = phaseDistance(state, "PREQ");
  const capacity = state.billards.length * 8 + 8;

  const draw = () => {
    const res = drawFridayPoules(state);
    const poules = res.poules;
    setUnresolved(res.unresolved);
    setDrawSeq((n) => n + 1);
    setSerpDone(false);
    dispatch({ type: "poules.drawn", payload: { phase: "PREQ", poules } });
    window.setTimeout(
      () =>
        document
          .getElementById("serpentin")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
    toast(
      res.unresolved.length
        ? `Tirage effectué · ${plural(res.unresolved.length, "poule")} en conflit de club`
        : "Tirage en cours…",
    );
  };

  const redraw = () => {
    if (locked) {
      toast("Des scores sont déjà saisis : le tirage est figé.");
      return;
    }
    draw();
  };

  const conflicts = useMemo(() => {
    const clubs = clubOf(state);
    return state.poules.PREQ.filter((p) => {
      const counts = new Map<string, number>();
      for (const n of p.players) counts.set(clubs[n] ?? "", (counts.get(clubs[n] ?? "") ?? 0) + 1);
      return [...counts.values()].some((v) => v >= 3);
    }).map((p) => p.num);
  }, [state]);
  const conflictSet = new Set([...conflicts, ...unresolved]);
  const totalMatches = state.poules.PREQ.reduce((n, p) => n + p.matches.length, 0);

  return (
    <section className="cascade">
      <DayTasks day="jeudi" actions={{ documents: () => setPrintOpen(true) }} />
      <PageHead
        eyebrow={`${longDate(dayDate(state, "jeudi"))} · Préparation`}
        title="Tirage des billards et création des poules"
        help={
          drawn
            ? "Les poules du vendredi sont créées. Vérifiez les billards, imprimez les documents et passez au vendredi."
            : "Les inscrits sont importés et classés. Il reste à affecter les billards et à lancer le tirage."
        }
      >
        <Chip tone="blue">{distanceLabel(d)}</Chip>
        <Chip>Convocation vendredi 10h30</Chip>
        <Button icon={Printer} onClick={() => setPrintOpen(true)}>
          Imprimer
        </Button>
      </PageHead>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile
          label="Inscrits"
          value={players.length}
          detail={
            <>
              dont {plural(juniors, "junior")} ·{" "}
              {players.length > capacity
                ? `${players.length - capacity} au-delà de la capacité`
                : `capacité ${capacity}`}
            </>
          }
        />
        <Tile
          label="Masters préqualifiés"
          value={masters.length}
          detail="Têtes de série, entrent samedi"
          tone="gold"
        />
        <Tile
          label="Poules du vendredi"
          value={pouleCount}
          detail={`${plural(nb4, "poule")} de 4${nb3 ? ` · ${plural(nb3, "poule")} de 3` : ""}`}
        />
        <Tile
          label="Billards"
          value={state.billards.length}
          detail={`${bigTables(state.billards)} × 3m10 · ${smallTables(state.billards)} × 2m80`}
          tone="blue"
        />
      </div>

      <Card
        className="mt-3.5"
        title="Têtes de série · qualifiés directs Masters"
        aside={<Chip tone="grey">Place au classement glissant</Chip>}
      >
        <ol className="grid grid-cols-2 gap-2 px-4 pt-1 pb-4 sm:grid-cols-4">
          {masters.map((p, i) => (
            <li
              key={p.licence}
              className="bg-surface-2 border-line animate-pop flex min-w-0 items-center gap-3 rounded-[12px] border py-2.5 pr-3 pl-3.5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span
                className="text-gold-ink min-w-[2ch] text-right font-mono text-[28px] leading-none font-bold tracking-[-0.04em] tabular-nums"
                aria-label={`Place ${p.place ?? "non classé"}`}
              >
                {p.place ?? "–"}
              </span>
              <Avatar name={p.name} photoUrl={p.photoUrl} size="md" />
              <span className="min-w-0 text-[13px] leading-[1.2] font-bold">{nice(p.name)}</span>
            </li>
          ))}
        </ol>
      </Card>

      <BillardStructure
        billards={state.billards}
        locked={drawn || ro}
        onChange={(billards) => {
          amendBillards(billards);
          const count = preqPouleCount(state);
          dispatchMany([
            {
              type: "billards.assigned",
              payload: {
                phase: "PREQ",
                assignments: planToAssignments(proposePlan(count, billards)),
              },
            },
            ...drawLaterPhaseEvents(billards),
          ]);
          toast("Structure enregistrée · billards retirés au sort");
        }}
      />

      <BillardAssignment pouleCount={pouleCount} locked={locked} />

      <LaterPhases />

      {!drawn && ro ? null : !drawn ? (
        <div
          id="tirage"
          className="bg-brand-cta relative mt-3.5 flex scroll-mt-4 flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[18px] px-6 py-[22px] text-white shadow-[0_24px_50px_-24px_rgb(14_55_168/0.7)]"
        >
          <span
            className="pointer-events-none absolute -top-20 -right-20 size-[260px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.22),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative min-w-0">
            <h3 className="text-[20px] font-extrabold tracking-[-0.02em]">
              Tirer les poules du vendredi
            </h3>
            <p className="mt-1 max-w-[60ch] opacity-85">
              {field.length} joueurs répartis en serpentin dans {plural(pouleCount, "poule")} selon
              la liste ordonnée des participants. Le contrôle des clubs est automatique : jamais
              trois joueurs du même club dans une poule.
            </p>
          </div>
          <Button variant="white" size="lg" icon={Play} onClick={draw} className="relative">
            Lancer le tirage
          </Button>
        </div>
      ) : (
        <div id="tirage" className="mt-4 scroll-mt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">Serpentin</div>
              <h2 className="text-[18px]">Poules du vendredi</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="grey">Têtes de poule en haut · place au classement à droite</Chip>
              {!locked ? (
                <Button size="sm" icon={Shuffle} onClick={redraw}>
                  Refaire le tirage
                </Button>
              ) : null}
            </div>
          </div>
          <Card
            id="serpentin"
            className="mb-3.5"
            title="Le serpentin du tirage"
            aside={<Chip tone="gold">TS = tête de poule</Chip>}
          >
            <Serpentin
              poules={state.poules.PREQ}
              animate={drawSeq}
              conflicts={conflictSet}
              onDone={() => setSerpDone(true)}
            />
          </Card>
          {serpDone ? (
            conflictSet.size > 0 ? (
              <Banner tone="red" icon={TriangleAlert} className="mt-0 mb-3.5">
                {plural(conflictSet.size, "poule")} avec trois joueurs du même club (
                {[...conflictSet].map((n) => `P${n}`).join(", ")}) que le décalage automatique ne
                peut pas résoudre : à signaler au responsable national.
              </Banner>
            ) : (
              <Banner
                icon={Check}
                className="mt-0 mb-3.5"
                actions={
                  <Button icon={Printer} onClick={() => setPrintOpen(true)}>
                    Imprimer listes et feuilles de match
                  </Button>
                }
              >
                {plural(state.poules.PREQ.length, "poule créée", "poules créées")} · aucune poule
                avec trois joueurs du même club · têtes de poule en première ligne ·{" "}
                {plural(totalMatches, "match")} à jouer
              </Banner>
            )
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {state.poules.PREQ.map((p) => (
              <PouleCard
                key={p.num}
                state={state}
                phase="PREQ"
                poule={p}
                distance={d}
                conflict={conflictSet.has(p.num)}
                showPlace
              />
            ))}
          </div>
        </div>
      )}

      <PrintCenter day="jeudi" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

/* ---------- Structure des billards ---------- */

function BillardStructure({
  billards,
  locked,
  onChange,
}: {
  billards: Billard[];
  locked: boolean;
  onChange: (b: Billard[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Billard[]>(billards);
  const big = bigTables(draft);
  const valid =
    draft.length >= 8 && big >= 3 && new Set(draft.map((b) => b.num)).size === draft.length;
  return (
    <Card
      id="billards"
      className="mt-3.5"
      title="Structure des billards"
      aside={
        <>
          {bigTables(billards) < 3 || billards.length < 8 ? (
            <Chip tone="red" icon={TriangleAlert}>
              Minimum 8 billards dont 3 de 3m10
            </Chip>
          ) : (
            <Chip tone="grey">
              Numérotation du club hôte · {bigTables(billards)} × 3m10 · {smallTables(billards)} ×
              2m80
            </Chip>
          )}
          {!locked ? (
            editing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setDraft(billards);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Check}
                  disabled={!valid}
                  onClick={() => {
                    onChange([...draft].sort((a, b) => a.num - b.num));
                    setEditing(false);
                  }}
                >
                  Enregistrer
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                icon={Pencil}
                onClick={() => {
                  setDraft(billards);
                  setEditing(true);
                }}
              >
                Modifier
              </Button>
            )
          ) : (
            <Chip tone="green" icon={Check}>
              Figée depuis le tirage
            </Chip>
          )}
        </>
      }
    >
      {editing ? (
        <div className="px-4 pb-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-muted text-left text-[10.5px] tracking-[0.06em] uppercase">
                <th className="py-1.5 pr-3">N° du billard</th>
                <th className="py-1.5 pr-3">Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.map((b, i) => (
                <tr key={i} className="border-line border-t">
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      min={1}
                      aria-label={`Numéro du billard ${i + 1}`}
                      className="field w-24 font-mono"
                      value={b.num}
                      onChange={(e) =>
                        setDraft(
                          draft.map((x, k) =>
                            k === i ? { ...x, num: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <Select
                      ariaLabel={`Type du billard ${b.num}`}
                      value={b.type}
                      onChange={(v) =>
                        setDraft(
                          draft.map((x, k) => (k === i ? { ...x, type: v as Billard["type"] } : x)),
                        )
                      }
                      options={[
                        { value: "3m10", label: "3m10 (grand)" },
                        { value: "2m80", label: "2m80 (petit)" },
                      ]}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      aria-label={`Retirer le billard ${b.num}`}
                      onClick={() => setDraft(draft.filter((_, k) => k !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            size="sm"
            icon={Plus}
            className="mt-2"
            onClick={() =>
              setDraft([
                ...draft,
                { num: Math.max(0, ...draft.map((b) => b.num)) + 1, type: "2m80" },
              ])
            }
          >
            Ajouter un billard
          </Button>
          {!valid ? (
            <p className="text-alert-ink mt-2 text-[12.5px] font-semibold">
              Il faut au moins 8 billards dont 3 de 3m10, avec des numéros distincts.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {billards.map((b) => (
            <span
              key={b.num}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-bold",
                b.type === "3m10"
                  ? "bg-brand-soft text-brand-ink border-transparent"
                  : "bg-surface-2 border-line text-ink-secondary",
              )}
            >
              <span className="font-mono">{b.num}</span>
              <span className="text-[10.5px] font-semibold opacity-70">{b.type}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Billards des phases suivantes ---------- */

function LaterPhases() {
  const { state, dispatch, dispatchMany } = useTournament();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const A = state.billardAssignments;
  const options = state.billards.map((b) => ({
    value: String(b.num),
    label: `B${b.num} · ${b.type}`,
  }));
  const bigOptions = options.filter(
    (o) => state.billards.find((b) => String(b.num) === o.value)?.type === "3m10",
  );
  const ro = useEditLock();
  const locked = ro || Boolean(state.closed.M && state.closed.N);
  const block = (
    title: string,
    tag: string,
    big: boolean,
    phase: "B" | "QM" | "QN" | "M" | "N",
    keys: { key: string; label: string }[],
  ) => {
    const assign = A[phase] ?? {};
    return (
      <div className="bg-surface-2 border-line flex flex-col gap-2 rounded-[12px] border p-3">
        <div className="flex items-center justify-between">
          <b className="text-[14px]">{title}</b>
          <span
            className={cx(
              "rounded-[6px] border px-[7px] py-[3px] text-[10.5px] font-bold",
              big
                ? "bg-brand-soft text-brand-ink border-transparent"
                : "bg-surface border-line-2 text-ink-muted",
            )}
          >
            {tag}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keys.map(({ key, label }) =>
            editing ? (
              <label key={key} className="flex items-center gap-1 text-[11px] font-bold">
                {label}
                <Select
                  ariaLabel={`${title} · ${label}`}
                  value={String(assign[key]?.[0] ?? "")}
                  onChange={(v) => {
                    const next = { ...assign, [key]: [Number(v)] };
                    // National : les poules croisées partagent le billard
                    if (phase === "QN") {
                      const n = Number(key);
                      next[String(9 - n)] = [Number(v)];
                    }
                    dispatch({ type: "billards.assigned", payload: { phase, assignments: next } });
                  }}
                  options={[
                    { value: "", label: "—" },
                    ...(phase === "QM" && bigOptions.length ? bigOptions : options),
                  ]}
                />
              </label>
            ) : (
              <span
                key={key}
                className="bg-surface border-line-2 text-ink-secondary rounded-full border px-2 py-[3px] text-[11px] font-bold"
              >
                {label} → {assign[key]?.[0] !== undefined ? `B${assign[key]?.[0]}` : "—"}
              </span>
            ),
          )}
        </div>
      </div>
    );
  };
  const pairs = [1, 2, 3, 4].map((i) => ({ key: String(i), label: `P${i} & P${9 - i}` }));
  return (
    <Card
      className="mt-3.5"
      title="Billards des phases suivantes"
      aside={
        <>
          <Chip tone="grey">Tirés le jeudi, modifiables jusqu'au dimanche matin</Chip>
          {!locked ? (
            <>
              <Button
                size="sm"
                icon={Pencil}
                variant={editing ? "primary" : "default"}
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
              >
                {editing ? "Terminer" : "Modifier"}
              </Button>
              <Button
                size="sm"
                icon={Shuffle}
                onClick={() => {
                  dispatchMany(drawLaterPhaseEvents(state.billards));
                  toast("Billards des barrages, du samedi et des quarts tirés au sort");
                }}
              >
                Tirer au sort
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5 px-4 pt-1 pb-4">
        {block(
          "Barrages",
          "vendredi",
          false,
          "B",
          Array.from({ length: 8 }, (_, i) => ({ key: `B${i + 1}`, label: `B${i + 1}` })),
        )}
        {block("National · poules", "samedi", false, "QN", pairs)}
        {block(
          "Masters · poules",
          "3m10",
          true,
          "QM",
          [1, 2, 3, 4].map((i) => ({ key: String(i), label: `P${i}` })),
        )}
        {block(
          "Quarts Masters",
          "dimanche · 3m10",
          true,
          "M",
          [1, 2, 3, 4].map((i) => ({ key: `M-QF${i}`, label: `Q${i}` })),
        )}
        {block(
          "Quarts National",
          "dimanche",
          false,
          "N",
          [1, 2, 3, 4].map((i) => ({ key: `N-QF${i}`, label: `Q${i}` })),
        )}
      </div>
    </Card>
  );
}

export { pouleBillards };
