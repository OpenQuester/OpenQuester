import { appShellStyles } from "./appShellStyles";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "@/features/auth/useMe";
import { AppHeader } from "./AppHeader";

/** Header + page frame for everything outside a running game. */
export function AppShell() {
  const { t } = useTranslation();
  const me = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a href="#main" className={appShellStyles.skipLink}>
        {t("nav.skip")}
      </a>
      <AppHeader user={me.data} isLoading={me.isLoading} path={path} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
