import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Gamepad2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { api, type PackageDetail } from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";
import { useSession } from "../auth/auth";

export function PackageDetailPage() {
  const { t } = useTranslation();
  const { packageId = "" } = useParams();
  const session = useSession();
  const query = useQuery({
    queryKey: ["package", packageId],
    queryFn: () => api.package<PackageDetail>(packageId),
    retry: false,
  });
  if (query.isPending)
    return <div className={styles.centerState}>{t("common.loading")}</div>;
  if (query.isError || !query.data)
    return (
      <div className={styles.centerState} role="alert">
        {t("common.loadFailed")}
      </div>
    );
  const item = query.data;
  const canEdit =
    session.data?.id === item.author?.id ||
    session.data?.permissions?.some(
      (permission) => permission.name === "edit_package",
    );
  const rounds = item.rounds ?? [];
  const questionCount = rounds.reduce(
    (total, round) =>
      total +
      round.themes.reduce((sum, theme) => sum + theme.questions.length, 0),
    0,
  );
  const logo = item.logo?.file?.link;
  return (
    <div className={styles.page}>
      <Link className={styles.textLink} to="/packages">
        <ArrowLeft size={14} aria-hidden="true" /> {t("nav.back")}
      </Link>
      <header className={styles.detailHeader}>
        {logo ? <img className={styles.detailArt} src={logo} alt="" /> : null}
        <div>
          <p className={styles.eyebrow}>
            {(item.language ?? t("packages.unknownLanguage")).toUpperCase()} ·{" "}
            {item.status === "draft"
              ? t("packages.draft")
              : t("packages.published")}
          </p>
          <h1>{item.title}</h1>
          <p className={styles.lede}>
            {item.description || t("packages.noDescription")}
          </p>
          <p className={styles.detailMeta}>
            {t("packages.by", {
              author: item.author?.username ?? t("packages.unknownAuthor"),
            })}
          </p>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>
              {t("packages.rounds", { count: rounds.length })}
            </span>
            <span className={styles.badge}>
              {t("packages.questions", { count: questionCount })}
            </span>
            {item.ageRestriction && item.ageRestriction !== "NONE" ? (
              <span className={styles.badge}>{item.ageRestriction}</span>
            ) : null}
            {item.tags?.map((tag) => (
              <span className={styles.badge} key={tag.id}>
                {tag.tag}
              </span>
            ))}
          </div>
          <div className={styles.detailActions}>
            {item.status !== "draft" ? (
              <Link
                className={styles.primaryButton}
                to={`/games/new?packageId=${item.id}`}
              >
                <Gamepad2 size={16} aria-hidden="true" />
                {t("packages.play")}
              </Link>
            ) : null}
            {canEdit ? (
              <Link
                className={styles.secondaryButton}
                to={`/editor/${item.id}`}
              >
                <Edit3 size={16} aria-hidden="true" />
                {t("packages.edit")}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* Theme names are the honest preview of a pack: enough to judge it,
          without spoiling the questions themselves. */}
      <section className={styles.roundList}>
        <h2>{t("packages.contents")}</h2>
        {rounds.map((round, index) => (
          <article className={styles.roundCard} key={round.id ?? index}>
            <header>
              <h3>{round.name}</h3>
              <span className={styles.badge}>
                {round.type === "final"
                  ? t("common.final")
                  : t("common.standard")}
              </span>
            </header>
            <ul className={styles.themeList}>
              {round.themes.map((theme, themeIndex) => (
                <li key={theme.id ?? themeIndex}>
                  <span>{theme.name}</span>
                  <span className={styles.themeCount}>
                    {t("packages.questions", {
                      count: theme.questions.length,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
