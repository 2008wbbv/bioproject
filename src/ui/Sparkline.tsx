/**
 * Tiny inline SVG sparkline for per-row data viz (no deps). `sparklinePath` is pure
 * and tested; `Sparkline` renders it with an optional area fill.
 */
export function sparklinePath(values: number[], width: number, height: number, pad = 1): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `M${pad},${y} L${width - pad},${y}`;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  width = 88,
  height = 22,
  stroke = "var(--accent)",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length === 0) return <span className="muted small">—</span>;
  const d = sparklinePath(values, width, height);
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={`${d} L${width - 1},${height} L1,${height} Z`} fill={stroke} fillOpacity={0.12} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
