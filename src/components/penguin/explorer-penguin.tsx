import type { SVGProps } from "react";

interface ExplorerPenguinProps extends SVGProps<SVGSVGElement> {
  /** Accessible label; pass `undefined` together with aria-hidden for decorative use. */
  title?: string;
}

/**
 * Original DeadByte mascot: a cyber-explorer penguin with a backpack,
 * headlamp visor and magnifying glass. Pure SVG, no external assets.
 */
export function ExplorerPenguin({ title = "DeadByte explorer penguin", ...props }: ExplorerPenguinProps) {
  return (
    <svg viewBox="0 0 160 180" role={title ? "img" : undefined} aria-label={title} {...props}>
      {title ? <title>{title}</title> : null}
      {/* shadow */}
      <ellipse cx="78" cy="170" rx="44" ry="6" fill="#000" opacity="0.35" />

      {/* backpack */}
      <rect x="22" y="70" width="30" height="58" rx="10" fill="#303849" stroke="#455068" strokeWidth="2" />
      <rect x="26" y="84" width="22" height="14" rx="4" fill="#1d2738" />
      <circle cx="37" cy="91" r="2.5" fill="#48c39b" />
      <line x1="30" y1="64" x2="30" y2="72" stroke="#455068" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="62" r="3" fill="#ff6573" />

      {/* feet */}
      <ellipse cx="62" cy="164" rx="14" ry="6" fill="#ff8a4c" />
      <ellipse cx="96" cy="164" rx="14" ry="6" fill="#ff8a4c" />

      {/* body */}
      <path d="M79 26c-30 0-44 28-44 64 0 40 16 72 44 72s44-32 44-72c0-36-14-64-44-64z" fill="#1b2433" />
      <path d="M79 26c-30 0-44 28-44 64 0 40 16 72 44 72s44-32 44-72c0-36-14-64-44-64z" fill="none" stroke="#2c3850" strokeWidth="2" />
      {/* belly */}
      <path d="M79 64c-19 0-27 20-27 42 0 26 10 48 27 48s27-22 27-48c0-22-8-42-27-42z" fill="#f1f3f8" />

      {/* strap */}
      <path d="M44 74c10 6 18 20 20 40" stroke="#455068" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* left flipper */}
      <path d="M38 88c-10 10-14 26-10 38 6-4 12-14 14-24z" fill="#141b28" />

      {/* face mask */}
      <path d="M79 36c-18 0-28 12-28 28 0 8 4 14 10 16h36c6-2 10-8 10-16 0-16-10-28-28-28z" fill="#f1f3f8" />

      {/* visor band + headlamp */}
      <path d="M50 52c18-8 40-8 58 0" stroke="#303849" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="71" y="40" width="16" height="10" rx="3" fill="#303849" />
      <circle cx="79" cy="45" r="3.5" fill="#ffc56d" />
      <path d="M79 45 L60 4 L98 4 Z" fill="#ffc56d" opacity="0.08" />

      {/* eyes */}
      <circle cx="68" cy="62" r="5" fill="#0e1421" />
      <circle cx="90" cy="62" r="5" fill="#0e1421" />
      <circle cx="69.6" cy="60.4" r="1.6" fill="#fff" />
      <circle cx="91.6" cy="60.4" r="1.6" fill="#fff" />
      {/* blush */}
      <ellipse cx="62" cy="71" rx="4" ry="2.2" fill="#ff6573" opacity="0.45" />
      <ellipse cx="96" cy="71" rx="4" ry="2.2" fill="#ff6573" opacity="0.45" />
      {/* beak */}
      <path d="M73 69 Q79 66 85 69 Q79 77 73 69z" fill="#ff8a4c" />

      {/* right flipper holding magnifying glass */}
      <path d="M118 88c12 4 18 14 18 22-8 0-14-6-18-12z" fill="#141b28" />
      <line x1="128" y1="104" x2="138" y2="122" stroke="#a2adbf" strokeWidth="4" strokeLinecap="round" />
      <circle cx="124" cy="96" r="12" fill="#8bd3f7" fillOpacity="0.18" stroke="#a2adbf" strokeWidth="3.5" />
      <path d="M118 92a7 7 0 0 1 6-4" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* chest badge: tiny terminal */}
      <rect x="70" y="96" width="18" height="12" rx="2" fill="#151d2c" />
      <path d="M73 100l3 2-3 2" stroke="#ff6573" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <line x1="78" y1="105" x2="84" y2="105" stroke="#48c39b" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
