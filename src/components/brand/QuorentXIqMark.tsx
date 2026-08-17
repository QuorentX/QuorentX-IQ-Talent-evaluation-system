import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PRODUCT } from "@/lib/brand";

type Tone = "light" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

type MarkProps = {
  className?: string;
  size?: Size;
  showWordmark?: boolean;
  showTagline?: boolean;
  tone?: Tone;
  to?: "/" | false;
};

const markBox = {
  sm: "h-7 w-[2.6rem]",
  md: "h-9 w-[3.35rem]",
  lg: "h-12 w-[4.5rem]",
  xl: "h-16 w-[6rem] sm:h-20 sm:w-[7.5rem]",
} as const;

const wordSize = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl sm:text-4xl",
} as const;

/**
 * Inline geometric SVG of the QuorentX IQ mark (i + Q).
 * Colors adapt to surface tone so the mark sits in the theme — not a boxed image.
 */
export function IqMarkSvg({
  className,
  tone = "dark",
  title = "QuorentX IQ",
}: {
  className?: string;
  tone?: Tone;
  title?: string;
}) {
  // On navy (tone=light text): Q ring lightens so it stays visible.
  const stem = "#185FA5";
  const accent = "#0F6E56";
  const ring = tone === "light" ? "#F1EFE8" : "#042C53";

  return (
    <svg
      viewBox="0 0 110 78"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* i stem */}
      <rect x="14" y="22" width="14" height="46" rx="7" fill={stem} />
      {/* i tittle */}
      <circle cx="21" cy="11" r="7" fill={accent} />
      {/* Q bowl */}
      <circle cx="68" cy="43" r="26" stroke={ring} strokeWidth="13" fill="none" />
      {/* Q tail — diagonal through lower-right */}
      <g transform="rotate(38 78 58)">
        <rect x="58" y="52" width="44" height="11" rx="5.5" fill={accent} />
      </g>
    </svg>
  );
}

/** Official lockup: inline SVG mark + QuorentX IQ wordmark as one unit. */
export function QuorentXIqWordmark({
  className,
  size = "md",
  showWordmark = true,
  showTagline = false,
  tone = "dark",
  to = "/",
}: MarkProps) {
  const ink = tone === "light" ? "text-white" : "text-[var(--qx-ink)]";
  const muted = tone === "light" ? "text-white/70" : "text-[var(--qx-ink)]/60";

  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <IqMarkSvg tone={tone} className={markBox[size]} />
      {showWordmark && (
        <span className="inline-flex flex-col leading-none">
          <span className={cn("font-medium tracking-tight", wordSize[size], ink)}>
            {PRODUCT.name}
            <span className="ml-1 tracking-[-0.5px] text-[var(--qx-teal)]">{PRODUCT.mark}</span>
          </span>
          {showTagline && (
            <span className={cn("mt-1 text-xs font-normal leading-relaxed sm:text-sm", muted)}>
              {PRODUCT.tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (to === false) return inner;

  return (
    <Link to="/" className="inline-flex no-underline" aria-label={`${PRODUCT.fullName} home`}>
      {inner}
    </Link>
  );
}

/** Mark-only SVG for hero / compact UI. */
export function QuorentXIqBadge({
  className,
  size = "md",
  tone = "dark",
}: {
  className?: string;
  size?: Size;
  tone?: Tone;
}) {
  return <IqMarkSvg tone={tone} className={cn(markBox[size], className)} />;
}
