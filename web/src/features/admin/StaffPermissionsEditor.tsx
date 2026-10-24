import { adminStyles } from "./adminStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";
import type { StaffRole } from "./useAdmin";
import { useStaffPermissionsEditor } from "./users/useStaffPermissionsEditor";

export function StaffPermissionsEditor({ user, onDone }: { user: User; onDone: () => void }) {
  const { t } = useTranslation();
  const { roles, save, picked, role, applyRole, toggle, savePicked } = useStaffPermissionsEditor(
    user,
    onDone,
  );
  if (roles.isLoading) return <Spinner label={t("common.loading")} />;
  if (!roles.data)
    return (
      <p role="alert" className="m-0 text-danger">
        {t("adminPanel.loadFailed")}
      </p>
    );
  return (
    <div className={adminStyles.staffPermissions} data-testid="staff-editor">
      <div className={layoutStyles.spacedActions}>
        <label htmlFor={`role-${user.id}`} className="font-semibold">
          {t("adminPanel.role")}
        </label>
        <Select
          id={`role-${user.id}`}
          className="w-auto bg-surface"
          value={role}
          onChange={(e) => applyRole(e.target.value as StaffRole)}
        >
          <option value="user">{t("adminPanel.roleUser")}</option>
          <option value="moderator">{t("adminPanel.roleModerator")}</option>
          <option value="admin">{t("adminPanel.roleAdmin")}</option>
        </Select>
        <span className="text-sm text-muted">{t(`adminPanel.roleHelp.${role}`)}</span>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-sm text-muted">{t("adminPanel.permissions")}</legend>
        <div className={adminStyles.permissionGrid}>
          {roles.data.permissions.map((name) => (
            <label key={name} className="flex min-h-10 items-center gap-3">
              <input
                type="checkbox"
                checked={picked.has(name)}
                onChange={(e) => toggle(name, e.target.checked)}
                className={adminStyles.permissionCheckbox}
              />
              <span>{t(`adminPanel.perm.${name}`, { defaultValue: name })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {save.isError && (
        <p role="alert" className="m-0 text-danger">
          {save.error instanceof Error ? save.error.message : t("adminPanel.actionFailed")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={save.isPending} onClick={savePicked}>
          {t("adminPanel.savePermissions")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
