import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { FieldError, Label, TextInput } from "@/ui/Field";

import { startDiscordLogin, useDiscordClientId } from "./discord";
import { useGuestLogin } from "./useMe";

export function LoginPage() {
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

  return (
    <PageContainer width={560}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("login.title")}
          </h1>
          <p className="m-0 text-muted">{t("login.subtitle")}</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <Label htmlFor="guest-name">{t("login.nameLabel")}</Label>
            <TextInput
              id="guest-name"
              autoComplete="nickname"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("login.namePlaceholder")}
              aria-describedby={error ? "guest-error" : "guest-help"}
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            <p id="guest-help" className="m-0 text-sm text-muted">
              {t("login.nameHelp")}
            </p>
            <FieldError id="guest-error">{error}</FieldError>
            <Button type="submit" variant="accent" size="lg" disabled={guest.isPending}>
              {guest.isPending ? t("login.signingIn") : t("login.continueGuest")}
            </Button>
          </form>
        </Card>
        {discordClientId && (
          <Card tone="raised" className="flex flex-col gap-3">
            <p className="m-0 text-soft">{t("login.discordHelp")}</p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void startDiscordLogin(discordClientId, target)}
            >
              {t("login.discord")}
            </Button>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
