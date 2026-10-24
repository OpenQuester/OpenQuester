import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PackageCard } from "@/features/packages/usePackages";
import { timeAgo } from "@/lib/format";
import { Button } from "@/ui/Button";
import { adminStyles } from "../adminStyles";

export function AdminPackageRow({
  pkg,
  canEdit,
  canDelete,
  busy,
  onEdit,
  onDelete,
}: {
  pkg: PackageCard;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className={adminStyles.row} data-testid="admin-package">
      <div className={adminStyles.packageSummary}>
        <span className="truncate font-semibold">{pkg.title}</span>
        <span className="truncate text-sm text-muted">
          #{pkg.id} · {t("adminPanel.byAuthor", { name: pkg.author.username })} ·{" "}
          {timeAgo(pkg.createdAt)}
          {pkg.roundsCount != null &&
            ` · ${t("adminPanel.packageSize", { rounds: pkg.roundsCount, questions: pkg.questionsCount ?? 0 })}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button size="sm" disabled={busy} onClick={onEdit}>
            {t("adminPanel.edit")}
          </Button>
        )}
        {canDelete &&
          (confirm ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setConfirm(false);
                  onDelete();
                }}
              >
                {t("adminPanel.confirmDelete")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                {t("common.cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("adminPanel.deleteNamed", { name: pkg.title })}
              onClick={() => setConfirm(true)}
            >
              {t("adminPanel.delete")}
            </Button>
          ))}
      </div>
    </li>
  );
}
