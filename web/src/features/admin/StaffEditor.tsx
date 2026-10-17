import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { User } from "@/api/types";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";

import {
  staffRoleOf,
  useRoles,
  useSetPermissions,
  type PermissionName,
  type StaffRole,
} from "./useAdmin";

/**
 * Role and permission editor for one account (admins only). Picking a role
 * applies its preset; each permission can then be ticked on or off.
 */
export function StaffEditor({ user, onDone }: { user: User; onDone: () => void }) {
  const { t } = useTranslation();
  const roles = useRoles(true);
  const save = useSetPermissions();
  const [picked, setPicked] = useState<Set<PermissionName>>(
    () => new Set(user.permissions.flatMap((p) => (p.name ? [p.name] : []))),
  );

  if (roles.isLoading) return <Spinner label={t("common.loading")} />;
  if (!roles.data)
    return (
      <p role="alert" className="m-0 text-danger">
        {t("adminPanel.loadFailed")}
      </p>
    );

  const role = staffRoleOf({ permissions: [...picked].map((name) => ({ id: 0, name })) });
  const applyRole = (id: StaffRole) => {
    const preset = roles.data.roles.find((r) => r.id === id);
    if (preset) setPicked(new Set(preset.permissions));
  };
  const toggle = (name: PermissionName, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  return (
    <div
      className="flex w-full flex-col gap-4 border-t border-line pt-4"
      data-testid="staff-editor"
    >
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-x-4 gap-y-1">
          {roles.data.permissions.map((name) => (
            <label key={name} className="flex min-h-10 items-center gap-3">
              <input
                type="checkbox"
                checked={picked.has(name)}
                onChange={(e) => toggle(name, e.target.checked)}
                className="h-5 w-5 shrink-0 accent-[var(--oq-accent)]"
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
        <Button
          size="sm"
          variant="primary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({ id: user.id, permissions: [...picked] }, { onSuccess: onDone })
          }
        >
          {t("adminPanel.savePermissions")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
