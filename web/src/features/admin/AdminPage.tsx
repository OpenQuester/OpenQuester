import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import type { User } from "@/api/types";
import { displayName, useMe } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Select, TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";

import { AdminGames } from "./AdminGames";
import { AdminPackages } from "./AdminPackages";
import { StaffEditor } from "./StaffEditor";
import {
  ADMIN_PAGE_SIZE,
  can,
  staffRoleOf,
  useAdminUsers,
  useDashboard,
  useSystemHealth,
  useUserAction,
  type UserAction,
  type UserQuery,
} from "./useAdmin";

type Tab = "overview" | "users" | "packages" | "games" | "system";

/**
 * Admin and moderator panel: stats, people, packages, live games and system
 * health. Each tab shows only when the account holds its permission.
 */
export function AdminPage() {
  const { t } = useTranslation();
  const me = useMe();
  const [tab, setTab] = useState<Tab>("overview");

  if (me.isLoading)
    return (
      <PageContainer>
        <Spinner label={t("common.loading")} />
      </PageContainer>
    );
  if (!me.data) return <Navigate to="/login" search={{ redirect: "/admin" }} />;
  const user = me.data;
  if (!can(user, "admin_panel_access"))
    return (
      <PageContainer width={720}>
        <Card data-testid="admin-no-access">
          <p className="m-0 font-semibold">{t("adminPanel.noAccess")}</p>
          <p className="mb-0 mt-2 text-soft">{t("adminPanel.noAccessHelp")}</p>
        </Card>
      </PageContainer>
    );

  const tabs = (
    [
      { id: "overview", label: t("adminPanel.overview"), show: true },
      {
        id: "users",
        label: t("adminPanel.users"),
        show: can(user, "view_users_info") || can(user, "get_all_users"),
      },
      {
        id: "packages",
        label: t("adminPanel.packages"),
        show: can(user, "delete_package") || can(user, "edit_package"),
      },
      { id: "games", label: t("adminPanel.games"), show: can(user, "manage_games") },
      { id: "system", label: t("adminPanel.system"), show: can(user, "view_system_health") },
    ] satisfies { id: Tab; label: string; show: boolean }[]
  ).filter((x) => x.show);
  const role = staffRoleOf(user);

  return (
    <PageContainer width={1240}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("adminPanel.title")}
          </h1>
          <span data-testid="admin-my-role">
            <Badge tone="accent">
              {t(role === "admin" ? "adminPanel.roleAdmin" : "adminPanel.roleModerator")}
            </Badge>
          </span>
        </div>
        <div role="tablist" aria-label={t("adminPanel.title")} className="flex flex-wrap gap-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "min-h-11 rounded-sm px-4 font-semibold",
                tab === x.id ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "overview" && <Overview />}
          {tab === "users" && <Users me={user} />}
          {tab === "packages" && <AdminPackages me={user} />}
          {tab === "games" && <AdminGames />}
          {tab === "system" && <System enabled={can(user, "view_system_health")} />}
        </div>
      </div>
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3">
      <span className="font-display text-2xl font-extrabold">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

const statGrid = "grid grid-cols-[repeat(auto-fill,minmax(min(160px,100%),1fr))] gap-3";

