import { layoutStyles } from "@/ui/layoutStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageContainer, PageTitle } from "@/ui/Page";
import { BackIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";
import { Button } from "@/ui/Button";
import { DraftActions } from "./home/DraftActions";
import { DraftList } from "./home/DraftList";
import { useDraftLibrary } from "./home/useDraftLibrary";

export function PackageDraftsPage() {
  const { t } = useTranslation();
  const { drafts, busy, error, create, importFile, remove, reload } = useDraftLibrary();
  return (
    <PageContainer width={960}>
      <div className="flex flex-col gap-6">
        <Link to="/packages" className={layoutStyles.backLink}>
          <BackIcon size={18} />
          {t("upload.back")}
        </Link>
        <header className="flex flex-col gap-2">
          <PageTitle>{t("editor.home.title")}</PageTitle>
          <p className="m-0 text-soft">{t("editor.home.lead")}</p>
        </header>

        <DraftActions busy={busy} create={create} importFile={importFile} />
        {busy && busy !== "new" && <Spinner label={t("upload.reading", { name: busy })} />}
        {error && (
          <p role="alert" className="m-0 text-danger">
            {error}
          </p>
        )}

        {error && drafts === null ? (
          <Button onClick={reload}>{t("common.retry")}</Button>
        ) : (
          <DraftList drafts={drafts} onDelete={remove} />
        )}
      </div>
    </PageContainer>
  );
}
