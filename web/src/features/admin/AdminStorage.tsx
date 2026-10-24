import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { useAdminStorage } from "@/features/storage/useStorage";
import { formatBytes } from "@/lib/format";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { can } from "./useAdmin";
import { StorageGroupCard } from "./storage/StorageGroupCard";
import { StorageUserRow } from "./storage/StorageUserRow";
import { adminStyles } from "./adminStyles";

export function AdminStorage({ me }: { me: User }) {
  const { t } = useTranslation();
  const storage = useAdminStorage(true);
  const canEdit = can(me, "manage_storage");
  if (storage.isLoading) return <Spinner label={t("common.loading")} />;
  if (!storage.data)
    return (
      <p role="alert" className="text-danger">
        {t("adminPanel.loadFailed")}
      </p>
    );
  const { bucket, groups, topUsers } = storage.data;
  return (
    <div className={adminStyles.listPage} data-testid="admin-storage">
      <Card>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{t("storage.bucket")}</span>
          <span className="font-display text-3xl font-extrabold">
            {formatBytes(bucket.usedBytes)}
            {bucket.quotaBytes !== null && (
              <span className="text-lg font-semibold text-muted">
                {" "}
                / {formatBytes(bucket.quotaBytes)}
              </span>
            )}
          </span>
          <span className="text-sm text-muted">
            {t("storage.bucketFiles", { count: bucket.fileCount })}
          </span>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-semibold">{t("storage.groupsTitle")}</h2>
        <p className="m-0 text-sm text-muted">{t("storage.groupsHelp")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <StorageGroupCard key={g.group} limits={g} canEdit={canEdit} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-semibold">{t("storage.usersTitle")}</h2>
        {topUsers.length === 0 ? (
          <p className="m-0 text-muted">{t("storage.noUsers")}</p>
        ) : (
          <ul className={adminStyles.list}>
            {topUsers.map((u) => (
              <StorageUserRow key={u.id} user={u} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
