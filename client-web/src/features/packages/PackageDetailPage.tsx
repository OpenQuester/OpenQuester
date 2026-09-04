import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Gamepad2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { api, type PackageSummary } from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";
import { useSession } from "../auth/auth";

export function PackageDetailPage() {
  const { t } = useTranslation();
  const { packageId = "" } = useParams();
  const session = useSession();
  const query = useQuery({
    queryKey: ["package", packageId],
    queryFn: () => api.package<PackageSummary>(packageId),
    retry: false,
  });
  if (query.isPending)
    return <div className={styles.empty}>{t("common.loading")}</div>;
  if (query.isError || !query.data)
    return (
      <div className={styles.empty} role="alert">
        {t("common.loadFailed")}
      </div>
    );
  const item = query.data;
  const canEdit =
    session.data?.id === item.author?.id ||
    session.data?.permissions?.some((permission) =>
      typeof permission === "string"
        ? permission === "edit_package"
        : permission.name === "edit_package",
    );
  return (
    <div className={styles.page}>
      <Link className={styles.textLink} to="/packages">
        <ArrowLeft size={14} /> {t("nav.back")}
      </Link>
      <header className={styles.pageHeader} style={{ marginTop: 42 }}>
        <div>
          <p className={styles.eyebrow}>
            {item.language ?? t("packages.unknownLanguage")} ·{" "}
            {item.status === "draft"
              ? t("packages.draft")
              : t("packages.published")}
          </p>
          <h1>{item.title}</h1>
          <p className={styles.lede}>{item.description}</p>
        </div>
      </header>
      <div className={styles.card} style={{ maxWidth: 760 }}>
        <div className={styles.cardTop}>
          <span className={styles.badge}>
            {t("packages.rounds", { count: item.roundsCount ?? 0 })}
          </span>
          <span className={styles.badge}>
            {t("packages.questions", { count: item.questionsCount ?? 0 })}
          </span>
        </div>
        <p>
          {t("packages.by", {
            author:
              item.author?.name ??
              item.author?.username ??
              t("packages.unknownAuthor"),
          })}
        </p>
        <footer className={styles.cardFooter}>
          {item.status !== "draft" ? (
            <Link
              className={styles.primaryButton}
              to={`/games/new?packageId=${item.id}`}
            >
              <Gamepad2 size={16} />
              {t("packages.play")}
            </Link>
          ) : null}
          {canEdit ? (
            <Link className={styles.secondaryButton} to={`/editor/${item.id}`}>
              <Edit3 size={16} />
              {t("packages.edit")}
            </Link>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
