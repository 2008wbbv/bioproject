/**
 * Inline SVG icon set (no emoji). Lucide-style 24x24 stroke icons drawn with
 * currentColor so they inherit text color and theme. `filled` switches a few icons
 * (e.g. star) to a solid fill.
 */
export type IconName =
  | "flask"
  | "star"
  | "settings"
  | "sun"
  | "moon"
  | "command"
  | "menu"
  | "search"
  | "close"
  | "plus"
  | "grid"
  | "layers"
  | "list"
  | "book"
  | "play"
  | "download"
  | "back"
  | "clock"
  | "tag"
  | "upload"
  | "note"
  | "check"
  | "beaker"
  | "share"
  | "alert"
  | "chevron"
  | "retry"
  | "x-circle";

const PATHS: Record<IconName, string> = {
  flask: "M9 3h6 M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3",
  star: "M12 2.5l2.9 6 6.6.6-5 4.3 1.5 6.4L12 16.9 6 20.8l1.5-6.4-5-4.3 6.6-.6z",
  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z",
  sun: "M12 4V2 M12 22v-2 M4 12H2 M22 12h-2 M5.6 5.6 4.2 4.2 M19.8 19.8l-1.4-1.4 M18.4 5.6l1.4-1.4 M4.2 19.8l1.4-1.4 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
  command:
    "M9 6a3 3 0 1 0-3 3h3V6z M15 6a3 3 0 1 1 3 3h-3V6z M9 18a3 3 0 1 1-3-3h3v3z M15 18a3 3 0 1 0 3-3h-3v3z M9 9h6v6H9z",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3",
  close: "M18 6 6 18 M6 6l12 12",
  plus: "M12 5v14 M5 12h14",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  layers: "M12 2 2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  list: "M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  play: "M6 4l13 8-13 8z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  back: "M19 12H5 M12 19l-7-7 7-7",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  tag: "M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7 7h.01",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  note: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  check: "M20 6 9 17l-5-5",
  beaker: "M4.5 3h15 M6 3v7l-3 8a2 2 0 0 0 1.9 2.7h12.2A2 2 0 0 0 21 18l-3-8V3 M6 14h12",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  alert: "M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01",
  chevron: "M6 9l6 6 6-6",
  retry: "M3 12a9 9 0 1 0 3-6.7L3 8 M3 4v4h4",
  "x-circle": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15 9l-6 6 M9 9l6 6",
};

const FILLED: ReadonlySet<IconName> = new Set(["star"]);

export function Icon({
  name,
  size = 16,
  filled = false,
  className,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  const solid = filled && FILLED.has(name);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].split(" M").map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : "M" + seg)} />
      ))}
    </svg>
  );
}
