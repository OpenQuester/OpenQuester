import { layoutStyles } from "@/ui/layoutStyles";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "@/features/auth/useMe";
import { BackIcon, EyeIcon } from "@/ui/icons";
import { countQuestions, type DraftPackage } from "../packageDraft";
import { QuestionDensityToggle } from "./PackageEditorControls";
import { packageEditorShellStyles } from "./packageEditorShellStyles";

export function PackagePreviewHeader({ id, pkg }: { id: number; pkg: DraftPackage }) {
  const { t } = useTranslation();
  const me = useMe();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const hostClass = packageEditorShellStyles.previewPlayLink;
  return (
    <header className={packageEditorShellStyles.header}>
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.history.back()}
          className={packageEditorShellStyles.previewBackLink}
        >
          <BackIcon size={18} />
          <span className="hidden sm:inline">{t("editor.preview.back")}</span>
        </button>
      ) : (
        <Link to="/packages" search={{ id }} className={packageEditorShellStyles.backLink}>
          <BackIcon size={18} />
          <span className="hidden sm:inline">{t("editor.preview.back")}</span>
        </Link>
      )}
      <div className={layoutStyles.wrappingField}>
        <h1 className={packageEditorShellStyles.previewTitle}>{pkg.title}</h1>
        <span className={packageEditorShellStyles.previewStatus} data-testid="preview-badge">
          <EyeIcon size={14} />
          {t("editor.preview.readOnly", {
            rounds: pkg.rounds.length,
            questions: countQuestions(pkg),
          })}
        </span>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <QuestionDensityToggle />
        <div className="flex flex-1 justify-end">
          {me.data ? (
            <Link
              to="/games/new"
              search={{ packageId: id }}
              className={hostClass}
              data-testid="preview-host"
            >
              {t("packages.host")}
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ redirect: `/games/new?packageId=${id}` }}
              className={hostClass}
            >
              {t("packages.signInToHost")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
