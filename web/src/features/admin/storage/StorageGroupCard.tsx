import { useTranslation } from "react-i18next";
import type { AdminStorage as AdminStorageData } from "@/features/storage/useStorage";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { TextInput } from "@/ui/Field";
import { FIELDS, useGroupLimitsForm } from "./useStorageForms";

export function StorageGroupCard({
  limits,
  canEdit,
}: {
  limits: AdminStorageData["groups"][number];
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { save, draft, setDraft, parsed, invalid, dirty, submit } = useGroupLimitsForm(limits);
  return (
    <Card tone="raised" data-testid={`storage-group-${limits.group}`}>
      <form className="flex flex-col gap-3" onSubmit={submit}>
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
