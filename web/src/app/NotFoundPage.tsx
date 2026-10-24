import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/ui/Page";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PageContainer width={640}>
      <h1 className="font-display text-3xl font-extrabold">{t("notFound.title")}</h1>
      <Link to="/">{t("game.backHome")}</Link>
    </PageContainer>
  );
}
