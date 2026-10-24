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

export function CreateGamePage() {
  const { t } = useTranslation();
  const form = useCreateGame();
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
        <form onSubmit={onSubmit} className={createGameStyles.settingsColumn} noValidate>
          <PageTitle>{t("create.title")}</PageTitle>
          <GameSetupFields form={form} />
          <GameRules value={settings} onChange={setSettings} />
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
            <p className="m-0 text-sm text-muted">{t("create.youAreShowman")}</p>
          </div>
        </form>
        <GamePackagePreview packageId={packageId} pkg={pkg} />
      </div>
    </PageContainer>
  );
}
