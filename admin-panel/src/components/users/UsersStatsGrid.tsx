import { StatCard } from "@/components/common/StatCard";
import React from "react";

export interface UserStatCardData {
  name: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
  description?: string;
}

interface UsersStatsGridProps {
  stats: UserStatCardData[];
}

export const UsersStatsGrid: React.FC<UsersStatsGridProps> = ({ stats }) => {
  return (
    <div
      className="grid gap-6 grid-cols-1 sm:grid-cols-4 relative z-0"
      data-testid="users-stats-grid"
    >
      {stats.map((s) => (
        <div key={s.name} className="transition">
          <StatCard {...s} />
        </div>
      ))}
    </div>
  );
};
