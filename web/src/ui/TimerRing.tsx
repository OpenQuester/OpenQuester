import { formatSeconds } from "@/lib/timer";

const R = 24;
const C = 2 * Math.PI * R;

/** Circular countdown. `fraction` is the part of the time still left (0..1). */
export function TimerRing({
  fraction,
  leftMs,
  color = "var(--oq-accent)",
  label,
  size = 56,
}: {
  fraction: number | null;
  leftMs: number | null;
  color?: string;
  /** Text inside the ring when there is no countdown (e.g. ✓, …, 2/3). */
  label?: string;
  size?: number;
}) {
  const offset = fraction == null ? 0 : C * (1 - Math.max(0, Math.min(1, fraction)));
  const text = label ?? formatSeconds(leftMs);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      role="img"
      aria-label={text ? `${text}` : undefined}
      className="shrink-0"
    >
      <circle cx="28" cy="28" r={R} fill="none" stroke="var(--oq-surface-3)" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 250ms linear" }}
      />
      <text
        x="28"
        y="33"
        textAnchor="middle"
        fill="var(--oq-text)"
        fontFamily="var(--oq-font-mono)"
        fontWeight="700"
        fontSize={text.length > 3 ? 12 : 15}
      >
        {text}
      </text>
    </svg>
  );
}
