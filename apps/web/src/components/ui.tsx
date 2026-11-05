/** Briques d'interface : boutons, puces, cartes, tuiles, avatars, en-têtes. */
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { clubShort, hue, initials, nice } from "@/lib/format";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Bouton ---------- */

type Variant = "default" | "primary" | "ghost" | "white" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

const VARIANTS: Record<Variant, string> = {
  default: "bg-surface border-line-2 text-ink hover:shadow-card enabled:hover:-translate-y-px",
  primary:
    "bg-[linear-gradient(180deg,#1e4fd8,#0e37a8)] text-white border-transparent shadow-[0_8px_20px_-8px_rgb(14_55_168/0.6)] enabled:hover:shadow-[0_12px_26px_-8px_rgb(14_55_168/0.7)] enabled:hover:-translate-y-px",
  ghost: "border-transparent bg-transparent text-brand hover:bg-brand-soft",
  white:
    "bg-white text-brand border-transparent shadow-[0_10px_24px_-10px_rgb(0_0_0/0.4)] enabled:hover:-translate-y-px",
  danger: "bg-alert-soft text-alert-ink border-transparent hover:bg-[#fbd9e0]",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-[12.5px] rounded-[10px] gap-1.5",
  md: "px-4 py-2.5 text-[13.5px] rounded-[12px] gap-2",
  lg: "px-5.5 py-3.5 text-[15px] rounded-[14px] gap-2",
};

export function Button({
  variant = "default",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center border font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" /> : null}
      {children}
      {IconRight ? <IconRight className="size-4" aria-hidden="true" /> : null}
    </button>
  );
}

/* ---------- Puce ---------- */

type Tone = "default" | "blue" | "green" | "red" | "gold" | "grey";

const TONES: Record<Tone, string> = {
  default: "bg-surface border-line text-ink-secondary",
  blue: "bg-brand-soft border-transparent text-brand-ink",
  green: "bg-ok-soft border-transparent text-ok-ink",
  red: "bg-alert-soft border-transparent text-alert-ink",
  gold: "bg-gold-soft border-transparent text-gold-ink",
  grey: "bg-surface-2 border-line text-ink-muted",
};

