import type { SVGProps } from "react";

interface ExplorerPenguinProps extends SVGProps<SVGSVGElement> {
  /** Accessible label; pass `undefined` together with aria-hidden for decorative use. */
  title?: string;
  /**
   * Hover/tap switches the flashlight on: its beam spills outside the SVG box
   * and reveals a hidden "DEADBYTE" on the background. Use once per page
   * (gradient ids are fixed) and leave room above the penguin.
   */
  interactive?: boolean;
}

const OUTLINE = "#5b6883";
const BODY = "#1f293b";
const BELLY = "#f1f3f8";
const INK = "#0e1421";
const BEAK = "#ff8a4c";
const CORAL = "#ff6573";
const LAMP = "#ffc56d";

/** Shown only while an interactive penguin is hovered. */
const LIT = "opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none";

/**
 * Original DeadByte mascot: a chubby, winking explorer penguin sitting on an
 * Antarctic ice floe, with a headlamp, a flashlight, a magnifying glass and a
 * tiny terminal badge. Pure SVG, no external assets.
 */
export function ExplorerPenguin({ title = "DeadByte explorer penguin", interactive = false, className, ...props }: ExplorerPenguinProps) {
  return (
    <svg
      viewBox="0 0 160 180"
      role={title ? "img" : undefined}
      aria-label={title}
      overflow={interactive ? "visible" : undefined}
      className={interactive ? `group ${className ?? ""}` : className}
      {...props}
    >
      {title ? <title>{title}</title> : null}

      {interactive ? (
        <g className={LIT} pointerEvents="none" aria-hidden="true">
          <defs>
            <linearGradient id="db-penguin-beam" x1="15" y1="66" x2="40" y2="-30" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={LAMP} stopOpacity="0.55" />
              <stop offset="1" stopColor={LAMP} stopOpacity="0.08" />
            </linearGradient>
            <radialGradient id="db-penguin-spot">
              <stop offset="0" stopColor={LAMP} stopOpacity="0.35" />
              <stop offset="0.7" stopColor={LAMP} stopOpacity="0.12" />
              <stop offset="1" stopColor={LAMP} stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* beam from the flashlight to the light spot on the background */}
          <path d="M13 66 L-18 -28 L98 -28 L18 66 Z" fill="url(#db-penguin-beam)" />
          <ellipse cx="40" cy="-30" rx="62" ry="19" fill="url(#db-penguin-spot)" />
          <text
            x="40"
            y="-25"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="15"
            fontWeight="700"
            letterSpacing="2.5"
            fill={CORAL}
          >
            DEADBYTE
          </text>
        </g>
      ) : null}

      {/* ice floe */}
      <ellipse cx="80" cy="164" rx="62" ry="10" fill="#8bd3f7" fillOpacity="0.14" stroke="#8bd3f7" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M26 172c6 3 14 4 20 3M118 175c8 0 14-1 18-3" stroke="#8bd3f7" strokeOpacity="0.4" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* flashlight, held up in the left flipper */}
      <g transform="translate(12.5 78) rotate(14)">
        <rect x="-3.5" y="-4" width="7" height="15" rx="2" fill="#303849" stroke={OUTLINE} strokeWidth="1.5" />
        <rect x="-5.5" y="-11" width="11" height="8" rx="2" fill="#455068" stroke={OUTLINE} strokeWidth="1.5" />
        <rect x="-4.5" y="-12.5" width="9" height="2.5" rx="1" fill={LAMP} opacity={interactive ? 0.45 : 0.8} />
        {interactive ? <rect x="-4.5" y="-12.5" width="9" height="2.5" rx="1" fill={LAMP} className={LIT} /> : null}
      </g>
      <path d="M38 100c-12-1-24-7-30-17 10-2 21 3 29 10z" fill={BODY} stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />

      {/* right flipper raised, holding the magnifying glass */}
      <line x1="146" y1="71" x2="150" y2="86" stroke="#a2adbf" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M122 100c12-1 24-7 30-17-10-2-21 3-29 10z" fill={BODY} stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="141" cy="61" r="11.5" fill="#8bd3f7" fillOpacity="0.2" stroke="#a2adbf" strokeWidth="3.5" />
      <path d="M134.5 57.5a7 7 0 0 1 5.5-4.5" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* round body + head */}
      <path
        d="M80 26c32 0 48 24 46 54-1 16 8 30 6 50-2 22-22 32-52 32s-50-10-52-32c-2-20 7-34 6-50-2-30 14-54 46-54z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="2.5"
      />

      {/* heart-shaped face flowing into the belly */}
      <path
        d="M80 50c-8-10-28-10-32 8-4 16 4 30 12 38-10 8-14 22-12 38 2 16 16 24 32 24s30-8 32-24c2-16-2-30-12-38 8-8 16-22 12-38-4-18-24-18-32-8z"
        fill={BELLY}
      />

      {/* headlamp (glows while the flashlight is on) */}
      <rect x="72" y="33" width="16" height="10" rx="4" fill="#303849" stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="80" cy="38" r="3" fill={LAMP} />
      {interactive ? <circle cx="80" cy="38" r="6" fill={LAMP} opacity="0.35" className={LIT} /> : null}

      {/* open eye */}
      <circle cx="66" cy="70" r="6.5" fill={INK} />
      <circle cx="68" cy="67.5" r="2.3" fill="#fff" />
      <circle cx="64.3" cy="72.5" r="1" fill="#fff" />
      {/* winking eye */}
      <path d="M88 71q7-7 14 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />

      {/* blush */}
      <ellipse cx="57" cy="82" rx="5" ry="3" fill={CORAL} opacity="0.5" />
      <ellipse cx="103" cy="82" rx="5" ry="3" fill={CORAL} opacity="0.5" />

      {/* beak */}
      <path d="M74 79q6-3 12 0-2.5 7-6 8-3.5-1-6-8z" fill={BEAK} />

      {/* feet, sticking out in front while sitting */}
      <ellipse cx="62" cy="161" rx="12" ry="7.5" fill={BEAK} stroke="#c9602c" strokeWidth="1.5" transform="rotate(-14 62 161)" />
      <ellipse cx="98" cy="161" rx="12" ry="7.5" fill={BEAK} stroke="#c9602c" strokeWidth="1.5" transform="rotate(14 98 161)" />

      {/* belly badge: tiny terminal */}
      <rect x="69" y="114" width="22" height="15" rx="3" fill="#151d2c" />
      <path d="M73 119l3.5 2.5-3.5 2.5" stroke={CORAL} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="79" y1="125" x2="86" y2="125" stroke="#48c39b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
