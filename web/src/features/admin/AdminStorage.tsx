import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { User } from "@/api/types";
import {
  fromMbInput,
  toMbInput,
  useAdminStorage,
  useSetGroupLimits,
  useSetUserQuota,
  type AdminStorage as AdminStorageData,
  type StorageLimits,
} from "@/features/storage/useStorage";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";

import { can } from "./useAdmin";

const FIELDS = [
  "userQuotaBytes",
  "packageBytes",
  "imageBytes",
  "audioBytes",
  "videoBytes",
] as const;

/** Bucket usage, limits per group and the heaviest users with their own quotas. */
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
    <div className="flex flex-col gap-5" data-testid="admin-storage">
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
            <GroupCard key={g.group} limits={g} canEdit={canEdit} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-semibold">{t("storage.usersTitle")}</h2>
        {topUsers.length === 0 ? (
          <p className="m-0 text-muted">{t("storage.noUsers")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {topUsers.map((u) => (
              <UserRow key={u.id} user={u} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GroupCard({
  limits,
  canEdit,
}: {
  limits: AdminStorageData["groups"][number];
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const save = useSetGroupLimits();
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f, toMbInput(limits[f])])),
  );
  const parsed = Object.fromEntries(FIELDS.map((f) => [f, fromMbInput(draft[f] ?? "")]));
  const invalid = FIELDS.some((f) => parsed[f] === undefined);
  const dirty = FIELDS.some((f) => parsed[f] !== limits[f]);
  return (
    <Card tone="raised" data-testid={`storage-group-${limits.group}`}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid || !dirty) return;
          save.mutate({ group: limits.group, limits: parsed as StorageLimits });
        }}
      >
        <span className="font-semibold">{t(`storage.groups.${limits.group}`)}</span>
        {FIELDS.map((f) => (
          <label key={f} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-soft">{t(`storage.fields.${f}`)}</span>
            <span className="flex items-center gap-2">
              <TextInput
                inputMode="decimal"
                value={draft[f]}
                disabled={!canEdit}
                placeholder={t("storage.noLimit")}
                aria-invalid={parsed[f] === undefined}
                onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                className={cn(
                  "min-h-10 w-28 bg-surface text-right",
                  parsed[f] === undefined && "border-danger",
                )}
              />
              <span className="w-6 text-muted">MB</span>
            </span>
          </label>
        ))}
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="accent"
              type="submit"
              disabled={invalid || !dirty || save.isPending}
              inactive={invalid || !dirty}
            >
              {t("storage.save")}
            </Button>
            {save.isSuccess && !dirty && (
              <span className="text-sm text-success">{t("storage.saved")}</span>
            )}
            {save.isError && (
              <span role="alert" className="text-sm text-danger">
                {save.error.message}
              </span>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}

function UserRow({
  user,
  canEdit,
}: {
  user: AdminStorageData["topUsers"][number];
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const save = useSetUserQuota();
  const [value, setValue] = useState(user.quotaOverridden ? toMbInput(user.quotaBytes) : "");
  const bytes = fromMbInput(value);
  const over = user.quotaBytes !== null && user.usedBytes > user.quotaBytes;
  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-[12px] bg-surface-2 px-4 py-3"
      data-testid="storage-user"
    >
      <div className="flex min-w-[180px] flex-1 flex-col">
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
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (bytes === undefined) return;
            save.mutate({ id: user.id, quotaBytes: bytes });
          }}
        >
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
    </li>
  );
}
