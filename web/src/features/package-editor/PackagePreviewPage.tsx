import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/ui/Spinner";
import { PageLoading, PageMessage } from "@/ui/Page";

import { PackageEditorShell } from "./PackageEditorShell";
import { PackagePreviewHeader } from "./shell/PackagePreviewHeader";
import { loadServerPackage } from "./loadPublishedPackage";
import type { DraftPackage } from "./packageDraft";
import { createPackageEditorStore, PackageEditorContext } from "./packageEditorStore";

/**
 * A published package in the editor, read only: the round board, hover and
 * card previews, and every question's media and answer, so a host can check a
 * package before starting a game with it.
 */
export function PackagePreviewPage() {
  const { t } = useTranslation();
  const { packageId } = useParams({ from: "/packages/$packageId/preview" });
  const id = Number(packageId);
  const loaded = useQuery({
    queryKey: ["package-preview", id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: () => loadServerPackage(id),
    staleTime: 60_000,
  });

  if (loaded.isError || !(Number.isInteger(id) && id > 0))
    return (
      <PageMessage title={t("packages.loadFailed")}>
        <Link to="/packages">{t("upload.back")}</Link>
      </PageMessage>
    );
  if (!loaded.data)
    return (
      <PageLoading>
        <Spinner label={t("common.loading")} />
      </PageLoading>
    );
  return <Preview key={id} id={id} pkg={loaded.data.pkg} media={loaded.data.media} />;
}

function Preview({
  id,
  pkg,
  media,
}: {
  id: number;
  pkg: DraftPackage;
  media: Awaited<ReturnType<typeof loadServerPackage>>["media"];
}) {
  const [store] = useState(() =>
    createPackageEditorStore({
      draftId: `preview-${id}`,
      pkg,
      media,
      savedAt: null,
      publishedId: id,
      readOnly: true,
    }),
  );
  return (
    <PackageEditorContext.Provider value={store}>
      <PackageEditorShell header={<PackagePreviewHeader id={id} pkg={pkg} />} />
    </PackageEditorContext.Provider>
  );
}
