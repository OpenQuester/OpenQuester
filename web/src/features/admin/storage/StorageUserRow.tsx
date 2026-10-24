import { adminStyles } from "../adminStyles";
import { useTranslation } from "react-i18next";
import type { AdminStorage as AdminStorageData } from "@/features/storage/useStorage";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { useUserQuotaForm } from "./useStorageForms";

export function StorageUserRow({
  user,
  canEdit,
}: {
  user: AdminStorageData["topUsers"][number];
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { save, value, setValue, bytes, over, submit } = useUserQuotaForm(user);
  return (
    <li className={adminStyles.userQuota} data-testid="storage-user">
      <div className={adminStyles.quotaSummary}>
        <span className="font-semibold [overflow-wrap:anywhere]">{user.username}</span>
        <span className={cn("text-sm", over ? "text-danger" : "text-muted")}>
          {user.quotaBytes === null
            ? t("storage.usedNoLimit", { used: formatBytes(user.usedBytes) })
            : t("storage.used", {
                used: formatBytes(user.usedBytes),
                quota: formatBytes(user.quotaBytes),
              })}
        </span>
      </div>
      <Badge tone={user.quotaOverridden ? "accent" : "neutral"}>
        {user.quotaOverridden ? t("storage.ownQuota") : t(`storage.groups.${user.group}`)}
      </Badge>
      {canEdit && (
        <form className="flex items-center gap-2" onSubmit={submit}>
          <label className="sr-only" htmlFor={`quota-${user.id}`}>
            {t("storage.ownQuotaLabel", { name: user.username })}
          </label>
          <TextInput
            id={`quota-${user.id}`}
            inputMode="decimal"
            value={value}
            placeholder={t("storage.groupDefault")}
            onChange={(e) => setValue(e.target.value)}
            className={cn(
              "min-h-10 w-32 bg-surface text-right",
              bytes === undefined && "border-danger",
            )}
          />
          <span className="text-sm text-muted">MB</span>
          <Button size="sm" type="submit" disabled={bytes === undefined || save.isPending}>
            {t("storage.save")}
          </Button>
        </form>
      )}
      {save.isError && (
        <p role="alert" className="m-0 text-sm text-danger">
          {save.error.message}
        </p>
      )}
    </li>
  );
}
