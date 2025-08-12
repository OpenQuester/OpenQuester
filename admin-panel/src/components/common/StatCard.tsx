import { type ReactNode } from "react";

export interface StatTrend {
  value: number;
  isPositive: boolean;
}

export interface StatCardProps {
  name: string;
  value: string | number;
  icon: ReactNode;
  colorClass?: string; // tailwind bg classes
  trend?: StatTrend;
  description?: string;
}

export const StatCard = ({
  name,
  value,
  icon,
  colorClass = "bg-gradient-to-br from-primary-500 to-primary-600",
  description,
}: StatCardProps) => (
  <div className="card card-hover group w-full">
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
          >
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-secondaryText">{name}</p>
            <p className="text-2xl font-bold text-primaryText">{value}</p>
            <p className="text-xs text-mutedText mt-1">
              {description}&nbsp; {/* Non-breaking space for better layout */}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
