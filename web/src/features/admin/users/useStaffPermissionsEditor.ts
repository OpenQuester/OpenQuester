import { useState } from "react";
import type { User } from "@/api/types";
import {
  staffRoleOf,
  useRoles,
  useSetPermissions,
  type PermissionName,
  type StaffRole,
} from "../useAdmin";

export function useStaffPermissionsEditor(user: User, onDone: () => void) {
  const roles = useRoles(true);
  const save = useSetPermissions();
  const [picked, setPicked] = useState<Set<PermissionName>>(
    () => new Set(user.permissions.flatMap((p) => (p.name ? [p.name] : []))),
  );
  const role = staffRoleOf({ permissions: [...picked].map((name) => ({ id: 0, name })) });
  const applyRole = (id: StaffRole) => {
    const preset = roles.data?.roles.find((r) => r.id === id);
    if (preset) setPicked(new Set(preset.permissions));
  };
  const toggle = (name: PermissionName, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  const savePicked = () =>
    save.mutate({ id: user.id, permissions: [...picked] }, { onSuccess: onDone });
  return { roles, save, picked, role, applyRole, toggle, savePicked };
}
