import { useState } from "react";
import type { User } from "@/api/types";
import { staffRoleOf } from "../useAdmin";

export function useUserModeration(user: User, me: User, now: number) {
  const [confirm, setConfirm] = useState<"ban" | "delete" | null>(null);
  const [editing, setEditing] = useState(false);
  const muted = user.mutedUntil && Date.parse(user.mutedUntil) > now;
  const self = user.id === me.id;
  const id = user.id;
  const role = staffRoleOf(user);
  const iAmAdmin = staffRoleOf(me) === "admin";
  const canAct = !self && (role === "user" || iAmAdmin);
  return { confirm, setConfirm, editing, setEditing, muted, id, role, canAct };
}
export type UserModeration = ReturnType<typeof useUserModeration>;
