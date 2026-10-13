import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { displayName, useMe } from "@/features/auth/useMe";
import { Avatar } from "@/ui/Avatar";
import { LogoMark } from "@/ui/Logo";

/** Header + page frame for everything outside a running game. */
export function AppShell() {
  const { t } = useTranslation();
  const me = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { to: "/", label: t("nav.games"), active: path === "/" },
    { to: "/packages", label: t("nav.packages"), active: path.startsWith("/packages") },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-surface-2 px-3 py-2"
      >
        {t("nav.skip")}
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-text no-underline hover:text-text">
            <LogoMark />
            <span className="font-display text-xl font-extrabold">OpenQuester</span>
          </Link>
          <nav
            aria-label={t("nav.main")}
            className="order-3 flex w-full gap-1 sm:order-none sm:w-auto"
          >
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={n.active ? "page" : undefined}
                className={cn(
                  "rounded-sm px-3.5 py-2.5 font-medium no-underline",
                  n.active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          {me.data ? (
            <Link
              to="/settings"
              aria-label={t("nav.profile")}
              className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-3 py-0.5 pl-0.5 pr-3 text-text no-underline hover:text-text"
            >
              <Avatar name={displayName(me.data)} src={me.data.avatar} size={38} />
              <span className="max-w-[12ch] truncate text-sm font-semibold">
                {displayName(me.data)}
              </span>
            </Link>
          ) : me.isLoading || path.startsWith("/login") ? null : (
            <Link
              to="/login"
              search={{ redirect: path }}
              className="rounded-[12px] border border-line-strong px-4 py-2.5 font-semibold text-text no-underline hover:text-text"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function PageContainer({
  children,
  width = 1240,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div className="mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-10" style={{ maxWidth: width }}>
      {children}
    </div>
  );
}
