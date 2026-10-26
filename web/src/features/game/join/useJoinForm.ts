import { useTranslation } from "react-i18next";

import { useState, type FormEvent } from "react";
import { useGuestLogin, useMe } from "@/features/auth/useMe";
import type { JoinOptions } from "@/game/connection";

/** The owning panel keeps drafts even while preview loading temporarily hides the form. */
export function useJoinForm(
  needsPassword: boolean,
  onJoin: (options: JoinOptions) => void,
  joining: boolean,
  joinError: string | null = null,
) {
  const { t } = useTranslation();
  const me = useMe();
  const guest = useGuestLogin();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previousJoinError, setPreviousJoinError] = useState<string | null>(null);
  const [submittedRole, setSubmittedRole] = useState<JoinOptions["role"] | null>(null);
  const busy = joining || guest.isPending;
  // Keep feedback during retries and preview reloads until a new result replaces it.
  if (joinError !== previousJoinError) {
    setPreviousJoinError(joinError);
    if (joinError) {
      setError(joinError === "auth_failed" ? t("game.authFailed") : joinError);
    }
  }
  async function go(role: JoinOptions["role"], e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (needsPassword && !password.trim()) {
      setError(t("join.passwordRequired"));
      return;
    }
    if (needsPassword && !/^[A-Za-z0-9_-]{1,16}$/.test(password.trim())) {
      setError(t("join.passwordInvalid"));
      return;
    }
    setSubmittedRole(role);
    if (!me.data) {
      const trimmed = name.trim().replace(/\s+/g, " ");
      if (!trimmed) {
        setError(t("login.nameRequired"));
        return;
      }
      try {
        await guest.mutateAsync(trimmed);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    onJoin({ role, targetSlot: null, password: needsPassword ? password.trim() : null });
  }
  return { me, name, setName, password, setPassword, error, busy, submittedRole, go };
}
