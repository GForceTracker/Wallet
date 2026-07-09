import React from 'react';

interface TrantLogoProps {
  size?: number;
  className?: string;
}

/**
 * TRANT WALLET – signature mark.
 *
 * Design language: "Crystalline Vault"
 *   • Hexagonal outer ring (flat-top) with a dual-gradient stroke
 *   • Interior dark-field with a subtle radial highlight (top-left)
 *   • Six feather-light facet lines radiating from a centre point –
 *     giving the gem-cut depth impression even at tiny sizes
 *   • Bold T glyph: wide crossbar + hex-bottomed stem rendered in a
 *     single cyan→violet gradient with a soft glow halo
 *   • Three node-dots below the stem (blockchain reference)
 *   • Accent sparkle at the T apex and each bar-tip
 */
export function TrantLogo({ size = 80, className = '' }: TrantLogoProps) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="TRANT WALLET"
    >
      <defs>
        {/* Coin background – deep navy radial */}
        <radialGradient id={`${id}bg`} cx="38%" cy="30%" r="70%" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1c2e58" />
          <stop offset="100%" stopColor="#04081a" />
        </radialGradient>

        {/* Signature gradient – electric cyan → deep violet */}
        <linearGradient id={`${id}main`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00e5ff" />
          <stop offset="45%"  stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>

        {/* Outer ring gradient */}
        <linearGradient id={`${id}ring`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00e5ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.9" />
        </linearGradient>

        {/* Soft glow for the T glyph */}
        <filter id={`${id}glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Clip to the hexagon */}
        <clipPath id={`${id}hex`}>
          {/* Flat-top hexagon inscribed in r=56 circle, centred at 60,60 */}
          <polygon points="60,4 112,32 112,88 60,116 8,88 8,32" />
        </clipPath>
      </defs>

      {/* ── Hexagon background ─────────────────────────────────────────── */}
      <polygon
        points="60,4 112,32 112,88 60,116 8,88 8,32"
        fill={`url(#${id}bg)`}
      />

      {/* ── Six facet lines from centre (very faint – gem cut) ──────────── */}
      {[
        [60, 60, 60, 4],
        [60, 60, 112, 32],
        [60, 60, 112, 88],
        [60, 60, 60, 116],
        [60, 60, 8, 88],
        [60, 60, 8, 32],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={`url(#${id}main)`}
          strokeWidth="0.6"
          opacity="0.18"
        />
      ))}

      {/* ── Inner facet ring (subtle second hex) ────────────────────────── */}
      <polygon
        points="60,18 98,39 98,81 60,102 22,81 22,39"
        fill="none"
        stroke={`url(#${id}main)`}
        strokeWidth="0.5"
        opacity="0.12"
      />

      {/* ── T glyph ──────────────────────────────────────────────────────── */}
      <g filter={`url(#${id}glow)`}>
        {/* Crossbar – chamfered ends (polygon instead of rect) */}
        <polygon
          points="
            26,36   94,36
            97,39   97,51
            94,54   74,54
            74,82   66,89
            54,89   46,82
            46,54   26,54
            23,51   23,39
          "
          fill={`url(#${id}main)`}
        />
      </g>

      {/* ── Bar-tip accent marks ─────────────────────────────────────────── */}
      <polygon points="23,39 19,45 23,51" fill="#00e5ff" opacity="0.85" />
      <polygon points="97,39 101,45 97,51" fill="#7c3aed" opacity="0.85" />

      {/* ── Apex sparkle ─────────────────────────────────────────────────── */}
      <polygon points="60,28 63,36 60,34 57,36" fill="#00e5ff" opacity="0.9" />

      {/* ── Three node-dots below stem ───────────────────────────────────── */}
      <circle cx="42" cy="97" r="2.4" fill={`url(#${id}main)`} opacity="0.75" />
      <circle cx="60" cy="100" r="2.4" fill={`url(#${id}main)`} opacity="0.9" />
      <circle cx="78" cy="97"  r="2.4" fill={`url(#${id}main)`} opacity="0.75" />
      {/* Connector lines between dots */}
      <line x1="44" y1="97" x2="58" y2="100" stroke={`url(#${id}main)`} strokeWidth="0.7" opacity="0.4" />
      <line x1="62" y1="100" x2="76" y2="97" stroke={`url(#${id}main)`} strokeWidth="0.7" opacity="0.4" />

      {/* ── Outer hex border (dual stroke: bright + hairline inner) ──────── */}
      <polygon
        points="60,4 112,32 112,88 60,116 8,88 8,32"
        fill="none"
        stroke={`url(#${id}ring)`}
        strokeWidth="2.2"
      />
      <polygon
        points="60,7 109,33.5 109,86.5 60,113 11,86.5 11,33.5"
        fill="none"
        stroke={`url(#${id}ring)`}
        strokeWidth="0.5"
        opacity="0.3"
      />
    </svg>
  );
}
