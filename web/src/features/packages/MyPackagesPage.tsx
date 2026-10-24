import { layoutStyles } from "@/ui/layoutStyles";
import { Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/ui/Page";
import { useMe } from "@/features/auth/useMe";
import { Card } from "@/ui/Card";
import { BackIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";
import { StorageMeter } from "@/features/storage/StorageMeter";
import { NO_FILTERS, PAGE_SIZE, usePackages } from "./usePackages";
import { PackageListHeader } from "./PackageListHeader";
import { Pagination } from "@/ui/Pagination";
import { MyPackageRow } from "./MyPackageRow";

/** The signed-in author's own packages: host, edit in the editor, delete. */
export function MyPackagesPage() {
  const { t } = useTranslation();
  const me = useMe();
  const [page, setPage] = useState(0);
  const authorId = me.data && !me.data.isGuest ? me.data.id : null;
  const packages = usePackages(
    { ...NO_FILTERS, title: "", sort: "newest", authorId },
    page,
    authorId != null,
  );

  if (me.isLoading)
    return (
      <PageContainer>
        <Spinner label={t("common.loading")} />
      </PageContainer>
    );
  if (!me.data) return <Navigate to="/login" search={{ redirect: "/packages/mine" }} />;

  const pages = Math.max(1, Math.ceil((packages.data?.total ?? 0) / PAGE_SIZE));

  return (
    <PageContainer width={1080}>
      <div className="flex flex-col gap-6">
        <Link to="/packages" className={layoutStyles.backLink}>
          <BackIcon size={18} />
          {t("nav.packages")}
        </Link>
        <PackageListHeader title={t("myPackages.title")} />

        {authorId != null && (
          <Card>
            <StorageMeter />
          </Card>
        )}

        {authorId == null ? (
          <Card data-testid="my-packages-guest">
            <p className="m-0 text-soft">{t("myPackages.guest")}</p>
          </Card>
        ) : packages.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : packages.isError ? (
          <p role="alert" className="text-danger">
            {t("packages.loadFailed")}
          </p>
        ) : packages.data?.items.length === 0 ? (
          <Card data-testid="my-packages-empty">
            <p className="m-0 text-soft">{t("myPackages.empty")}</p>
          </Card>
        ) : (
          <ul className={layoutStyles.spacedList} data-testid="my-packages">
            {packages.data?.items.map((p) => (
              <MyPackageRow key={p.id} pkg={p} />
            ))}
          </ul>
        )}

        <Pagination page={page} pages={pages} setPage={setPage} />
      </div>
    </PageContainer>
  );
}
