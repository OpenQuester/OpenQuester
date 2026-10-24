import { typographyStyles } from "@/ui/typographyStyles";
import { linkStyles } from "@/ui/linkStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { packageBrowserStyles } from "./packageBrowserStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { OqPackage } from "@/api/types";
import { useMe } from "@/features/auth/useMe";
import { EyeIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";
import { usePackage } from "./usePackages";
import { summarizePackage } from "./packageSummary";
import { UploadUnfinished } from "./UploadUnfinished";
import { AuthorTools } from "./AuthorTools";

const hostLink = linkStyles.host;

export function PackageDetail({ id }: { id: number }) {
  const { t } = useTranslation();
  const pkg = usePackage(id);
  const me = useMe();
  if (pkg.isLoading) return <Spinner label={t("common.loading")} />;
  if (pkg.isError || !pkg.data)
    return (
      <p role="alert" className="m-0 text-danger">
        {t("packages.loadFailed")}
      </p>
    );
  return (
    <PackageSummaryView
      pkg={pkg.data}
      canHost={me.data != null}
      isAuthor={me.data != null && me.data.id === pkg.data.author.id}
    />
  );
}

function PackageSummaryView({
  pkg,
  canHost,
  isAuthor,
}: {
  pkg: OqPackage;
  canHost: boolean;
  isAuthor: boolean;
}) {
  const { t } = useTranslation();
  const s = summarizePackage(pkg);
  const media = [
    s.hasImages && t("packages.media.images"),
    s.hasAudio && t("packages.media.audio"),
    s.hasVideo && t("packages.media.video"),
  ].filter(Boolean);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={typographyStyles.packageTitle}>{pkg.title}</h2>
        <span className="text-sm text-muted">
          {t("packages.by", { name: pkg.author.username })}
          {pkg.language ? ` · ${pkg.language.toUpperCase()}` : ""}
        </span>
      </div>
      {pkg.description && <p className="m-0 text-soft">{pkg.description}</p>}
      {(!!pkg.authors?.length || !!pkg.sources?.length) && (
        <p className="m-0 text-sm text-muted" data-testid="package-credits">
          {[
            pkg.authors?.length ? t("reveal.authors", { names: pkg.authors.join(", ") }) : null,
            pkg.sources?.length ? t("reveal.sources", { list: pkg.sources.join(", ") }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t("packages.rounds")}</span>
        {s.rounds.map((r, i) => (
          <div key={i} className={layoutStyles.summaryRow}>
            <span className="font-medium [overflow-wrap:anywhere]">
              {i + 1} · {r.name}
            </span>
            <span className="text-muted">
              {r.type === "final"
                ? t("packages.finalThemes", { count: r.themes })
                : t("packages.roundCounts", { themes: r.themes, questions: r.questions })}
            </span>
          </div>
        ))}
      </div>
      {(media.length > 0 || s.specialTypes.length > 0) && (
        <p className="m-0 text-sm text-muted">
          {media.length > 0 && t("packages.has", { list: media.join(", ") })}
          {media.length > 0 && s.specialTypes.length > 0 && " · "}
          {s.specialTypes.length > 0 &&
            t("packages.special", {
              list: s.specialTypes.map((x) => t(`questionTypes.${x}`)).join(", "),
            })}
        </p>
      )}
      {pkg.uploadStatus === "uploading" ? (
        <UploadUnfinished packageId={pkg.id} isAuthor={isAuthor} />
      ) : canHost ? (
        <Link to="/games/new" search={{ packageId: pkg.id }} className={hostLink}>
          {t("packages.host")}
        </Link>
      ) : (
        <Link
          to="/login"
          search={{ redirect: `/games/new?packageId=${pkg.id}` }}
          className={hostLink}
        >
          {t("packages.signInToHost")}
        </Link>
      )}
      <Link
        to="/packages/$packageId/preview"
        params={{ packageId: String(pkg.id) }}
        className={packageBrowserStyles.previewLink}
        data-testid="package-preview"
      >
        <EyeIcon size={18} />
        {t("packages.preview")}
      </Link>
      {isAuthor && <AuthorTools id={pkg.id} />}
    </>
  );
}
