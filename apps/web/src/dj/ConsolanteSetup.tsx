/**
 * Création de la consolante (SPEC §5) : volontaires cochés parmi les éliminés du vendredi, dans
 * l'ordre du classement de sortie des poules, puis « Créer la consolante ». Proposée le vendredi
 * soir sous les qualifiés et, si elle n'a pas été créée, directement sur la page du samedi.
 */
import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import { Button, PlayerLine, cx } from "@/components/ui";
import { nice, plural } from "@/lib/format";
import { consolanteAllowed, qualifiers } from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

export function ConsolanteSetup({
  wide = false,
  onCreated,
}: {
  /** Liste sur plusieurs colonnes (page du samedi) au lieu d'une colonne défilante. */
  wide?: boolean;
  onCreated?: () => void;
}) {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const ro = useEditLock();
  const eligible = useMemo(() => qualifiers(state).consolante, [state]);
  const [volunteers, setVolunteers] = useState<Set<string>>(() => new Set(eligible));
  const allowed = consolanteAllowed(state);
  const created = state.brackets.CLS.length > 0;
  const max = state.rules.consolanteMax;
  const frozen = created || !allowed || ro;
  const chosen = eligible.filter((n) => volunteers.has(n));

  const create = () => {
    const players = chosen.slice(0, max);
    if (players.length < 2) {
      toast("Il faut au moins deux volontaires");
      return;
    }
    dispatch({ type: "consolante.created", payload: { players } });
    toast(`Consolante créée · ${plural(players.length, "joueur")}`);
    onCreated?.();
  };

  return (
    <>
      <div
        className={cx(
          "px-2.5 py-2",
          wide
            ? "grid gap-x-4 gap-y-[3px] sm:grid-cols-2 xl:grid-cols-3"
            : "flex max-h-[420px] flex-col gap-[3px] overflow-auto",
        )}
      >
        {eligible.map((n, i) => (
          <div
            key={n}
            className="animate-slide-in"
            style={{ animationDelay: `${Math.min(i, 30) * 35}ms` }}
          >
            <PlayerLine
              name={n}
              num={i + 1}
              className="rounded-[8px] px-1 py-[3px]"
              trailing={
                <input
                  type="checkbox"
                  className="accent-brand ml-auto"
                  aria-label={`${nice(n)} souhaite jouer la consolante`}
                  checked={volunteers.has(n)}
                  disabled={frozen}
                  onChange={(e) => {
                    const next = new Set(volunteers);
                    if (e.target.checked) next.add(n);
                    else next.delete(n);
                    setVolunteers(next);
                  }}
                />
              }
            />
          </div>
        ))}
      </div>
      <div className="border-line flex flex-wrap items-center gap-2 border-t px-3.5 py-2.5">
        <span className="text-ink-muted text-[12px]">
          {created
            ? `Tableau créé · ${plural(new Set(state.brackets.CLS.flatMap((m) => [m.a, m.b]).filter(Boolean)).size, "joueur")}`
            : `${plural(chosen.length, "volontaire coché", "volontaires cochés")}${chosen.length > max ? ` · les ${max} premiers sont retenus` : ""}`}
        </span>
        {!frozen ? (
          <Button size="sm" variant="primary" icon={Check} className="ml-auto" onClick={create}>
            Créer la consolante
          </Button>
        ) : null}
      </div>
    </>
  );
}
