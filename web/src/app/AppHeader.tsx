import { appShellStyles } from "./appShellStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { can } from "@/features/admin/useAdmin";
import { displayName } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { Avatar } from "@/ui/Avatar";
import { LogoMark } from "@/ui/Logo";

interface AppHeaderProps {
  user: User | null | undefined;
  isLoading: boolean;
  path: string;
}

export function AppHeader({ user, isLoading, path }: AppHeaderProps) {
  const { t } = useTranslation();
  const nav = [
    { to: "/", label: t("nav.games"), active: path === "/" },
    { to: "/packages", label: t("nav.packages"), active: path.startsWith("/packages") },
    { to: "/leaderboard", label: t("nav.leaderboard"), active: path === "/leaderboard" },
    ...(can(user, "admin_panel_access")
      ? [{ to: "/admin", label: t("nav.admin"), active: path.startsWith("/admin") }]
      : []),
  ] as const;

  return (
    <header className="border-b border-line">
      <div className={appShellStyles.header}>
        <Link to="/" className={appShellStyles.homeLink}>
          <LogoMark />
          <span className="font-display text-xl font-extrabold">OpenQuester</span>
        </Link>
        <nav
          aria-label={t("nav.main")}
          // Scrolls sideways on narrow phones instead of widening the page.
          className={appShellStyles.navigation}
        >
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              aria-current={n.active ? "page" : undefined}
              className={cn(
                appShellStyles.navigationLink,
                n.active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <AccountLink user={user} isLoading={isLoading} path={path} />
      </div>
    </header>
  );
}

function AccountLink({ user, isLoading, path }: AppHeaderProps) {
  const { t } = useTranslation();
  return user ? (
    <Link to="/settings" aria-label={t("nav.profile")} className={appShellStyles.accountLink}>
      <Avatar name={displayName(user)} src={user.avatar} size={38} />
      <span className="max-w-[12ch] truncate text-sm font-semibold">{displayName(user)}</span>
    </Link>
  ) : isLoading || path.startsWith("/login") ? null : (
    <Link to="/login" search={{ redirect: path }} className={appShellStyles.signInLink}>
      {t("nav.signIn")}
    </Link>
  );
}
