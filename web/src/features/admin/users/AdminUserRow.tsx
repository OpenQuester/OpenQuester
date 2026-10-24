import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { displayName } from "@/features/auth/useMe";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { StaffPermissionsEditor } from "../StaffPermissionsEditor";
import type { UserAction } from "../useAdmin";
import { AdminUserActions } from "./AdminUserActions";
import { useUserModeration } from "./useUserModeration";
import { adminStyles } from "../adminStyles";

export function AdminUserRow({
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
  const moderation = useUserModeration(user, me, now);
  const { editing, setEditing, muted, role, canAct } = moderation;
  return (
    <li className={adminStyles.row} data-testid="admin-user">
      <Avatar name={displayName(user)} src={user.avatar} size={40} />
      <div className={layoutStyles.wrappingField}>
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
        <AdminUserActions
          user={user}
          me={me}
          busy={busy}
          onAction={onAction}
          moderation={moderation}
        />
      )}
      {editing && canAct && <StaffPermissionsEditor user={user} onDone={() => setEditing(false)} />}
    </li>
  );
}
