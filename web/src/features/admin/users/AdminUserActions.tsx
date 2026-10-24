import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Field";
import { can, type UserAction } from "../useAdmin";
import type { UserModeration } from "./useUserModeration";

export function AdminUserActions({
  user,
  me,
  busy,
  onAction,
  moderation,
}: {
  user: User;
  me: User;
  busy: boolean;
  onAction: (action: UserAction) => void;
  moderation: UserModeration;
}) {
  const { t } = useTranslation();
  const { confirm, setConfirm, editing, setEditing, muted, id } = moderation;
  return (
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
  );
}
