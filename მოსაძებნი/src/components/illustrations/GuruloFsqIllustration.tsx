import React from "react";

type GuruloFsqIllustrationProps = {
  /**
   * When true the illustration renders with a darker palette that blends
   * better with the assistant's dark theme container.
   */
  dark?: boolean;
};

/**
 * Lightweight SVG illustration inspired by the new Gurulo FSQ preview cards.
 *
 * The original design shipped as a PNG which breaks the Codex PR pipeline
 * because binary diffs are currently unsupported. This component recreates the
 * look using vector primitives so that the asset lives directly in the codebase
 * and can be diffed as regular text.
 */
const GuruloFsqIllustration: React.FC<GuruloFsqIllustrationProps> = ({ dark }) => {
  const surfaceColor = dark ? "#0d1117" : "#f8fafc";
  const frameColor = dark ? "#111827" : "#ffffff";
  const accentStart = dark ? "#4f46e5" : "#6366f1";
  const accentEnd = dark ? "#22d3ee" : "#0ea5e9";
  const textColor = dark ? "#f9fafb" : "#111827";
  const subtle = dark ? "#1f2937" : "#e2e8f0";
  const glow = dark ? "rgba(59,130,246,0.35)" : "rgba(59,130,246,0.25)";

  return (
    <svg
      viewBox="0 0 320 200"
      className="w-full drop-shadow-lg"
      role="img"
      aria-label="Gurulo FSQ smart suggestions"
    >
      <defs>
        <linearGradient id="fsq-surface" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={surfaceColor} />
          <stop offset="100%" stopColor={dark ? "#030712" : "#eef2ff"} />
        </linearGradient>
        <linearGradient id="fsq-accent" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={accentStart} />
          <stop offset="100%" stopColor={accentEnd} />
        </linearGradient>
        <linearGradient id="fsq-badge" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
        <filter id="fsq-glow" x="-20%" y="-40%" width="140%" height="200%">
          <feDropShadow dx="0" dy="12" stdDeviation="18" floodColor={glow} />
        </filter>
      </defs>

      {/* Card frame */}
      <rect x="12" y="16" width="296" height="168" rx="28" fill={frameColor} filter="url(#fsq-glow)" />
      <rect x="24" y="32" width="272" height="140" rx="24" fill="url(#fsq-surface)" />

      {/* Top header pill */}
      <g transform="translate(40 52)">
        <rect width="120" height="32" rx="16" fill="url(#fsq-accent)" opacity="0.15" />
        <circle cx="16" cy="16" r="10" fill="url(#fsq-accent)" opacity="0.55" />
        <text x="36" y="20" fontSize="13" fontWeight="600" fill={textColor}>
          Gurulo · FSQ v2
        </text>
      </g>

      {/* Central graph */}
      <g transform="translate(56 96)">
        <rect width="208" height="92" rx="20" fill={frameColor} stroke={subtle} strokeWidth="1" />
        <polyline
          points="16,64 52,44 92,56 128,28 168,40 196,20"
          fill="none"
          stroke="url(#fsq-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g fill={textColor} opacity="0.8" fontSize="11" fontWeight="500">
          <text x="20" y="24">კვირის ანალიზი</text>
          <text x="20" y="46" opacity="0.6">
            ჩათის გამოყენება ↑ 34%
          </text>
          <text x="20" y="66" opacity="0.6">
            კოტეჯის შეკითხვები · Smart FSQ
          </text>
        </g>
        <g transform="translate(156 16)">
          <rect width="44" height="44" rx="12" fill="url(#fsq-badge)" opacity="0.9" />
          <text
            x="22"
            y="28"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill="#1f2937"
          >
            FSQ
          </text>
        </g>
      </g>

      {/* Bottom helper text */}
      <g transform="translate(40 164)" fontSize="12" fill={dark ? "#cbd5f5" : "#475569"}>
        <text fontWeight="600">Smart Suggestions</text>
        <text y="18" opacity="0.8">
          პერსონალიზებული პასუხები და სწრაფი ფაქტების მოძიება კოტეჯებისთვის
        </text>
      </g>
    </svg>
  );
};

export default GuruloFsqIllustration;
