import { linkStyles } from "@/ui/linkStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function UploadResultLinks({ id }: { id: number }) {
  const { t } = useTranslation();
  return (
    <>
      <Link to="/games/new" search={{ packageId: id }} className={linkStyles.responsivePrimary}>
        {t("packages.host")}
      </Link>
      <Link to="/packages" search={{ id }} className={linkStyles.responsiveSecondary}>
        {t("upload.viewPackage")}
      </Link>
    </>
  );
}