export function Chip({
  tone = "default",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-[12px] font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ---------- Carte ---------- */

export function Card({
  title,
  aside,
  children,
  className,
  bodyClassName,
  headerClassName,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
}) {
  return (
    <section className={cx("card", className)}>
      {title !== undefined ? (
        <header
          className={cx(
            "flex flex-wrap items-center justify-between gap-2.5 px-4 pt-3.5 pb-2.5",
            headerClassName,
          )}
        >
          <h3 className="text-[14px] font-bold">{title}</h3>
          {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ---------- Tuile de synthèse ---------- */

export function Tile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "gold" | "blue";
}) {
  return (
    <div className="card px-[18px] py-4">
      <div className="text-ink-muted text-[11.5px] font-bold tracking-[0.07em] uppercase">
        {label}
      </div>
      <div
        className={cx(
          "my-1 font-mono text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] tabular-nums",
          tone === "gold" && "text-gold-ink",
          tone === "blue" && "text-brand",
        )}
      >
        {value}
      </div>
      {detail ? <div className="text-ink-muted text-[12.5px]">{detail}</div> : null}
    </div>
  );
}

/* ---------- En-tête de vue ---------- */

export function PageHead({
  eyebrow,
  title,
  help,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mt-2.5 mb-4 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow mb-1">{eyebrow}</div>
        <h2 className="text-[22px] font-extrabold tracking-[-0.025em] md:text-[24px]">{title}</h2>
        {help ? <p className="text-ink-muted mt-1 max-w-[70ch]">{help}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/* ---------- Avatar à initiales ---------- */

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
const AVATAR_SIZES: Record<AvatarSize, string> = {
  xs: "size-[22px] text-[9px]",
  sm: "size-[26px] text-[10px]",
  md: "size-[34px] text-[12px]",
  lg: "size-[44px] text-[14px]",
  xl: "size-[56px] text-[17px]",
};

export function Avatar({
  name,
  size = "md",
  crown = false,
  className,
}: {
  name: string;
  size?: AvatarSize;
  crown?: boolean;
  className?: string;
}) {
  const h = hue(name);
  return (
    <span
      className={cx(
        "relative grid shrink-0 place-items-center rounded-full font-bold tracking-[0.02em] text-white shadow-[inset_0_-6px_12px_rgb(0_0_0/0.08),0_1px_0_rgb(255_255_255/0.6)]",
        AVATAR_SIZES[size],
        className,
      )}
      style={{
        background: `linear-gradient(145deg, hsl(${h} 62% 58%), hsl(${(h + 30) % 360} 70% 42%))`,
      }}
      title={nice(name)}
      aria-hidden="true"
    >
      {initials(name)}
      {crown ? (
        <span className="bg-gold absolute -top-[5px] -right-1 grid size-4 place-items-center rounded-full border-2 border-white text-[9px]">
          ★
        </span>
      ) : null}
    </span>
  );
}

/* ---------- Ligne joueur ---------- */

export function PlayerLine({
  name,
  club,
  size = "sm",
  trailing,
  prefix,
  className,
  crown,
  muted,
}: {
  name: string;
  club?: string;
  size?: AvatarSize;
  trailing?: ReactNode;
  prefix?: ReactNode;
  className?: string;
  crown?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cx("flex min-w-0 items-center gap-2.5", className)}>
      {prefix}
      <Avatar name={name} size={size} crown={crown} />
      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "truncate text-[12.5px] leading-[1.15] font-semibold",
            muted && "text-ink-muted",
          )}
        >
          {nice(name)}
        </div>
        {club !== undefined ? (
          <div className="text-ink-muted truncate text-[10.5px]">{clubShort(club)}</div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

/* ---------- Bandeau de confirmation ---------- */

export function Banner({
  icon: Icon,
  children,
  actions,
  tone = "green",
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  tone?: "green" | "blue" | "gold" | "red";
  className?: string;
}) {
  const tones = {
    green: "bg-ok-soft text-ok-ink",
    blue: "bg-brand-soft text-brand-ink",
    gold: "bg-gold-soft text-gold-ink",
    red: "bg-alert-soft text-alert-ink",
  };
  const dots = { green: "bg-ok", blue: "bg-brand", gold: "bg-gold", red: "bg-alert" };
  return (
    <div
      className={cx(
        "animate-pop mt-3.5 flex flex-wrap items-center gap-3 rounded-[12px] px-4 py-3 font-semibold",
        tones[tone],
        className,
      )}
    >
      <span
        className={cx(
          "grid size-7 shrink-0 place-items-center rounded-full text-white",
          dots[tone],
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {actions ? <div className="flex flex-wrap gap-2.5 sm:ml-auto">{actions}</div> : null}
    </div>
  );
}

/* ---------- Jauge « Classer » ---------- */

export function GaugeButton({
  done,
  total,
  label,
  onClick,
  disabled,
}: {
  done: number;
  total: number;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const ready = total > 0 && done === total && !disabled;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      aria-label={`${label} : ${done} sur ${total}`}
      className={cx(
        "relative inline-flex items-center gap-2 overflow-hidden rounded-[12px] border px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-[transform,box-shadow] duration-150",
        ready
          ? "animate-glow border-transparent bg-[linear-gradient(180deg,#1e4fd8,#0e37a8)] text-white shadow-[0_8px_20px_-8px_rgb(14_55_168/0.6)] hover:-translate-y-px"
          : "border-line-2 bg-surface text-brand-ink disabled:opacity-100",
      )}
    >
      {!ready ? (
        <span
          className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#e9effc,#d5e0fa)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="relative">
        {label} ·{" "}
        <span className="font-mono tabular-nums">
          {done}/{total}
        </span>
      </span>
    </button>
  );
}

/* ---------- Points de progression d'une poule ---------- */

export function Dots({ states }: { states: ("ok" | "ko" | "none")[] }) {
  return (
    <span className="flex items-center gap-[5px]">
      {states.map((s, i) => (
        <span
          key={i}
          className={cx(
            "size-[9px] rounded-full transition-colors duration-300",
            s === "ok" ? "bg-ok" : s === "ko" ? "bg-alert" : "bg-line-2",
          )}
        />
      ))}
    </span>
  );
}

/* ---------- Sélecteur ---------- */

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "border-line-2 bg-surface rounded-[8px] border px-2 py-1 text-[12px] font-semibold disabled:opacity-60",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
