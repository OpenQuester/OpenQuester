import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { Select, TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";
import { Pagination } from "@/ui/Pagination";
import type { UserQuery } from "./useAdmin";
import { AdminStat, statGrid } from "./AdminStats";
import { useAdminUserList } from "./users/useAdminUserList";
import { AdminUserRow } from "./users/AdminUserRow";
import { adminStyles } from "./adminStyles";

export function AdminUsers({ me }: { me: User }) {
  const { t } = useTranslation();
  const { search, setSearch, q, setQ, users, action, pages, s, setPage } = useAdminUserList(me);
  return (
    <div className={adminStyles.listPage} data-testid="admin-users">
      {s && (
        <div className={statGrid}>
          <AdminStat label={t("adminPanel.totalUsers")} value={s.total} />
          <AdminStat label={t("adminPanel.activeUsers")} value={s.active} />
          <AdminStat label={t("adminPanel.bannedUsers")} value={s.banned} />
          <AdminStat label={t("adminPanel.deletedUsers")} value={s.deleted} />
        </div>
      )}
      <div className={layoutStyles.spacedActions}>
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
        <ul className={adminStyles.list}>
          {users.data?.data.map((u) => (
            <AdminUserRow
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
      <Pagination page={q.page} pages={pages} setPage={setPage} />
    </div>
  );
}
