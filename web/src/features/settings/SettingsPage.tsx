import { Navigate, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import type { User } from "@/api/types";
import { displayName, useLogout, useMe, useUpdateProfile } from "@/features/auth/useMe";
import { LANGUAGES, type LanguageId } from "@/i18n";
import { THEMES } from "@/theme/themes";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { FieldError, Label, Select, TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";

import { StatsSummary } from "@/features/stats/StatsSummary";

import { AvatarPicker } from "./AvatarPicker";
import { useSettings } from "./settingsStore";

export function SettingsPage() {
  const me = useMe();
  if (me.isLoading)
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );
  if (!me.data) return <Navigate to="/login" search={{ redirect: "/settings" }} />;
  return <SettingsForm user={me.data} />;
}

function SettingsForm({ user }: { user: User }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const update = useUpdateProfile();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState(() => displayName(user));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = { data: user };

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
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <PageContainer width={880}>
      <div className="flex flex-col gap-6">
        <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
          {t("settings.title")}
        </h1>

        <Card>
          <form onSubmit={onSave} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={displayName(me.data)} src={me.data.avatar} size={72} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-semibold">{displayName(me.data)}</span>
                <span className="text-sm text-muted">
                  {me.data.isGuest ? t("settings.guestAccount") : `@${me.data.username}`}
                </span>
              </div>
              <AvatarPicker />
            </div>
            <Label htmlFor="s-name">{t("settings.displayName")}</Label>
            <div className="flex flex-wrap gap-3">
              <TextInput
                id="s-name"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                className="flex-[1_1_240px]"
              />
              <Button type="submit" variant="primary" disabled={update.isPending}>
                {saved ? t("settings.saved") : t("settings.save")}
              </Button>
            </div>
            <FieldError>{error}</FieldError>
          </form>
        </Card>

        <Card>
          <StatsSummary />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="m-0 text-xl font-semibold">{t("settings.look")}</h2>
          <div
            role="radiogroup"
            aria-label={t("settings.theme")}
            className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3"
          >
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                role="radio"
                aria-checked={settings.theme === th.id}
                aria-disabled={!th.available || undefined}
                onClick={() => th.available && settings.update({ theme: th.id })}
                className={cn(
                  "flex min-h-16 flex-col items-start gap-1 rounded-md px-4 py-3 text-left text-text",
                  settings.theme === th.id
                    ? "border-2 border-accent bg-accent-surface"
                    : "border border-line-strong",
                  !th.available && "cursor-not-allowed opacity-60",
                )}
              >
                <span className="font-semibold">{t(th.labelKey)}</span>
                {!th.available && <Badge tone="neutral">{t("settings.comingLater")}</Badge>}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="s-lang">{t("settings.language")}</Label>
            <Select
              id="s-lang"
              className="max-w-xs"
              value={settings.language}
              onChange={(e) => settings.update({ language: e.target.value as LanguageId })}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="m-0 text-xl font-semibold">{t("settings.feel")}</h2>
          <Toggle
            label={t("settings.sound")}
            checked={settings.sound}
            onChange={(v) => settings.update({ sound: v })}
          />
          <Toggle
            label={t("settings.reduceMotion")}
            checked={settings.reduceMotion}
            onChange={(v) => settings.update({ reduceMotion: v })}
          />
          <label htmlFor="s-vol" className="font-semibold">
            {t("settings.volume")}
          </label>
          <input
            id="s-vol"
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => settings.update({ volume: Number(e.target.value) / 100 })}
            className="max-w-sm accent-[var(--oq-accent)]"
          />
        </Card>

        <div>
          <Button
            variant="danger"
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => void navigate({ to: "/" }) })
            }
          >
            {t("settings.signOut")}
          </Button>
          {me.data.isGuest && (
            <p className="mt-2 text-sm text-muted">{t("settings.guestSignOutHelp")}</p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[var(--oq-accent)]"
      />
      {label}
    </label>
  );
}
