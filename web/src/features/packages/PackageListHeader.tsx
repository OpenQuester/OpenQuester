import { linkStyles } from "@/ui/linkStyles";
import { PageTitle } from "@/ui/Page";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EditIcon, UploadIcon } from "@/ui/icons";
import { Button } from "@/ui/Button";
import { newDraft } from "@/features/package-editor/createDraft";
import { cn } from "@/lib/cn";

const actionLink = linkStyles.secondary;

export function PackageListHeader({
  title,
  titleId,
  showMine = false,
}: {
  title: string;
  titleId?: string;
  showMine?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);
  const create = async () => {
    setCreating(true);
    setError(false);
    try {
      const draftId = await newDraft(
        t("editor.defaults.title"),
        t("editor.defaults.round", { n: 1 }),
        t("editor.defaults.theme"),
      );
      await navigate({ to: "/packages/editor/$draftId", params: { draftId } });
    } catch {
      setError(true);
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <PageTitle id={titleId}>{title}</PageTitle>
      <div className="flex flex-wrap gap-2">
        {showMine && (
          <Link to="/packages/mine" className={actionLink}>
            {t("myPackages.link")}
          </Link>
        )}
        <Button
          variant="accent"
          icon={<EditIcon size={18} />}
          disabled={creating}
          onClick={() => void create()}
        >
          {t("packages.create")}
        </Button>
        <Link to="/packages/editor" className={actionLink}>
          {t("editor.drafts")}
        </Link>
        <Link to="/packages/upload" className={cn(actionLink, "border-info text-info-soft")}>
          <UploadIcon size={18} />
          {t("packages.upload")}
        </Link>
      </div>
      {error && (
        <p role="alert" className="m-0 text-danger">
          {t("editor.storageFailed")}
        </p>
      )}
    </div>
  );
}
