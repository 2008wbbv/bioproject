/**
 * Decorative SVG for the dashboard hero — a stylised "predicted vs experimental"
 * overlay: two protein-like backbone traces, one confident (blue) and one
 * experimental (grey), drifting apart at a loop. Pure SVG, theme-aware, animated.
 */
export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 320 120" width="320" height="120" role="img" aria-label="Predicted vs experimental structure overlay">
      <defs>
        <linearGradient id="ofu-pred" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="0.7" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      {/* experimental (reference) */}
      <path
        d="M10 70 C 40 40, 60 40, 80 62 S 120 90, 150 64 S 200 30, 230 60 S 280 86, 310 58"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* predicted (model) — drifts at the loop near x=230 */}
      <path
        className="hero-pred"
        d="M10 72 C 40 42, 60 42, 80 64 S 120 92, 150 66 S 205 16, 236 44 S 286 70, 312 44"
        fill="none"
        stroke="url(#ofu-pred)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="640"
        strokeDashoffset="640"
      />
      {/* confidently-wrong marker */}
      <circle className="hero-mark" cx="221" cy="30" r="6" fill="#ef4444" opacity="0.85" />
      <circle cx="221" cy="30" r="11" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}
