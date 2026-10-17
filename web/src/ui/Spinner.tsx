export function Spinner({ label, size = 24 }: { label?: string; size?: number }) {
  return (
    <span role="status" className="inline-flex items-center gap-3 text-muted">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="animate-spin"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="var(--oq-border-strong)"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="var(--oq-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Spinner in the middle of the screen, for full-page waits. */
export function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Spinner label={label} size={32} />
    </div>
  );
}
