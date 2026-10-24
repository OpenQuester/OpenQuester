import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDiscordClientId } from "./discord";
import { useGuestLogin } from "./useMe";

export function useLoginForm() {
  const { t } = useTranslation();
  const { redirect } = useSearch({ from: "/shell/login" });
  const navigate = useNavigate();
  const guest = useGuestLogin();
  const discordClientId = useDiscordClientId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const target =
    redirect && redirect.startsWith("/") && !redirect.startsWith("/login") ? redirect : "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError(t("login.nameRequired"));
      return;
    }
    setError(null);
    try {
      await guest.mutateAsync(trimmed);
      await navigate({ to: target });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return { name, setName, error, guest, discordClientId, target, onSubmit };
}
