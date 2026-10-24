import { linkStyles } from "@/ui/linkStyles";
import { PageTitle } from "@/ui/Page";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EditIcon, UploadIcon } from "@/ui/icons";

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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <PageTitle id={titleId}>{title}</PageTitle>
      <div className="flex flex-wrap gap-2">
        {showMine && (
          <Link to="/packages/mine" className={actionLink}>
            {t("myPackages.link")}
          </Link>
        )}
        <Link to="/packages/editor" className={actionLink}>
          <EditIcon size={18} />
          {t("packages.create")}
        </Link>
        <Link to="/packages/upload" className={actionLink}>
          <UploadIcon size={18} />
          {t("packages.upload")}
        </Link>
      </div>
    </div>
  );
}
