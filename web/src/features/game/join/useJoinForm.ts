import { useTranslation } from "react-i18next";

import { useState, type FormEvent } from "react";
import { useGuestLogin, useMe } from "@/features/auth/useMe";
import type { JoinOptions } from "@/game/connection";

/** The owning panel keeps drafts even while preview loading temporarily hides the form. */
export function useJoinForm(needsPassword: boolean, onJoin: (options: JoinOptions) => void) {
  const { t } = useTranslation();
  const me = useMe();
  const guest = useGuestLogin();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function go(role: JoinOptions["role"], e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (needsPassword && !password.trim()) {
      setError(t("join.passwordRequired"));
      return;
    }
    if (needsPassword && !/^[A-Za-z0-9_-]{1,16}$/.test(password.trim())) {
      setError(t("join.passwordInvalid"));
      return;
    }
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
  return { me, guest, name, setName, password, setPassword, error, go };
}
