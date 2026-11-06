/** Briques propres à l'espace du responsable : champs de formulaire, tableaux, actions. */
import { mailHtml, mailSegments } from "@pilot5q/domain";
import type { LucideIcon } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cx } from "@/components/ui";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-ink-muted text-[11px] font-bold tracking-[0.06em] uppercase">
        {label}
      </span>
      {children}
      {hint ? <span className="text-ink-muted text-[11.5px]">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("field", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx("field min-h-[120px] font-mono text-[12.5px]", props.className)}
    />
  );
}

export function SelectField({
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={cx("field", props.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Tableau de données compact (chiffres tabulaires en Geist Mono). */
export function Table({
  head,
  children,
  className,
  dense,
}: {
  head: ReactNode[];
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cx("border-line overflow-x-auto rounded-[12px] border", className)}>
      <table className={cx("w-full border-collapse text-[12.5px]", dense && "text-[12px]")}>
        <thead>
          <tr className="bg-surface-2 text-ink-muted border-line border-b text-[10.5px] font-bold tracking-[0.07em] uppercase">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left whitespace-nowrap first:pl-3.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({
  children,
  onClick,
  active,
  muted,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        "border-line border-b last:border-b-0 [&>td]:px-3 [&>td]:py-1.5 [&>td]:align-middle [&>td:first-child]:pl-3.5",
        onClick && "hover:bg-brand-soft/60 cursor-pointer",
        active && "bg-brand-soft",
        muted && "text-ink-muted",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono tabular-nums", className)}>{children}</span>;
}

/** Message vide avec icône. */
export function Empty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="text-ink-muted flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px]">
      <Icon className="size-6" aria-hidden="true" />
      {children}
    </div>
  );
}

/** Copie un texte dans le presse-papiers (retourne faux si impossible). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copie un mail en HTML (phrases d'alerte en rouge) avec sa version texte brut ; repli sur le
 * texte brut si le navigateur ne gère pas `ClipboardItem`. Retourne le format copié, ou null.
 */
export async function copyMail(text: string): Promise<"html" | "text" | null> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([mailHtml(text)], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return "html";
    }
  } catch {
    /* repli texte brut ci-dessous */
  }
  return (await copyText(text)) ? "text" : null;
}

/** Corps d'un mail tel qu'il sera lu : sauts de ligne conservés, phrases d'alerte en rouge. */
export function MailBody({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cx(
        "bg-surface border-line rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-[1.55] whitespace-pre-wrap",
        className,
      )}
    >
      {mailSegments(text).map((s, i) =>
        s.alert ? (
          <strong key={i} className="text-alert font-semibold">
            {s.text}
          </strong>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}

/** Télécharge un fichier texte (CSV, TXT). */
export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  const blob = new Blob(["﻿", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Date locale courte « 30/10/2026 ». */
export function frDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Date-heure locale « 30/10/2026 23:59 ». */
export function frDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const time = iso.length > 10 ? ` ${iso.slice(11, 16)}` : "";
  return `${frDate(iso)}${time}`;
}

/** Nombre à n décimales avec virgule. */
export function dec(n: number, digits = 3): string {
  return n.toFixed(digits).replace(".", ",");
}
