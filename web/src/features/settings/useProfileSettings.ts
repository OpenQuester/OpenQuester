import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { displayName, useLogout, useUpdateProfile } from "@/features/auth/useMe";
import { useSettings } from "./settingsStore";

export function useProfileSettings(user: User) {
  const { t } = useTranslation();
  const settings = useSettings();
  const update = useUpdateProfile();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState(() => displayName(user));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (savedAt === null) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2500);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError(t("settings.nameRequired"));
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ name: trimmed });
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    settings,
    update,
    logout,
    navigate,
    name,
    setName,
    saved: savedAt !== null,
    error,
    user,
    onSave,
  };
}
export type ProfileSettings = ReturnType<typeof useProfileSettings>;
