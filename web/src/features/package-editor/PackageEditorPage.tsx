import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/ui/Spinner";
import { Button } from "@/ui/Button";
import { PageLoading, PageMessage } from "@/ui/Page";
import { PackageEditorShell } from "./PackageEditorShell";
import { PackageEditorContext } from "./packageEditorStore";
import { usePackageEditorDraft } from "./usePackageEditorDraft";

export function PackageEditorPage() {
  const { t } = useTranslation();
  const { draftId } = useParams({ from: "/packages/editor/$draftId" });
  const { store, retry } = usePackageEditorDraft(draftId);

  if (store === "failed")
    return (
      <PageMessage title={t("common.loadFailed")}>
        <Button onClick={retry}>{t("common.retry")}</Button>
        <Link to="/packages/editor">{t("editor.backToDrafts")}</Link>
      </PageMessage>
    );

  if (store === "missing")
    return (
      <PageMessage title={t("editor.missing")}>
        <p className="m-0 text-muted">{t("editor.missingHelp")}</p>
        <Link to="/packages/editor">{t("editor.backToDrafts")}</Link>
      </PageMessage>
    );
  if (!store)
    return (
      <PageLoading>
        <Spinner label={t("common.loading")} />
      </PageLoading>
    );
  return (
    <PackageEditorContext.Provider value={store}>
      <PackageEditorShell />
    </PackageEditorContext.Provider>
  );
}
