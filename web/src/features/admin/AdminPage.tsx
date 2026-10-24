import { layoutStyles } from "@/ui/layoutStyles";
import { Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer, PageTitle } from "@/ui/Page";
import { useMe } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { can, staffRoleOf } from "./useAdmin";
import { AdminOverview } from "./AdminOverview";
import { AdminSystem } from "./AdminSystem";
import { AdminUsers } from "./AdminUsers";
import { AdminGames } from "./AdminGames";
import { AdminPackages } from "./AdminPackages";
import { AdminStorage } from "./AdminStorage";

type Tab = "overview" | "users" | "packages" | "games" | "storage" | "system";

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
        // The users endpoint requires view_users_info
        show: can(user, "view_users_info"),
      },
      {
        id: "packages",
        label: t("adminPanel.packages"),
        show: can(user, "delete_package") || can(user, "edit_package"),
      },
      { id: "games", label: t("adminPanel.games"), show: can(user, "manage_games") },
      { id: "storage", label: t("adminPanel.storage"), show: true },
      { id: "system", label: t("adminPanel.system"), show: can(user, "view_system_health") },
    ] satisfies { id: Tab; label: string; show: boolean }[]
  ).filter((x) => x.show);
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : "overview";
  const role = staffRoleOf(user);

  return (
    <PageContainer width={1240}>
      <div className="flex flex-col gap-6">
        <div className={layoutStyles.spacedActions}>
          <PageTitle>{t("adminPanel.title")}</PageTitle>
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
              id={`admin-tab-${x.id}`}
              aria-controls="admin-panel"
              aria-selected={activeTab === x.id}
              tabIndex={activeTab === x.id ? 0 : -1}
              onClick={() => setTab(x.id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const index = tabs.findIndex((entry) => entry.id === x.id);
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
                const target = tabs[next]!;
                setTab(target.id);
                document.getElementById(`admin-tab-${target.id}`)?.focus();
              }}
              className={cn(
                "min-h-11 rounded-sm px-4 font-semibold",
                activeTab === x.id ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${activeTab}`}>
          {activeTab === "overview" && <AdminOverview />}
          {activeTab === "users" && <AdminUsers me={user} />}
          {activeTab === "packages" && <AdminPackages me={user} />}
          {activeTab === "games" && <AdminGames />}
          {activeTab === "storage" && <AdminStorage me={user} />}
          {activeTab === "system" && <AdminSystem enabled={can(user, "view_system_health")} />}
        </div>
      </div>
    </PageContainer>
  );
}
