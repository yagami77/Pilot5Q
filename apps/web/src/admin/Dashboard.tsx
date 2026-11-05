/** Tableau de bord de la saison : les 5 étapes et leur état, chiffres clés. */
import {
  stageStatus,
  stageStatusLabel,
  rankingRows,
  type Stage,
  type StageStatus,
} from "@pilot5q/domain";
import { ArrowRight, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { Link } from "react-router";

import { Avatar, Button, Card, Chip, PageHead, Tile, cx } from "@/components/ui";
import { dateRange, plural } from "@/lib/format";

import { useSeasonDoc } from "./store";
import { frDateTime } from "./ui";

const STATUS_TONE: Record<StageStatus, "grey" | "blue" | "gold" | "red" | "green"> = {
  "a-venir": "grey",
  "inscriptions-ouvertes": "blue",
  "inscriptions-closes": "gold",
  "ouvert-dj": "red",
  cloture: "green",
};

export function StageStatusChip({ stage, now }: { stage: Stage; now: string }) {
  const s = stageStatus(stage, now);
  return <Chip tone={STATUS_TONE[s]}>{stageStatusLabel(s)}</Chip>;
}

export function Dashboard() {
  const doc = useSeasonDoc();
  const now = new Date().toISOString();
  const ranked = rankingRows(doc.ranking).length;
  const clubName = (id: string | null) =>
    doc.clubs.find((c) => c.id === id)?.name ?? "Club à désigner";
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title="Tableau de bord de la saison"
        help="Chaque étape suit le même chemin : inscriptions, liste ordonnée, ouverture au directeur de jeu, clôture et points. Cliquer une étape pour la préparer."
      >
        <Link to="/responsable/calendrier">
          <Button icon={CalendarDays}>Modifier le calendrier</Button>
        </Link>
      </PageHead>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Étapes"
          value={doc.stages.length}
          detail={`${doc.stages.filter((s) => s.closedAt).length} clôturée(s)`}
        />
        <Tile label="Clubs hôtes" value={doc.clubs.length} detail="base des clubs" />
        <Tile label="Classés" value={ranked} tone="blue" detail="au classement glissant" />
        <Tile label="Base joueurs" value={doc.players.length} detail="joueurs connus" />
      </div>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[...doc.stages]
          .sort((a, b) => a.number - b.number)
          .map((stage, i) => {
            const status = stageStatus(stage, now);
            const regs =
              doc.registrations[stage.id]?.registrations.filter((r) => !r.forfait).length ?? 0;
            return (
              <li
                key={stage.id}
                className="animate-fade-up min-w-0"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Link
                  to={`/responsable/tn/${stage.id}`}
                  className={cx(
                    "card block h-full p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-raised)]",
                    status === "ouvert-dj" && "border-alert",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="eyebrow">{stage.name}</div>
                      <div className="truncate text-[17px] font-extrabold">
                        {stage.city || "Ville à définir"}
                      </div>
                    </div>
                    <Avatar name={clubName(stage.clubId)} size="md" />
                  </div>
                  <div className="text-ink-muted mt-1 truncate text-[12.5px]">
                    {clubName(stage.clubId)}
                  </div>
                  <div className="mt-2 text-[13px] font-semibold">
                    {stage.start && stage.end
                      ? dateRange(stage.start, stage.end)
                      : "Dates à définir"}
                  </div>
                  <div className="text-ink-muted mt-0.5 text-[12px]">
                    {stage.big + stage.small > 0
                      ? `${stage.big + stage.small} billards · ${stage.big} × 3m10`
                      : "Billards à définir"}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <StageStatusChip stage={stage} now={now} />
                    {regs > 0 ? <Chip tone="grey">{plural(regs, "inscrit")}</Chip> : null}
                  </div>
                  <div className="text-ink-muted mt-3 text-[11.5px] leading-[1.4]">
                    Inscriptions : {frDateTime(stage.registrationOpen)} →{" "}
                    {frDateTime(stage.registrationClose)}
                  </div>
                  <div className="text-brand mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold">
                    Préparer l'étape <ArrowRight className="size-3.5" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
      </ol>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <QuickLink
          to="/responsable/classement"
          icon={Trophy}
          title="Classement glissant"
          text={`${ranked} joueurs classés sur les 5 derniers TN, export CSV et impression A4.`}
        />
        <QuickLink
          to="/responsable/joueurs"
          icon={Users}
          title="Base joueurs"
          text="Licence, nom, classement en cours, dernier classement et saison."
        />
        <QuickLink
          to="/responsable/clubs"
          icon={MapPin}
          title="Clubs hôtes"
          text="Coordonnées, billards 3m10 et 2m80, numéro FFB."
        />
      </div>
    </>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  text,
}: {
  to: string;
  icon: typeof Trophy;
  title: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      className="card flex items-start gap-3 p-4 transition-transform hover:-translate-y-px"
    >
      <span className="bg-brand-soft text-brand grid size-10 shrink-0 place-items-center rounded-[10px]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold">{title}</span>
        <span className="text-ink-muted block text-[12.5px]">{text}</span>
      </span>
    </Link>
  );
}

export { Card };
