/**
 * Forfaits de dernière minute (vendredi, avant les préqualifications) : recherche d'un joueur,
 * aperçu de l'impact avant validation (SPEC §4), nouveau tirage si une poule tombe à 2 joueurs.
 * Chaque forfait crée aussi une notification locale.
 */
import { AlertTriangle, Check, Search, Shuffle, UserX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useToast } from "@/components/Toast";
import { Button, Card, Chip, NumBadge, cx } from "@/components/ui";
import { useDjMeta } from "@/lib/djMeta";
import { forfaitsOf } from "@/lib/engine";
import { drawFridayPoules, forfaitImpact, fridayPlayers } from "@/lib/forfaits";
import { nice, plural } from "@/lib/format";
import { useNotifications } from "@/lib/notifications";
import { useTournament } from "@/store/tournament";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function LateForfaits({ readOnly = false }: { readOnly?: boolean }) {
  const { state, id, dispatch, dispatchMany } = useTournament();
  const toast = useToast();
  const navigate = useNavigate();
  const notifications = useNotifications(id);
  const [meta, updateMeta] = useDjMeta(id);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const players = useMemo(() => fridayPlayers(state), [state]);
  const declared = forfaitsOf(state, "PREQ");
  const checked = Boolean(meta.forfaitsChecked.vendredi);
  const q = fold(query.trim());
  const list = q ? players.filter((p) => fold(p.name).includes(q)) : players;
  const impact = selected ? forfaitImpact(state, selected) : null;

  const notify = (player: string, impactText: string) =>
    void notifications.add({
      kind: "forfait",
      title: `Forfait de ${nice(player)}`,
      body: "Forfait de dernière minute déclaré par le directeur de jeu, avant les préqualifications.",
      impact: impactText,
    });

  const confirm = () => {
    if (!impact || !selected) return;
    if (impact.kind === "poule3") {
      dispatch({
        type: "forfait.declared",
        payload: { phase: "PREQ", player: selected, kind: "forfait" },
      });
      notify(selected, `Poule ${impact.poule} passe à 3 joueurs`);
      toast(`${nice(selected)} forfait · poule ${impact.poule} à 3 joueurs`);
    } else if (impact.kind === "retirage") {
      let poules;
      try {
        poules = drawFridayPoules(state, [selected]).poules;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Nouveau tirage impossible");
        return;
      }
      const before = state.poules.PREQ.length;
      dispatchMany([
        {
          type: "forfait.declared",
          payload: { phase: "PREQ", player: selected, kind: "forfait" },
        },
        { type: "poules.drawn", payload: { phase: "PREQ", poules } },
      ]);
      const changed = poules.length !== before;
      notify(
        selected,
        `Poule ${impact.poule} à 2 joueurs : nouveau tirage (${plural(poules.length, "poule")})${
          changed ? " · affectation des billards à revoir" : ""
        }`,
      );
      toast(
        changed
          ? `Nouveau tirage : ${poules.length} poules au lieu de ${before} · revoyez les billards`
          : "Nouveau tirage effectué sans le joueur forfait",
      );
    }
    setSelected(null);
    setQuery("");
  };

  return (
    <Card
      id="forfaits"
      className="mb-3.5"
      title="Forfaits de dernière minute"
      aside={
        <>
          {declared.length ? (
            <Chip tone="red" icon={UserX}>
              {plural(declared.length, "forfait")}
            </Chip>
          ) : null}
          {checked ? (
            <Chip tone="green" icon={Check}>
              Vérifiés
            </Chip>
          ) : !readOnly ? (
            <Button
              size="sm"
              icon={Check}
              onClick={() =>
                void updateMeta((m) => ({
                  ...m,
                  forfaitsChecked: { ...m.forfaitsChecked, vendredi: new Date().toISOString() },
                }))
              }
            >
              {declared.length ? "Pas d'autre forfait" : "Aucun forfait"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <label className="border-line-2 bg-surface focus-within:border-brand-light flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5">
            <Search className="text-ink-muted size-4" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher parmi ${players.length} joueurs du vendredi`}
              aria-label="Rechercher un joueur du vendredi"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              disabled={readOnly}
            />
          </label>
          <div className="mt-2 grid max-h-[220px] grid-cols-1 gap-[2px] overflow-auto pr-1 sm:grid-cols-2">
            {list.slice(0, 80).map((p) => (
              <button
                key={p.name}
                type="button"
                disabled={readOnly}
                onClick={() => setSelected(selected === p.name ? null : p.name)}
                className={cx(
                  "flex items-center gap-2 rounded-[8px] px-2 py-[5px] text-left text-[12.5px] transition-colors",
                  selected === p.name
                    ? "bg-alert-soft text-alert-ink"
                    : "hover:bg-surface-2 text-ink",
                )}
              >
                <NumBadge n={p.num} />
                <span className="min-w-0 flex-1 truncate font-semibold">{nice(p.name)}</span>
                <span className="text-ink-muted font-mono text-[11px]">P{p.poule.num}</span>
              </button>
            ))}
            {list.length === 0 ? (
              <span className="text-ink-muted px-2 py-2 text-[12.5px]">Aucun joueur trouvé.</span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {impact && selected ? (
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                className={cx(
                  "rounded-[12px] border p-3.5",
                  impact.kind === "retirage"
                    ? "border-[#f5bfc9] bg-alert-soft/60"
                    : "border-[#f2d48a] bg-gold-soft/60",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cx(
                      "grid size-7 shrink-0 place-items-center rounded-full text-white",
                      impact.kind === "retirage" ? "bg-alert" : "bg-gold",
                    )}
                  >
                    {impact.kind === "retirage" ? (
                      <Shuffle className="size-4" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold tracking-[0.06em] uppercase opacity-70">
                      Impact avant validation
                    </div>
                    <div className="text-[14px] font-extrabold">Forfait de {nice(selected)}</div>
                    <p className="mt-0.5 text-[13px] font-semibold">{impact.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Annuler la sélection"
                    className="text-ink-muted ml-auto grid size-6 place-items-center rounded-[6px]"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {impact.poule !== null ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="text-ink-muted font-semibold">Poule {impact.poule} :</span>
                    {state.poules.PREQ.find((p) => p.num === impact.poule)?.players.map((n) => (
                      <span
                        key={n}
                        className={cx(
                          "rounded-[7px] border px-1.5 py-[2px] font-semibold",
                          n === selected || declared.includes(n)
                            ? "border-alert/40 text-alert-ink bg-white line-through"
                            : "border-line-2 bg-white",
                        )}
                      >
                        {nice(n)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {impact.kind === "retirage" ? (
                  <p className="text-alert-ink mt-2 text-[12.5px]">
                    Le serpentin sera refait sans les joueurs forfait
                    {impact.newPouleCount !== undefined
                      ? ` : ${plural(impact.newPouleCount, "poule")}`
                      : ""}
                    .
                    {impact.pouleCountChanges
                      ? " Le nombre de poules change : il faudra revoir l'affectation des billards."
                      : " Le nombre de poules ne change pas."}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setSelected(null)}>
                    Annuler
                  </Button>
                  {impact.kind === "poule3" || impact.kind === "retirage" ? (
                    <Button
                      size="sm"
                      variant={impact.kind === "retirage" ? "danger" : "primary"}
                      icon={impact.kind === "retirage" ? Shuffle : UserX}
                      onClick={confirm}
                    >
                      {impact.kind === "retirage"
                        ? "Valider et refaire le tirage"
                        : "Valider le forfait"}
                    </Button>
                  ) : null}
                  {impact.kind === "retirage" && impact.pouleCountChanges ? (
                    <Button size="sm" variant="ghost" onClick={() => navigate("/tournoi/jeudi")}>
                      Voir les billards
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border-line-2 text-ink-muted grid h-full min-h-[120px] place-items-center rounded-[12px] border border-dashed p-4 text-center text-[12.5px]"
              >
                <span>
                  Sélectionnez un joueur absent pour voir l'impact avant de valider.
                  <br />
                  Poule de 4 → poule de 3 ; poule à 2 joueurs → nouveau tirage.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {declared.length ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-ink-muted font-semibold">Déjà forfait :</span>
              {declared.map((n) => (
                <Chip key={n} tone="red">
                  {nice(n)}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
