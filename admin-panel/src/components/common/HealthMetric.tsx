import { type ReactNode } from "react";

export enum HealthStatus {
  HEALTHY = "healthy",
  WARNING = "warning",
  ERROR = "error",
}

export interface HealthMetricProps {
  title: string;
  value: string | number;
  status: HealthStatus;
  icon: ReactNode;
  description?: string;
  trend?: { value: number; isUp: boolean };
}

const statusBg = (s: HealthStatus) =>
  s === HealthStatus.WARNING
    ? "bg-gradient-to-br from-warning-500 to-warning-600"
    : s === HealthStatus.ERROR
    ? "bg-gradient-to-br from-error-500 to-error-600"
    : "bg-gradient-to-br from-green-500 to-green-600";

const statusText = (s: HealthStatus) =>
  s === HealthStatus.WARNING
    ? "text-warning-600"
    : s === HealthStatus.ERROR
    ? "text-error-600"
    : "text-success-500"; // lighter for dark background contrast

const statusBadge = (s: HealthStatus) =>
  s === HealthStatus.WARNING
    ? "badge-warning"
    : s === HealthStatus.ERROR
    ? "badge-error"
    : "badge-success";

export const HealthMetric = ({
  title,
  value,
  status,
  icon,
  description,
}: HealthMetricProps) => {
  const bg = statusBg(status);
  const text = statusText(status);
  const badge = statusBadge(status);
  return (
    <div className="card card-hover">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div
              className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}
            >
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium text-secondaryText">{title}</p>
              <p className={`text-2xl font-bold ${text}`}>{value}</p>
              {description && (
                <p className="text-xs text-mutedText mt-1">{description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`badge ${badge}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
