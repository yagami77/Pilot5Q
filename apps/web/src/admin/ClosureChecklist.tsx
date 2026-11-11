/**
 * Liste de contrôle de la clôture (4 étapes, dans l'ordre du travail du responsable) :
 * classement glissant finalisé et son PDF, `RANKING.json` pour l'application 5 Quilles, PDF
 * récapitulatif du tournoi, envoi des deux PDF au secrétariat. Chaque étape faite est cochée
 * et datée ; l'état est enregistré avec la clôture.
 */
import { rankingRows, type Stage, type TournamentState } from "@pilot5q/domain";
import {
  Check,
  Copy,
  FileBraces,
  FileDown,
  FileText,
  Mail,
  Printer,
  Trophy,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { useToast } from "@/components/Toast";
import { Button, Chip, cx } from "@/components/ui";

import { downloadBlob } from "./attachments";
import {
  CLOSURE_STEPS,
  SECRETARIAT_EMAIL,
  closureDone,
  rankingJsonFile,
  secretariatMail,
  type ClosureStep,
} from "./closureDocs";
import type { StageClosure } from "./persistence";
import { rankingFileName, rankingPdf } from "./rankingPdf";
import { useSeason, useSeasonDoc } from "./store";
import { tournamentFileName, tournamentPdf } from "./tournamentPdf";
import { copyText, frDateTime } from "./ui";

export function ClosureChecklist({
  stage,
  closure,
  state,
  cockpitCurrent,
}: {
  stage: Stage;
  closure: StageClosure;
  /** Tournoi rejoué depuis le journal (null : journal absent de ce navigateur). */
  state: TournamentState | null;
  /** Le cockpit de ce navigateur affiche ce tournoi. */
  cockpitCurrent: boolean;
}) {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<ClosureStep | null>(null);
  const last = useMemo(() => ({ season: stage.season, tn: stage.number }), [stage]);
  // Classement à l'issue de ce TN (et non le classement courant, si d'autres TN ont suivi).
  const rows = useMemo(() => rankingRows(doc.ranking, { stage: last }), [doc.ranking, last]);
  const checklist = closure.checklist;
  const done = closureDone(checklist);
  const files = [rankingFileName(last), tournamentFileName(stage)];
  const mail = secretariatMail(stage, closure.awards, rows.length, files);

  const mark = (step: ClosureStep) => {
    const now = new Date().toISOString();
    update((d) => {
      const c = d.closures[stage.id];
      if (!c) return d;
      return {
        ...d,
        closures: {
          ...d.closures,
          [stage.id]: { ...c, checklist: { ...c.checklist, [step]: now } },
        },
      };
    });
  };
  const run = (step: ClosureStep, job: () => Promise<void>) => {
    setBusy(step);
    void job()
      .then(() => mark(step))
      .catch(() => toast("Fichier impossible à générer dans ce navigateur"))
      .finally(() => setBusy(null));
  };

  const steps: Record<
    ClosureStep,
    { icon: LucideIcon; title: string; text: ReactNode; action: ReactNode }
  > = {
    rankingPdf: {
      icon: Trophy,
      title: "Classement glissant finalisé",
      text: (
        <>
          Les points de ce TN sont intégrés : {rows.length} joueurs classés après le {stage.name}{" "}
          {stage.season}. Générez son PDF, à joindre au message du secrétariat.{" "}
          <Link to="/responsable/classement" className="text-brand font-semibold underline">
            Voir le classement
          </Link>
        </>
      ),
      action: (
        <Button
          variant={checklist?.rankingPdf ? "default" : "primary"}
          icon={FileDown}
          disabled={busy === "rankingPdf"}
          onClick={() =>
            run("rankingPdf", async () =>
              downloadBlob(rankingFileName(last), await rankingPdf(rows, last)),
            )
          }
        >
          {busy === "rankingPdf" ? "Préparation…" : "Classement glissant (PDF)"}
        </Button>
      ),
    },
    rankingJson: {
      icon: FileBraces,
      title: "RANKING.json pour l'application 5 Quilles",
      text: (
        <>
          Le fichier que l'application lit pour afficher le classement. Téléchargez-le puis
          déposez-le vous-même sur le FTP, à la place du précédent : Pilot5Q ne se connecte pas au
          FTP.
        </>
      ),
      action: (
        <Button
          variant={checklist?.rankingJson ? "default" : "primary"}
          icon={FileDown}
          onClick={() => {
            const file = rankingJsonFile(rows, last);
            downloadBlob(file.name, file.blob);
            mark("rankingJson");
          }}
        >
          Télécharger RANKING.json
        </Button>
      ),
    },
    recapPdf: {
      icon: FileText,
      title: "PDF récapitulatif du tournoi",
      text: state ? (
        <>
          Toutes les informations du tournoi : classement final et points attribués, poules du
          vendredi, barrages, qualifications, tableaux finaux, consolante et primes.
        </>
      ) : (
        <>
          Le journal du tournoi n'est pas dans ce navigateur : le récapitulatif se génère depuis
          l'ordinateur où le tournoi a été joué.
        </>
      ),
      action: (
        <Button
          variant={checklist?.recapPdf ? "default" : "primary"}
          icon={FileDown}
          disabled={!state || busy === "recapPdf"}
          onClick={() => {
            if (!state) return;
            run("recapPdf", async () =>
              downloadBlob(
                tournamentFileName(stage),
                await tournamentPdf({
                  stage,
                  clubName: doc.clubs.find((c) => c.id === stage.clubId)?.name ?? "",
                  djName: stage.dj?.name,
                  state,
                  awards: closure.awards,
                }),
              ),
            );
          }}
        >
          {busy === "recapPdf" ? "Préparation…" : "Récapitulatif du tournoi (PDF)"}
        </Button>
      ),
    },
    secretariat: {
      icon: Mail,
      title: "Envoi au secrétariat",
      text: (
        <>
          Message pré-rempli pour {SECRETARIAT_EMAIL}. Sans serveur, l'application ne peut pas
          joindre les fichiers : ajoutez vous-même les deux PDF au message.
        </>
      ),
      action: (
        <>
          <a
            href={mail.href}
            onClick={() => mark("secretariat")}
            // Mêmes styles que <Button> : un lien, pour que le navigateur ouvre la messagerie.
            className={cx(
              "inline-flex items-center justify-center gap-2 rounded-[12px] border px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-[transform,box-shadow] duration-150 hover:-translate-y-px active:scale-[0.98]",
              checklist?.secretariat
                ? "bg-surface border-line-2 text-ink hover:shadow-card"
                : "border-transparent bg-[linear-gradient(180deg,#1e4fd8,#0e37a8)] text-white shadow-[0_8px_20px_-8px_rgb(14_55_168/0.6)] hover:shadow-[0_12px_26px_-8px_rgb(14_55_168/0.7)]",
            )}
          >
            <Mail className="size-4" aria-hidden="true" />
            Envoyer au secrétariat
          </a>
          <Button
            variant="ghost"
            icon={Copy}
            onClick={async () =>
              toast(
                (await copyText(`${mail.subject}\n\n${mail.body}`))
                  ? "Objet et texte copiés"
                  : "Copie impossible dans ce navigateur",
              )
            }
          >
            Copier le texte
          </Button>
        </>
      ),
    },
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="eyebrow">Après la clôture · liste de contrôle</div>
        <Chip tone={done === CLOSURE_STEPS.length ? "green" : "blue"}>
          {done} / {CLOSURE_STEPS.length} étapes faites
        </Chip>
      </div>
      <ol className="border-line divide-line divide-y rounded-[12px] border">
        {CLOSURE_STEPS.map((key, i) => {
          const step = steps[key];
          const at = checklist?.[key];
          const Icon = step.icon;
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
              <span
                className={cx(
                  "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[12px] font-bold",
                  at ? "bg-ok text-white" : "bg-brand-soft text-brand",
                )}
                aria-hidden="true"
              >
                {at ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-bold">
                  <span className="flex min-w-0 items-start gap-2">
                    <Icon className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {step.title}
                  </span>
                  {at ? (
                    <span className="text-ok-ink text-[12px] font-semibold">
                      fait le {frDateTime(at)}
                    </span>
                  ) : (
                    <span className="text-ink-muted text-[12px] font-semibold">à faire</span>
                  )}
                </div>
                <p className="text-ink-muted mt-0.5 max-w-[78ch] text-[12.5px]">{step.text}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">{step.action}</div>
            </li>
          );
        })}
      </ol>
      <details className="mt-3">
        <summary className="text-ink-muted cursor-pointer text-[12.5px] font-semibold select-none">
          Texte du message au secrétariat
        </summary>
        <pre className="bg-surface-2 border-line mt-2 max-h-[240px] overflow-auto rounded-[10px] border px-3 py-2 font-sans text-[12.5px] whitespace-pre-wrap">
          {`Objet : ${mail.subject}\n\n${mail.body}`}
        </pre>
      </details>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Autres documents</span>
        <Link to={`/responsable/imprimer/points/${stage.id}`}>
          <Button size="sm" icon={Printer}>
            Classement final du TN et points attribués
          </Button>
        </Link>
        <Button
          size="sm"
          icon={Waypoints}
          disabled={!cockpitCurrent}
          title={
            cockpitCurrent ? undefined : "Le cockpit de ce navigateur affiche un autre tournoi"
          }
          onClick={() => navigate("/tournoi/schema")}
        >
          Schéma du TN
        </Button>
      </div>
    </div>
  );
}
