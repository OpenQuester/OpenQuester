export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="24"
        height="24"
        rx="7"
        fill="none"
        stroke="var(--oq-info)"
        strokeWidth="2.5"
      />
      <circle cx="14" cy="14" r="5" fill="var(--oq-accent)" />
    </svg>
  );
}