function Overview() {
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
        <Stat label={t("adminPanel.totalUsers")} value={d.totalUsers} />
        <Stat label={t("adminPanel.activeUsers")} value={d.activeUsers} />
        <Stat label={t("adminPanel.guests")} value={d.guestsUsers} />
        <Stat label={t("adminPanel.deletedUsers")} value={d.deletedUsers} />
        <Stat
          label={t("adminPanel.uptime")}
          value={formatDuration(d.systemHealth.serverUptimeSeconds)}
        />
        <Stat
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
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
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

function Users({ me }: { me: User }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState<UserQuery>({ search: "", status: "", userType: "all", page: 0 });
  const users = useAdminUsers(q, can(me, "view_users_info") || can(me, "get_all_users"));
  const action = useUserAction();

  useEffect(() => {
    const id = window.setTimeout(
      () => setQ((x) => (x.search === search ? x : { ...x, search, page: 0 })),
      250,
    );
    return () => window.clearTimeout(id);
  }, [search]);

  const pages = Math.max(1, Math.ceil((users.data?.pageInfo.total ?? 0) / ADMIN_PAGE_SIZE));
  const s = users.data?.stats;

  return (
    <div className="flex flex-col gap-5" data-testid="admin-users">
      {s && (
        <div className={statGrid}>
          <Stat label={t("adminPanel.totalUsers")} value={s.total} />
          <Stat label={t("adminPanel.activeUsers")} value={s.active} />
          <Stat label={t("adminPanel.bannedUsers")} value={s.banned} />
          <Stat label={t("adminPanel.deletedUsers")} value={s.deleted} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="adm-search" className="sr-only">
          {t("adminPanel.search")}
        </label>
        <TextInput
          id="adm-search"
          type="search"
          value={search}
          placeholder={t("adminPanel.search")}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-[1_1_240px] bg-surface"
        />
        <label htmlFor="adm-status" className="text-sm text-muted">
          {t("adminPanel.status")}
        </label>
        <Select
          id="adm-status"
          className="w-auto bg-surface"
          value={q.status}
          onChange={(e) =>
            setQ((x) => ({ ...x, status: e.target.value as UserQuery["status"], page: 0 }))
          }
        >
          <option value="">{t("adminPanel.anyStatus")}</option>
          <option value="active">{t("adminPanel.statusActive")}</option>
          <option value="banned">{t("adminPanel.statusBanned")}</option>
          <option value="deleted">{t("adminPanel.statusDeleted")}</option>
        </Select>
        <label htmlFor="adm-type" className="text-sm text-muted">
          {t("adminPanel.type")}
        </label>
        <Select
          id="adm-type"
          className="w-auto bg-surface"
          value={q.userType}
          onChange={(e) =>
            setQ((x) => ({ ...x, userType: e.target.value as UserQuery["userType"], page: 0 }))
          }
        >
          <option value="all">{t("adminPanel.typeAll")}</option>
          <option value="registered">{t("adminPanel.typeRegistered")}</option>
          <option value="guest">{t("adminPanel.typeGuest")}</option>
        </Select>
      </div>
      {action.isError && (
        <p role="alert" className="m-0 text-danger">
          {action.error instanceof Error ? action.error.message : t("adminPanel.actionFailed")}
        </p>
      )}
      {users.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : users.isError ? (
        <p role="alert" className="text-danger">
          {t("adminPanel.loadFailed")}
        </p>
      ) : users.data?.data.length === 0 ? (
        <p className="m-0 text-muted">{t("adminPanel.noUsers")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {users.data?.data.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              me={me}
              now={users.dataUpdatedAt}
              busy={action.isPending}
              onAction={(a) => action.mutate(a)}
            />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={q.page === 0}
            onClick={() => setQ((x) => ({ ...x, page: x.page - 1 }))}
          >
            {t("packages.prev")}
          </Button>
          <span className="text-sm text-muted">
            {t("packages.page", { page: q.page + 1, pages })}
          </span>
          <Button
            size="sm"
            disabled={q.page + 1 >= pages}
            onClick={() => setQ((x) => ({ ...x, page: x.page + 1 }))}
          >
            {t("packages.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  me,
  now,
  busy,
  onAction,
}: {
  user: User;
  me: User;
  /** When the list was fetched; mutes are compared against it. */
  now: number;
  busy: boolean;
  onAction: (a: UserAction) => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState<"ban" | "delete" | null>(null);
  const [editing, setEditing] = useState(false);
  const muted = user.mutedUntil && Date.parse(user.mutedUntil) > now;
  const self = user.id === me.id;
  const id = user.id;
  const role = staffRoleOf(user);
  const iAmAdmin = staffRoleOf(me) === "admin";
  // Only admins act on staff; the server refuses it too
  const canAct = !self && (role === "user" || iAmAdmin);
  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-line bg-surface px-4 py-3"
      data-testid="admin-user"
    >
      <Avatar name={displayName(user)} src={user.avatar} size={40} />
      <div className="flex min-w-0 flex-[1_1_200px] flex-col">
        <span className="truncate font-semibold">{displayName(user)}</span>
        <span className="truncate text-sm text-muted">
          #{user.id} · @{user.username}
          {user.email ? ` · ${user.email}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {role !== "user" && (
          <Badge tone="accent">
            {t(role === "admin" ? "adminPanel.roleAdmin" : "adminPanel.roleModerator")}
          </Badge>
        )}
        {user.isGuest && <Badge>{t("adminPanel.guest")}</Badge>}
        {user.isBanned && <Badge tone="danger">{t("adminPanel.statusBanned")}</Badge>}
        {user.isDeleted && <Badge tone="danger">{t("adminPanel.statusDeleted")}</Badge>}
        {muted && (
          <Badge tone="warning">
            {t("adminPanel.mutedUntil", {
              date: new Date(user.mutedUntil!).toLocaleString(),
            })}
          </Badge>
        )}
      </div>
      {canAct && (
        <div className="flex flex-wrap gap-2">
          {can(me, "manage_permissions") && !user.isDeleted && !user.isGuest && (
            <Button size="sm" aria-expanded={editing} onClick={() => setEditing((x) => !x)}>
              {t("adminPanel.editRole")}
            </Button>
          )}
          {can(me, "mute_player") &&
            !user.isDeleted &&
            (muted ? (
              <Button size="sm" disabled={busy} onClick={() => onAction({ kind: "unmute", id })}>
                {t("adminPanel.unmute")}
              </Button>
            ) : (
              <Select
                aria-label={t("adminPanel.mute")}
                className="min-h-10 w-auto py-0 text-sm"
                value=""
                disabled={busy}
                onChange={(e) => {
                  const hours = Number(e.target.value);
                  if (hours > 0) onAction({ kind: "mute", id, hours });
                }}
              >
                <option value="">{t("adminPanel.mute")}</option>
                <option value="1">{t("adminPanel.forHours", { count: 1 })}</option>
                <option value="24">{t("adminPanel.forHours", { count: 24 })}</option>
                <option value="168">{t("adminPanel.forWeek")}</option>
              </Select>
            ))}
          {can(me, "ban_users") &&
            !user.isDeleted &&
            (user.isBanned ? (
              <Button size="sm" disabled={busy} onClick={() => onAction({ kind: "unban", id })}>
                {t("adminPanel.unban")}
              </Button>
            ) : confirm === "ban" ? (
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setConfirm(null);
                  onAction({ kind: "ban", id });
                }}
              >
                {t("adminPanel.confirmBan")}
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setConfirm("ban")}>
                {t("adminPanel.ban")}
              </Button>
            ))}
          {can(me, "delete_another_user") &&
            (user.isDeleted ? (
              <Button size="sm" disabled={busy} onClick={() => onAction({ kind: "restore", id })}>
                {t("adminPanel.restore")}
              </Button>
            ) : confirm === "delete" ? (
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setConfirm(null);
                  onAction({ kind: "delete", id });
                }}
              >
                {t("adminPanel.confirmDelete")}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirm("delete")}>
                {t("adminPanel.delete")}
              </Button>
            ))}
          {confirm && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
      )}
      {editing && canAct && <StaffEditor user={user} onDone={() => setEditing(false)} />}
    </li>
  );
}

function System({ enabled }: { enabled: boolean }) {
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
        <Stat
          label={t("adminPanel.ping")}
          value={ping.ok ? t("adminPanel.ok") : t("adminPanel.down")}
        />
        <Stat label={t("adminPanel.eventLoop")} value={`${ping.eventLoopLagMs.toFixed(1)} ms`} />
        <Stat
          label={t("adminPanel.redis")}
          value={
            health.redis.connected ? `${ping.redis.responseMs ?? "–"} ms` : t("adminPanel.down")
          }
        />
        <Stat
          label={t("adminPanel.redisMemory")}
          value={`${health.redis.estimatedMemoryMB.toFixed(1)} MB`}
        />
        <Stat label={t("adminPanel.redisKeysLabel")} value={health.redis.keys} />
        <Stat label={t("adminPanel.uptime")} value={formatDuration(health.server.uptime)} />
        <Stat
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

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
