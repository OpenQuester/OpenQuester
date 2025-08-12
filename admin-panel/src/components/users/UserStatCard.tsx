import { Activity, Ban, Users } from "lucide-react";
import React, { memo } from "react";

interface UserStatsProps {
  stats: { total: number; active: number; deleted: number } | undefined;
}

const formatNumber = (n: number) => new Intl.NumberFormat().format(n);

export const UserStats = memo(({ stats }: UserStatsProps) => {
  const total = stats?.total ?? 0;
  const active = stats?.active ?? 0;
  const deleted = stats?.deleted ?? 0;
  return (
    <>
      <StatCard
        label="Total Users"
        value={formatNumber(total)}
        icon={<Users className="h-6 w-6 text-primary-600" />}
        description="All registered users"
      />
      <StatCard
        label="Active Users"
        value={formatNumber(active)}
        icon={<Activity className="h-6 w-6 text-success-600" />}
        description="Currently active accounts"
      />
      <StatCard
        label="Banned Users"
        value={formatNumber(deleted)}
        icon={<Ban className="h-6 w-6 text-error-600" />}
        description="Disabled / banned accounts"
      />
    </>
  );
});

UserStats.displayName = "UserStats";

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  icon: React.JSX.Element;
}

const StatCard = ({ label, value, description, icon }: StatCardProps) => (
  <div className="card" aria-label={label}>
    <div className="p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-secondaryText">{label}</p>
        <p className="mt-2 text-3xl font-bold text-primaryText">{value}</p>
        <p className="mt-1 text-xs text-mutedText">{description}</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center border border-border">
        {icon}
      </div>
    </div>
  </div>
);
