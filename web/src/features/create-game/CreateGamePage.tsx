import { createGameStyles } from "./createGameStyles";
import { Link, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageContainer, PageTitle } from "@/ui/Page";
import { UploadUnfinished } from "@/features/packages/UploadUnfinished";
import { Button } from "@/ui/Button";
import { FieldError } from "@/ui/Field";
import { BackIcon } from "@/ui/icons";
import { GameRules } from "./GameRules";
import { GameSetupFields } from "./GameSetupFields";
import { GamePackagePreview } from "./GamePackagePreview";
import { useCreateGame } from "./useCreateGame";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";
import { GameTimers } from "./GameTimers";

const tabs = ["general", "rules", "timers"] as const;

export function CreateGamePage() {
  const { t } = useTranslation();
  const form = useCreateGame();
  const [tab, setTab] = useState<(typeof tabs)[number]>("general");
  const { packageId, me, pkg, settings, setSettings, error, busy, unfinished, onSubmit } = form;
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
      <Link to="/packages" search={{ id: packageId }} className={createGameStyles.backLink}>
        <BackIcon /> {t("create.back")}
      </Link>
      <div className="flex flex-wrap items-start gap-6">
        <form
          onSubmit={(event) => void onSubmit(event, () => setTab("general"))}
          className={createGameStyles.settingsColumn}
          noValidate
        >
          <PageTitle>{t("create.title")}</PageTitle>
          <div
            role="tablist"
            aria-label={t("create.title")}
            className="flex gap-1 rounded-md border border-line bg-surface p-1"
          >
            {tabs.map((id) => (
              <button
                key={id}
                id={`create-tab-${id}`}
                type="button"
                role="tab"
                aria-controls={`create-panel-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={onChoiceKeyDown}
                className={cn(
                  "min-h-10 flex-1 rounded-sm px-2 text-sm font-semibold hover:bg-surface-3",
                  tab === id ? "bg-accent-surface text-accent-strong" : "text-muted",
                )}
              >
                {t(`create.tabs.${id}`)}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="create-panel-general"
            aria-labelledby="create-tab-general"
            hidden={tab !== "general"}
          >
            <GameSetupFields form={form} />
          </div>
          <div
            role="tabpanel"
            id="create-panel-rules"
            aria-labelledby="create-tab-rules"
            hidden={tab !== "rules"}
          >
            <GameRules value={settings} onChange={setSettings} />
          </div>
          <div
            role="tabpanel"
            id="create-panel-timers"
            aria-labelledby="create-tab-timers"
            hidden={tab !== "timers"}
          >
            <div className={createGameStyles.section}>
              <GameTimers value={settings} onChange={setSettings} expanded />
            </div>
          </div>
          <FieldError>{error}</FieldError>
          {unfinished && (
            <UploadUnfinished
              packageId={packageId}
              isAuthor={me.data?.id === pkg.data?.author.id}
            />
          )}
          <div className={createGameStyles.field}>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="self-start"
              inactive={unfinished}
              disabled={busy || !pkg.data || unfinished}
            >
              {busy ? t("create.creating") : t("create.submit")}
            </Button>
          </div>
        </form>
        <GamePackagePreview packageId={packageId} pkg={pkg} />
      </div>
    </PageContainer>
  );
}
