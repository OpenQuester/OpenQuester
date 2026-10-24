import { useTranslation } from "react-i18next";
import { displayName } from "@/features/auth/useMe";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { useDashboard } from "./useAdmin";
import { AdminStat, statGrid } from "./AdminStats";
import { formatDuration } from "./format";
import { adminStyles } from "./adminStyles";

export function AdminOverview() {
  const { t } = useTranslation();
  const dash = useDashboard(true);
  if (dash.isLoading) return <Spinner label={t("common.loading")} />;
  if (dash.isError || !dash.data)
    return (
      <p role="alert" className="text-danger">
        {t("adminPanel.loadFailed")}
      </p>
    );
  const d = dash.data;
  return (
    <div className="flex flex-col gap-6" data-testid="admin-overview">
      <div className={statGrid}>
        <AdminStat label={t("adminPanel.totalUsers")} value={d.totalUsers} />
        <AdminStat label={t("adminPanel.activeUsers")} value={d.activeUsers} />
        <AdminStat label={t("adminPanel.guests")} value={d.guestsUsers} />
        <AdminStat label={t("adminPanel.deletedUsers")} value={d.deletedUsers} />
        <AdminStat
          label={t("adminPanel.uptime")}
          value={formatDuration(d.systemHealth.serverUptimeSeconds)}
        />
        <AdminStat
          label={t("adminPanel.redis")}
          value={
            d.systemHealth.redisConnected
              ? t("adminPanel.redisKeys", { count: d.systemHealth.redisKeys })
              : t("adminPanel.down")
          }
        />
      </div>
      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-semibold">{t("adminPanel.recentUsers")}</h2>
        <ul className={adminStyles.list}>
          {d.recentUsers.map((u) => (
            <li key={u.id} className="flex items-center gap-3">
              <Avatar name={displayName(u)} src={u.avatar} size={36} />
              <span className="min-w-0 flex-1 truncate font-medium">{displayName(u)}</span>
              {u.isGuest && <Badge>{t("adminPanel.guest")}</Badge>}
              <span className="text-sm text-muted">{timeAgo(u.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
