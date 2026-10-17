import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMe } from "@/features/auth/useMe";
import { BackIcon, EyeIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import { DensityToggle, EditorShell } from "./EditorShell";
import { loadServerPackage } from "./fromServer";
import { countQuestions, type EditorPackage } from "./model";
import { createEditorStore, EditorContext } from "./store";

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
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-16">
        <h1 className="m-0 font-display text-3xl font-extrabold">{t("packages.loadFailed")}</h1>
        <Link to="/packages">{t("upload.back")}</Link>
      </div>
    );
  if (!loaded.data)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  return <Preview key={id} id={id} pkg={loaded.data.pkg} media={loaded.data.media} />;
}

function Preview({
  id,
  pkg,
  media,
}: {
  id: number;
  pkg: EditorPackage;
  media: Awaited<ReturnType<typeof loadServerPackage>>["media"];
}) {
  const [store] = useState(() =>
    createEditorStore({
      draftId: `preview-${id}`,
      pkg,
      media,
      savedAt: null,
      publishedId: id,
      readOnly: true,
    }),
  );
  return (
    <EditorContext.Provider value={store}>
      <EditorShell header={<PreviewHeader id={id} pkg={pkg} />} />
    </EditorContext.Provider>
  );
}

function PreviewHeader({ id, pkg }: { id: number; pkg: EditorPackage }) {
  const { t } = useTranslation();
  const me = useMe();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const hostClass =
    "inline-flex min-h-11 items-center justify-center rounded-[12px] bg-accent px-4 font-semibold text-on-accent no-underline hover:text-on-accent";
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-5">
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.history.back()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-medium text-muted hover:text-text"
        >
          <BackIcon size={18} />
          <span className="hidden sm:inline">{t("editor.preview.back")}</span>
        </button>
      ) : (
        <Link
          to="/packages"
          search={{ id }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-medium text-muted no-underline hover:text-text"
        >
          <BackIcon size={18} />
          <span className="hidden sm:inline">{t("editor.preview.back")}</span>
        </Link>
      )}
      <div className="flex min-w-0 flex-[1_1_200px] flex-col">
        <h1 className="m-0 truncate px-1.5 font-display text-xl font-extrabold">{pkg.title}</h1>
        <span
          className="flex items-center gap-1.5 px-1.5 text-xs text-faint"
          data-testid="preview-badge"
        >
          <EyeIcon size={14} />
          {t("editor.preview.readOnly", {
            rounds: pkg.rounds.length,
            questions: countQuestions(pkg),
          })}
        </span>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <DensityToggle />
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
