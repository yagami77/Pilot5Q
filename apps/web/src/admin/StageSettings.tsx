/**
 * Paramètres propres à une étape : contrôle de la consolante (au moins 5 billards 2m80, SPEC §5
 * et §8), nombre d'U21 enregistré avec le TN, horaires de convocation et canevas du mail qui
 * surchargent ceux de la saison.
 */
import type { Player, Stage, StageConvocation } from "@pilot5q/domain";
import { consolanteCheck, convocationTime, stageSettings } from "@pilot5q/domain";
import { Check, Clock, Medal, RotateCcw, Users, X } from "lucide-react";
import { motion } from "motion/react";

import { Button, Chip, cx } from "@/components/ui";

import { useSeason, useSeasonDoc } from "./store";
import { Field, Input, TextArea } from "./ui";

const TIMES: { key: keyof StageConvocation; label: string; hint: string }[] = [
  { key: "convocationFriday", label: "Vendredi", hint: "préqualifications" },
  { key: "convocationWeekend", label: "Samedi et dimanche", hint: "4 billards 3m10 ou plus" },
  {
    key: "convocationWeekendThreeBig",
    label: "Samedi et dimanche, 3 × 3m10",
    hint: "quand le club n'a que 3 billards 3m10",
  },
];

export function StageSettingsSection({ stage, accepted }: { stage: Stage; accepted: Player[] }) {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const season = doc.settings;
  const effective = stageSettings(season, stage);
  const overrides = stage.convocation ?? {};
  const locked = Boolean(stage.closedAt);
  const cons = consolanteCheck(stage, season);
  // Valeur en direct ; `stage.juniorCount` en garde la trace à chaque modification des inscrits.
  const juniors = accepted.filter((p) => p.junior).length;
  const payers = Math.max(0, accepted.length - juniors);
  const pot = payers * season.inscriptionFee + season.ffbShare + season.clubShare;

  const setOverride = (patch: StageConvocation) =>
    update((d) => ({
      ...d,
      stages: d.stages.map((s) => {
        if (s.id !== stage.id) return s;
        const next: StageConvocation = { ...(s.convocation ?? {}), ...patch };
        for (const k of Object.keys(next) as (keyof StageConvocation)[]) {
          if (next[k] === undefined || next[k] === "") delete next[k];
        }
        return { ...s, convocation: Object.keys(next).length > 0 ? next : null };
      }),
    }));
  const overridden = Object.keys(overrides).length;
  const bigUsed = convocationTime("samedi", stage.big, effective);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-4">
        <div
          className={cx(
            "rounded-[14px] border p-4",
            cons.possible ? "border-ok/30 bg-ok-soft/50" : "border-alert/30 bg-alert-soft/50",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "grid size-7 place-items-center rounded-full text-white",
                cons.possible ? "bg-ok" : "bg-alert",
              )}
            >
              {cons.possible ? (
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
              ) : (
                <X className="size-4" strokeWidth={3} aria-hidden="true" />
              )}
            </span>
            <b className="text-[14px]">
              {cons.possible ? "Consolante possible" : "Pas de consolante"}
            </b>
            <Chip tone="grey" className="ml-auto">
              règle : {cons.min} billards 2m80 minimum
            </Chip>
          </div>
          <div
            className="mt-3 flex flex-wrap items-end gap-1.5"
            aria-label={`${cons.small} billards 2m80`}
          >
            {Array.from({ length: Math.max(cons.small, cons.min) }, (_, i) => {
              const present = i < cons.small;
              return (
                <motion.span
                  key={i}
                  initial={{ scaleY: 0.2, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 22 }}
                  className={cx(
                    "grid h-10 w-7 origin-bottom place-items-center rounded-[6px] border font-mono text-[10px] font-bold",
                    present
                      ? i < cons.min
                        ? "bg-ok border-ok text-white"
                        : "bg-ok/70 border-ok/70 text-white"
                      : "border-alert/60 text-alert-ink border-dashed bg-white",
                  )}
                  title={present ? `Billard 2m80 n° ${i + 1}` : "Billard 2m80 manquant"}
                >
                  {present ? i + 1 : "?"}
                </motion.span>
              );
            })}
            <span className="text-ink-muted ml-2 text-[12px]">
              {cons.small} × 2m80 · {stage.big} × 3m10
            </span>
          </div>
          <p className="mt-3 text-[12.5px]">{cons.reason}</p>
          <p className="text-ink-muted mt-1 text-[12px]">
            SPEC §5 : la consolante (volontaires éliminés, élimination directe, 1 set à 100) se joue
            sur les petits billards pendant les phases finales ; il en faut au moins {cons.min}. Le
            cockpit du DJ applique la règle avec les billards déclarés le jeudi.
          </p>
        </div>

        <div className="border-line rounded-[14px] border p-4">
          <div className="flex items-center gap-2">
            <Users className="text-gold-ink size-4" aria-hidden="true" />
            <b className="text-[14px]">Juniors (U21) enregistrés avec le TN</b>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-6">
            <div>
              <div className="text-gold-ink font-mono text-[30px] leading-none font-extrabold tabular-nums">
                {juniors}
              </div>
              <div className="text-ink-muted text-[12px]">U21 exemptés du droit</div>
            </div>
            <div>
              <div className="font-mono text-[20px] leading-none font-bold tabular-nums">
                {payers} × {season.inscriptionFee} €
              </div>
              <div className="text-ink-muted text-[12px]">droits d'inscription</div>
            </div>
            <div>
              <div className="text-brand flex items-center gap-1 font-mono text-[20px] leading-none font-bold tabular-nums">
                <Medal className="size-4" aria-hidden="true" />
                {pot.toLocaleString("fr-FR")} €
              </div>
              <div className="text-ink-muted text-[12px]">
                cagnotte des primes (+ {season.ffbShare} € FFB, {season.clubShare} € club)
              </div>
            </div>
          </div>
          <p className="text-ink-muted mt-2 text-[12px]">
            Mis à jour à chaque drapeau U21 coché dans la liste ordonnée et transmis au tournoi du
            DJ (feuille de pointage, primes).
          </p>
        </div>
      </div>

      <div className="border-line rounded-[14px] border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="text-brand size-4" aria-hidden="true" />
          <b className="text-[14px]">Horaires de convocation et canevas de ce TN</b>
          {overridden > 0 ? (
            <Chip tone="blue" className="ml-auto">
              {overridden} valeur{overridden > 1 ? "s" : ""} propre{overridden > 1 ? "s" : ""} à ce
              TN
            </Chip>
          ) : (
            <Chip tone="grey" className="ml-auto">
              valeurs de la saison
            </Chip>
          )}
        </div>
        <p className="text-ink-muted mt-1 text-[12px]">
          Laisser vide pour reprendre la valeur de la saison (Paramètres). Ce TN :{" "}
          {stage.big <= 3 ? "3 billards 3m10, " : ""}samedi et dimanche à {bigUsed}.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TIMES.map((t) => (
            <Field
              key={t.key}
              label={t.label}
              hint={
                overrides[t.key] ? (
                  <span className="text-brand-ink font-semibold">
                    propre à ce TN · saison : {season[t.key as keyof typeof season] as string}
                  </span>
                ) : (
                  `saison : ${season[t.key as keyof typeof season] as string} · ${t.hint}`
                )
              }
            >
              <Input
                type="time"
                disabled={locked}
                value={overrides[t.key] ?? ""}
                placeholder={season[t.key as keyof typeof season] as string}
                onChange={(e) => setOverride({ [t.key]: e.target.value })}
                className={cx(!overrides[t.key] && "text-ink-muted")}
                aria-label={`${t.label} (saison : ${season[t.key as keyof typeof season] as string})`}
              />
            </Field>
          ))}
        </div>
        <div className="mt-3">
          <Field
            label="Canevas du mail de convocation"
            hint="Variables : {{prenom}} {{nom}} {{club}} {{tournoi}} {{lieu}} {{adresse}} {{dates}} {{heure}} {{poule}} {{billard}} {{url}}"
          >
            <TextArea
              disabled={locked}
              value={overrides.mailTemplate ?? effective.mailTemplate}
              onChange={(e) =>
                setOverride({
                  mailTemplate: e.target.value === season.mailTemplate ? "" : e.target.value,
                })
              }
              className="min-h-[180px]"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            icon={RotateCcw}
            disabled={locked || overridden === 0}
            onClick={() =>
              update((d) => ({
                ...d,
                stages: d.stages.map((s) => (s.id === stage.id ? { ...s, convocation: null } : s)),
              }))
            }
          >
            Revenir aux valeurs de la saison
          </Button>
          <span className="text-ink-muted text-[12px]">
            Les convocations (étape 3) utilisent aussitôt ces valeurs.
          </span>
        </div>
      </div>
    </div>
  );
}
