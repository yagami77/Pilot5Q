/**
 * Barre des pièces jointes sous l'aperçu d'une convocation : liste des participants (PDF généré
 * automatiquement) et fichiers téléversés par le responsable pour l'étape.
 */
import type { Player, Stage } from "@pilot5q/domain";
import {
  Download,
  FileArchive,
  FileText,
  ImageIcon,
  Paperclip,
  Plus,
  Server,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { useToast } from "@/components/Toast";
import { Button, cx } from "@/components/ui";

import {
  ATTACHMENT_ACCEPT,
  attachmentBlob,
  downloadBlob,
  formatSize,
  safeFileName,
  useStageAttachments,
  zipBlob,
} from "./attachments";
import { participantsFileName, participantsPdf } from "./participantsPdf";
import type { SeasonDocument } from "./persistence";

/** Liste des participants en PDF, régénérée quand la liste change. */
function useParticipantsPdf(
  doc: SeasonDocument,
  stage: Stage,
  accepted: Player[],
  waiting: Player[],
): Blob | null {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (accepted.length === 0) {
      setBlob(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      participantsPdf(doc, stage, accepted, waiting)
        .then((b) => {
          if (!cancelled) setBlob(b);
        })
        .catch(() => {
          if (!cancelled) setBlob(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, stage, accepted, waiting]);
  return blob;
}

function FileChip({
  name,
  size,
  image,
  auto,
  onDownload,
  onRemove,
}: {
  name: string;
  size: string;
  image?: boolean;
  auto?: boolean;
  onDownload: () => void;
  onRemove?: () => void;
}) {
  const Icon = image ? ImageIcon : FileText;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cx(
        "flex max-w-full min-w-0 items-center gap-2 rounded-[10px] border py-1.5 pr-1.5 pl-2.5",
        auto ? "border-brand/25 bg-brand-soft/60" : "border-line bg-surface",
      )}
    >
      <Icon
        className={cx("size-4 shrink-0", auto ? "text-brand" : "text-ink-muted")}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block max-w-[260px] truncate text-[12.5px] font-semibold" title={name}>
          {name}
        </span>
        <span className="text-ink-muted flex items-center gap-1 text-[11px]">
          {auto ? (
            <>
              <Sparkles className="size-3" aria-hidden="true" />
              générée automatiquement ·{" "}
            </>
          ) : null}
          <span className="font-mono tabular-nums">{size}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onDownload}
        className="text-ink-muted hover:bg-brand-soft hover:text-brand grid size-7 shrink-0 place-items-center rounded-[8px]"
        aria-label={`Télécharger ${name}`}
        title="Télécharger"
      >
        <Download className="size-3.5" aria-hidden="true" />
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-muted hover:bg-alert-soft hover:text-alert-ink grid size-7 shrink-0 place-items-center rounded-[8px]"
          aria-label={`Supprimer ${name}`}
          title="Supprimer"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </motion.li>
  );
}

/** Pièces jointes d'une étape : à afficher sous l'aperçu de chaque convocation. */
export function AttachmentsBar({
  doc,
  stage,
  accepted,
  waiting,
}: {
  doc: SeasonDocument;
  stage: Stage;
  accepted: Player[];
  waiting: Player[];
}) {
  const files = useStageAttachments(stage.id);
  const toast = useToast();
  const pdf = useParticipantsPdf(doc, stage, accepted, waiting);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pdfName = participantsFileName(stage);

  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { added, refused } = await files.add([...list]);
    if (refused.length > 0) toast(refused.join(" · "));
    else if (added > 0)
      toast(`${added} fichier${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""}`);
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    void add(e.dataTransfer.files);
  };
  const downloadOne = async (id: string, name: string) => {
    const blob = await attachmentBlob(id);
    if (blob) downloadBlob(name, blob);
    else toast("Fichier introuvable dans ce navigateur");
  };
  const downloadAll = async () => {
    const all: { name: string; blob: Blob }[] = [];
    if (pdf) all.push({ name: pdfName, blob: pdf });
    for (const a of files.list) {
      const blob = await attachmentBlob(a.id);
      if (blob) all.push({ name: a.name, blob });
    }
    if (all.length === 0) return;
    downloadBlob(
      safeFileName(`Pièces jointes - ${stage.name} ${stage.season}.zip`),
      await zipBlob(all),
    );
  };
  const count = (pdf ? 1 : 0) + files.list.length;
  const total = (pdf?.size ?? 0) + files.list.reduce((s, a) => s + a.size, 0);

  return (
    <section
      aria-label="Pièces jointes"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cx(
        "mt-2 rounded-[12px] border border-dashed px-3 py-2.5 transition-colors",
        dragging ? "border-brand bg-brand-soft" : "border-line-2 bg-surface-2",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Paperclip className="text-ink-muted size-3.5" aria-hidden="true" />
        <span className="text-[12.5px] font-bold">
          Pièces jointes · {count}
          {total > 0 ? (
            <span className="text-ink-muted ml-1.5 font-mono font-normal tabular-nums">
              {formatSize(total)}
            </span>
          ) : null}
        </span>
        <span className="flex-1" />
        <Button size="sm" icon={Plus} onClick={() => input.current?.click()}>
          Ajouter des fichiers
        </Button>
        <Button
          size="sm"
          icon={FileArchive}
          disabled={count === 0}
          onClick={() => void downloadAll()}
        >
          Tout télécharger (.zip)
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          aria-label="Ajouter des pièces jointes"
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <ul className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {accepted.length > 0 ? (
            <FileChip
              key="participants"
              auto
              name={pdfName}
              size={pdf ? formatSize(pdf.size) : "génération…"}
              onDownload={() => {
                if (pdf) downloadBlob(pdfName, pdf);
              }}
            />
          ) : null}
          {files.list.map((a) => (
            <FileChip
              key={a.id}
              name={a.name}
              size={formatSize(a.size)}
              image={a.type.startsWith("image/")}
              onDownload={() => void downloadOne(a.id, a.name)}
              onRemove={() => {
                void files.remove(a.id).then(() => toast(`${a.name} supprimé`));
              }}
            />
          ))}
        </AnimatePresence>
      </ul>
      <p className="text-ink-muted mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <Server className="size-3.5" aria-hidden="true" />
        Envoi avec pièces jointes : avec le serveur. D'ici là, joignez ces fichiers à votre email.
        <span className="hidden sm:inline">
          · PDF ou images, 10 Mo au plus chacun, gardés dans ce navigateur ; glisser-déposer
          possible.
        </span>
      </p>
    </section>
  );
}
