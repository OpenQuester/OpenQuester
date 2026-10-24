import { packageBrowserStyles } from "./packageBrowserStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/ui/Page";
import { Dialog } from "@/ui/Dialog";
import { Spinner } from "@/ui/Spinner";
import { PackageListHeader } from "./PackageListHeader";
import { PackageSearchControls } from "./PackageSearchControls";
import { Pagination } from "@/ui/Pagination";
import { PackageTile } from "./PackageTile";
import { PackageDetail } from "./PackageDetail";
import { usePackageBrowser } from "./usePackageBrowser";

export function PackagesPage() {
  const { t } = useTranslation();
  const browser = usePackageBrowser();
  const { me, packages, selectedId, select, page, pages, setPage } = browser;

  return (
    <PageContainer width={1320}>
      <div className="flex flex-col gap-6">
        <section className="flex min-w-0 flex-col gap-5" aria-labelledby="pk-title">
          <PackageListHeader
            title={t("packages.title")}
            titleId="pk-title"
            showMine={!!me.data && !me.data.isGuest}
          />
          <PackageSearchControls browser={browser} />

          {packages.isLoading ? (
            <Spinner label={t("common.loading")} />
          ) : packages.isError ? (
            <p role="alert" className="text-danger">
              {t("packages.loadFailed")}
            </p>
          ) : packages.data && packages.data.items.length === 0 ? (
            <div className={layoutStyles.emptyState}>{t("packages.empty")}</div>
          ) : (
            <ul className={packageBrowserStyles.packages}>
              {packages.data?.items.map((p) => (
                <li key={p.id}>
                  <PackageTile
                    pkg={p}
                    selected={p.id === selectedId}
                    onSelect={() => select(p.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pages={pages} setPage={setPage} />
        </section>

        <Dialog
          open={selectedId != null}
          onOpenChange={(open) => !open && select(undefined)}
          title={t("packages.details")}
          closeLabel={t("common.close")}
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6" data-testid="package-details">
            {selectedId != null && <PackageDetail id={selectedId} />}
          </div>
        </Dialog>
      </div>
    </PageContainer>
  );
}
