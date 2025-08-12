import { memo } from "react";

import { type DashboardRecentTimeframe } from "@/types/dto";

const timeframeLabel = (tf: DashboardRecentTimeframe) => `${tf}d`;

interface TimeframeSelectorProps {
  value: DashboardRecentTimeframe;
  onChange: (tf: DashboardRecentTimeframe) => void;
  options: DashboardRecentTimeframe[];
  disabled?: boolean;
}

export const TimeframeSelector = memo(
  ({ value, onChange, options, disabled }: TimeframeSelectorProps) => {
    return (
      <div className="flex items-center gap-1 text-xs font-medium text-secondaryText">
        <span className="uppercase tracking-wide mr-1">Timeframe:</span>
        {options.map((d) => {
          const active = value === d;
          return (
            <button
              key={d}
              disabled={disabled}
              onClick={() => onChange(d)}
              className={`relative px-2 py-1 rounded-md border text-[11px] tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                  : "border-border hover:bg-hover"
              }`}
              aria-pressed={active}
            >
              {timeframeLabel(d)}
              {active && (
                <span className="absolute inset-0 rounded-md ring-1 ring-inset ring-primary-400/50 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    );
  }
);
TimeframeSelector.displayName = "TimeframeSelector";
