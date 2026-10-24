import { draftLibraryStyles } from "./draftLibraryStyles";
import { typographyStyles } from "@/ui/typographyStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { timeAgo } from "@/lib/format";
import { TrashIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";
import type { PackageDraftSummary } from "../draftStorage";

export function DraftList({
  drafts,
  onDelete,
}: {
  drafts: PackageDraftSummary[] | null;
  onDelete: (draft: PackageDraftSummary) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3" aria-labelledby="drafts-title">
      <h2 id="drafts-title" className={typographyStyles.sectionTitle}>
        {t("editor.home.drafts")}
      </h2>
      <p className="m-0 text-sm text-muted">{t("editor.home.draftsHelp")}</p>
      {drafts == null ? (
        <Spinner label={t("common.loading")} />
      ) : drafts.length === 0 ? (
        <div className={layoutStyles.emptyState}>{t("editor.home.noDrafts")}</div>
      ) : (
        <ul className={layoutStyles.list} data-testid="drafts">
          {drafts.map((d) => (
            <li key={d.id} className={draftLibraryStyles.row}>
              <Link
                to="/packages/editor/$draftId"
                params={{ draftId: d.id }}
                className={draftLibraryStyles.openDraft}
              >
                <span className="truncate font-semibold">
                  {d.title || t("editor.outline.untitled")}
                </span>
                <span className="text-sm text-muted">
                  {t("editor.home.draftMeta", {
                    rounds: d.rounds,
                    questions: d.questions,
                    when: timeAgo(new Date(d.updatedAt).toISOString()),
                  })}
                  {d.publishedId != null && ` · ${t("editor.home.published")}`}
                </span>
              </Link>
              <button
                type="button"
                aria-label={t("editor.home.deleteDraft", { title: d.title })}
                onClick={() => onDelete(d)}
                className={draftLibraryStyles.deleteDraft}
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
