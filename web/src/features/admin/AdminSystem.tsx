import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";
import { useSystemHealth } from "./useAdmin";
import { AdminStat, statGrid } from "./AdminStats";
import { formatDuration } from "./format";

export function AdminSystem({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const sys = useSystemHealth(enabled);
  if (!enabled) return <p className="m-0 text-muted">{t("adminPanel.noHealthAccess")}</p>;
  if (sys.isLoading) return <Spinner label={t("common.loading")} />;
  if (sys.isError || !sys.data)
    return (
      <p role="alert" className="text-danger">
        {t("adminPanel.loadFailed")}
      </p>
    );
  const { health, ping } = sys.data;
  return (
    <div className="flex flex-col gap-4" data-testid="admin-system">
      <div className={statGrid}>
        <AdminStat
          label={t("adminPanel.ping")}
          value={ping.ok ? t("adminPanel.ok") : t("adminPanel.down")}
        />
        <AdminStat
          label={t("adminPanel.eventLoop")}
          value={`${ping.eventLoopLagMs.toFixed(1)} ms`}
        />
        <AdminStat
          label={t("adminPanel.redis")}
          value={
            health.redis.connected ? `${ping.redis.responseMs ?? "–"} ms` : t("adminPanel.down")
          }
        />
        <AdminStat
          label={t("adminPanel.redisMemory")}
          value={`${health.redis.estimatedMemoryMB.toFixed(1)} MB`}
        />
        <AdminStat label={t("adminPanel.redisKeysLabel")} value={health.redis.keys} />
        <AdminStat label={t("adminPanel.uptime")} value={formatDuration(health.server.uptime)} />
        <AdminStat
          label={t("adminPanel.memory")}
          value={`${mb(health.server.memory.used)} / ${mb(health.server.memory.total)}`}
        />
      </div>
      <div>
        <Button size="sm" onClick={() => void sys.refetch()} disabled={sys.isFetching}>
          {t("adminPanel.refresh")}
        </Button>
      </div>
    </div>
  );
}

/** The server reports memory in MB. */
const mb = (megabytes: number) => `${Math.round(megabytes)} MB`;
