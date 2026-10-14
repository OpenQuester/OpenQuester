import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { api, unwrap } from "@/api/client";
import type { AgeRestriction } from "@/api/types";
import { displayName, useMe } from "@/features/auth/useMe";
import { setJoinIntent } from "@/features/game/joinIntent";
import { gamesKey } from "@/features/home/useGames";
import { summarize, usePackage } from "@/features/packages/usePackages";
import { Button } from "@/ui/Button";
import { FieldError, Label, Select, TextInput } from "@/ui/Field";
import { BackIcon, EyeIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

export function CreateGamePage() {
  const { t } = useTranslation();
  const { packageId } = useSearch({ from: "/shell/games/new" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const pkg = usePackage(packageId);
  const [title, setTitle] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<AgeRestriction>("NONE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const defaultTitle = me.data ? t("create.defaultTitle", { name: displayName(me.data) }) : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!packageId) return;
    const finalTitle = (title.trim() || defaultTitle).slice(0, 100);
    if (finalTitle.length < 3) {
      setError(t("create.titleTooShort"));
      return;
    }
    if (isPrivate && password && !/^[A-Za-z0-9_-]{1,16}$/.test(password)) {
      setError(t("create.passwordInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const game = await unwrap(
        api.POST("/v1/games", {
          body: {
            title: finalTitle,
            packageId,
            isPrivate,
            ageRestriction: age,
            maxPlayers,
            ...(isPrivate ? { password: password || null } : {}),
          },
        }),
      );
      setJoinIntent(game.id, { role: "showman" });
      void qc.invalidateQueries({ queryKey: gamesKey });
      await navigate({ to: "/games/$gameId", params: { gameId: game.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (me.isFetched && !me.data) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: `/games/new${packageId ? `?packageId=${packageId}` : ""}` }}
        replace
      />
    );
  }

  if (!packageId) {
    return (
      <PageContainer width={720}>
        <p className="text-muted">{t("create.noPackage")}</p>
        <Link to="/packages">{t("create.pickPackage")}</Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer width={1100}>
      <Link
        to="/packages"
        search={{ id: packageId }}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-muted no-underline"
      >
        <BackIcon /> {t("create.back")}
      </Link>
      <div className="flex flex-wrap items-start gap-6">
        <form
          onSubmit={onSubmit}
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-5"
          noValidate
        >
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("create.title")}
          </h1>
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-title">{t("create.name")}</Label>
              <TextInput
                id="g-title"
                value={title}
                maxLength={100}
                placeholder={defaultTitle}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-[1_1_200px] flex-col gap-2">
                <Label htmlFor="g-max">{t("create.players")}</Label>
                <Select
                  id="g-max"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                >
                  {Array.from({ length: 14 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {t("create.upTo", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-[1_1_200px] flex-col gap-2">
                <Label htmlFor="g-age">{t("create.age")}</Label>
                <Select
                  id="g-age"
                  value={age}
                  onChange={(e) => setAge(e.target.value as AgeRestriction)}
                >
                  <option value="NONE">{t("create.ageNone")}</option>
                  <option value="A12">12+</option>
                  <option value="A16">16+</option>
                  <option value="A18">18+</option>
                </Select>
              </div>
            </div>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[15px] font-semibold">{t("create.whoCanJoin")}</legend>
              <div role="radiogroup" aria-label={t("create.whoCanJoin")} className="flex gap-2">
                {[false, true].map((priv) => (
                  <button
                    key={String(priv)}
                    type="button"
                    role="radio"
                    aria-checked={isPrivate === priv}
                    onClick={() => setIsPrivate(priv)}
                    className={cn(
                      "min-h-12 flex-1 rounded-[12px] px-3 text-[15px] font-semibold text-text",
                      isPrivate === priv
                        ? "border-2 border-accent bg-accent-surface"
                        : "border border-line-strong",
                    )}
                  >
                    {priv ? t("create.private") : t("create.public")}
                  </button>
                ))}
              </div>
            </fieldset>
            {isPrivate && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="g-pass">{t("create.password")}</Label>
                <TextInput
                  id="g-pass"
                  value={password}
                  maxLength={16}
                  autoComplete="off"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("create.passwordPlaceholder")}
                />
                <p className="m-0 text-sm text-muted">{t("create.passwordHelp")}</p>
              </div>
            )}
          </section>
          <FieldError>{error}</FieldError>
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="self-start"
              disabled={busy || !pkg.data}
            >
              {busy ? t("create.creating") : t("create.submit")}
            </Button>
            <p className="m-0 text-sm text-muted">{t("create.youAreShowman")}</p>
          </div>
        </form>
        <aside
          aria-label={t("create.package")}
          className="flex flex-[1_1_300px] flex-col gap-2.5 rounded-lg border border-line-strong bg-surface-2 p-6"
        >
          <span className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            {t("create.package")}
          </span>
          {pkg.isLoading ? (
            <Spinner />
          ) : pkg.data ? (
            <>
              <span className="text-xl font-semibold [overflow-wrap:anywhere]">
                {pkg.data.title}
              </span>
              <span className="text-sm text-soft">
                {t("packages.counts", {
                  rounds: pkg.data.rounds.length,
                  questions: summarize(pkg.data).questionCount,
                })}
              </span>
            </>
          ) : (
            <span role="alert" className="text-danger">
              {t("packages.loadFailed")}
            </span>
          )}
          <Link
            to="/packages/$packageId/preview"
            params={{ packageId: String(packageId) }}
            className="inline-flex items-center gap-1.5 text-sm"
            data-testid="create-preview"
          >
            <EyeIcon size={16} />
            {t("packages.preview")}
          </Link>
          <Link to="/packages" search={{ id: packageId }} className="text-sm">
            {t("create.changePackage")}
          </Link>
        </aside>
      </div>
    </PageContainer>
  );
}
