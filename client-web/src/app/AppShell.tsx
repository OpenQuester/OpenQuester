import {
  Boxes,
  Gamepad2,
  LogIn,
  PackagePlus,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useSession } from "../features/auth/auth";
import { applyPreferences, usePreferences } from "../shared/preferences";
import styles from "../shared/ui/ui.module.css";

const nav: ReadonlyArray<{
  to: string;
  key: string;
  icon: typeof Gamepad2;
  end?: boolean;
}> = [
  { to: "/", key: "nav.play", icon: Gamepad2, end: true },
  { to: "/packages", key: "nav.packages", icon: Boxes },
  { to: "/editor/new", key: "nav.create", icon: PackagePlus },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

function NavItems({ mobile = false }: { mobile?: boolean }) {
  const { t } = useTranslation();
  return nav.map(({ to, key, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={
        mobile
          ? undefined
          : ({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
      }
    >
      <Icon aria-hidden="true" />
      <span>{t(key)}</span>
    </NavLink>
  ));
}

export function AppShell() {
  const { t } = useTranslation();
  const session = useSession();
  const preferences = usePreferences();
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  const displayName = session.data?.name ?? session.data?.username;
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} to="/">
          <img src="/assets/logo.png" alt="" />
          <span>
            OPENQUESTER<small>{t("brand.tagline")}</small>
          </span>
        </Link>
        <nav className={styles.nav} aria-label={t("nav.primary")}>
          <NavItems />
        </nav>
        <Link
          className={styles.account}
          to={displayName ? "/settings" : "/sign-in"}
        >
          <span className={styles.avatar}>
            {displayName?.slice(0, 1).toUpperCase() ?? <UserRound size={17} />}
          </span>
          <span className={styles.accountMeta}>
            <strong>{displayName ?? t("nav.signIn")}</strong>
            <span>
              {displayName ? t("common.online") : t("common.offline")}
            </span>
          </span>
        </Link>
      </aside>
      <main className={styles.main}>
        <div className={styles.topbar}>
          {session.data ? (
            <Link className={styles.primaryButton} to="/games/new">
              <Plus size={16} />
              {t("home.newGame")}
            </Link>
          ) : (
            <Link className={styles.secondaryButton} to="/sign-in">
              <LogIn size={16} />
              {t("nav.signIn")}
            </Link>
          )}
        </div>
        <Outlet />
      </main>
      <nav className={styles.mobileNav} aria-label={t("nav.mobile")}>
        <NavItems mobile />
      </nav>
    </div>
  );
}
