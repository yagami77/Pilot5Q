/**
 * Pièces jointes des convocations d'une étape (RETOURS-2026-11-06, « Responsable national »).
 *
 * - La liste ordonnée des participants est générée en PDF et jointe automatiquement.
 * - Le responsable téléverse ses fichiers (affiche, plan d'accès, hôtels) : PDF ou images, 10 Mo
 *   au plus chacun, stockés dans ce navigateur (IndexedDB, clés `pilot5q:attachments:*`).
 * - Sans serveur, les pièces se téléchargent une à une ou toutes ensemble (zip) pour être jointes
 *   à la main ; l'envoi avec pièces jointes viendra avec le serveur.
 */
import { del, get, set } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";

/** Taille maximale d'une pièce jointe téléversée. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Types acceptés au téléversement (attribut `accept` du champ fichier). */
export const ATTACHMENT_ACCEPT = "application/pdf,.pdf,image/*";

/** Pièce jointe téléversée (métadonnées ; le contenu est stocké à part). */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: string;
}

const listKey = (stageId: string) => `pilot5q:attachments:${stageId}`;
const blobKey = (id: string) => `pilot5q:attachment:${id}`;

/** Motif du refus d'un fichier, ou null s'il est accepté. */
export function attachmentError(file: { name: string; type: string; size: number }): string | null {
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const image = file.type.startsWith("image/");
  if (!pdf && !image) return `${file.name} : seuls les PDF et les images sont acceptés`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name} : ${formatSize(file.size)}, au-delà de la limite de 10 Mo`;
  }
  if (file.size === 0) return `${file.name} : fichier vide`;
  return null;
}

/** « 845 o », « 12 Ko », « 1,4 Mo ». */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/**
 * Nom de fichier sans caractères gênants ni accents (« Pièces · Saint-Étienne » → « Pieces -
 * Saint-Etienne ») : certains navigateurs ignorent un nom de téléchargement non ASCII.
 */
export function safeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[·/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim();
}

/** Noms uniques dans une archive (« plan.pdf », « plan (2).pdf »). */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = (seen.get(n.toLowerCase()) ?? 0) + 1;
    seen.set(n.toLowerCase(), count);
    if (count === 1) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${count})${n.slice(dot)}` : `${n} (${count})`;
  });
}

export async function listAttachments(stageId: string): Promise<Attachment[]> {
  try {
    return (await get<Attachment[]>(listKey(stageId))) ?? [];
  } catch {
    return [];
  }
}

export async function attachmentBlob(id: string): Promise<Blob | null> {
  try {
    return (await get<Blob>(blobKey(id))) ?? null;
  } catch {
    return null;
  }
}

/** Enregistre des fichiers déjà validés ; retourne la nouvelle liste. */
export async function storeAttachments(stageId: string, files: File[]): Promise<Attachment[]> {
  const current = await listAttachments(stageId);
  const added: Attachment[] = [];
  for (const f of files) {
    const id = `${stageId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // Copie en Blob : un File issu d'un champ n'est pas toujours clonable d'un navigateur à l'autre.
    await set(blobKey(id), new Blob([await blobBytes(f)], { type: f.type }));
    added.push({
      id,
      name: f.name,
      type: f.type || "application/octet-stream",
      size: f.size,
      addedAt: new Date().toISOString(),
    });
  }
  const next = [...current, ...added];
  await set(listKey(stageId), next);
  return next;
}

export async function removeAttachment(stageId: string, id: string): Promise<Attachment[]> {
  const next = (await listAttachments(stageId)).filter((a) => a.id !== id);
  await set(listKey(stageId), next);
  await del(blobKey(id));
  return next;
}

/** Contenu d'un Blob (repli FileReader pour les environnements sans `Blob.arrayBuffer`). */
export async function blobBytes(b: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof b.arrayBuffer === "function") return new Uint8Array(await b.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error ?? new Error("Lecture impossible"));
    r.readAsArrayBuffer(b);
  });
}

/** Télécharge un fichier binaire. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(name);
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Archive zip (sans compression pour les PDF et images, déjà compressés). */
export async function zipBlob(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const names = uniqueNames(files.map((f) => f.name));
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const [i, f] of files.entries()) {
    entries[names[i]!] = [await blobBytes(f.blob), { level: 0 }];
  }
  const bytes = zipSync(entries);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}

export interface StageAttachments {
  ready: boolean;
  list: Attachment[];
  add: (files: File[]) => Promise<{ added: number; refused: string[] }>;
  remove: (id: string) => Promise<void>;
}

/** Pièces jointes téléversées pour une étape. */
export function useStageAttachments(stageId: string): StageAttachments {
  const [list, setList] = useState<Attachment[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void listAttachments(stageId).then((l) => {
      if (cancelled) return;
      setList(l);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [stageId]);
  const add = useCallback(
    async (files: File[]) => {
      const refused: string[] = [];
      const ok = files.filter((f) => {
        const err = attachmentError(f);
        if (err) refused.push(err);
        return !err;
      });
      if (ok.length > 0) setList(await storeAttachments(stageId, ok));
      return { added: ok.length, refused };
    },
    [stageId],
  );
  const remove = useCallback(
    async (id: string) => setList(await removeAttachment(stageId, id)),
    [stageId],
  );
  return { ready, list, add, remove };
}
