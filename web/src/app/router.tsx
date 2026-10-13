import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { DiscordCallbackPage } from "@/features/auth/DiscordCallbackPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { CreateGamePage } from "@/features/create-game/CreateGamePage";
import { GamePage } from "@/features/game/GamePage";
import { HomePage } from "@/features/home/HomePage";
import { PackagesPage } from "@/features/packages/PackagesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

import { AppShell, PageContainer } from "./AppShell";

function NotFound() {
  const { t } = useTranslation();
  return (
    <PageContainer width={640}>
      <h1 className="font-display text-3xl font-extrabold">{t("notFound.title")}</h1>
      <Link to="/">{t("game.backHome")}</Link>
    </PageContainer>
  );
}

const rootRoute = createRootRoute({ component: Outlet, notFoundComponent: NotFound });

/** Pages with the regular site header. */
const shell = createRoute({ getParentRoute: () => rootRoute, id: "shell", component: AppShell });

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const homeRoute = createRoute({
  getParentRoute: () => shell,
  path: "/",
  component: HomePage,
  validateSearch: (s: Record<string, unknown>): { notice?: string } => ({ notice: str(s.notice) }),
});
const loginRoute = createRoute({
  getParentRoute: () => shell,
  path: "/login",
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: str(s.redirect),
  }),
});
const discordRoute = createRoute({
  getParentRoute: () => shell,
  path: "/auth/discord",
  component: DiscordCallbackPage,
  validateSearch: (s: Record<string, unknown>): { code?: string; error?: string } => ({
    code: str(s.code),
    error: str(s.error),
  }),
});
const packagesRoute = createRoute({
  getParentRoute: () => shell,
  path: "/packages",
  component: PackagesPage,
  validateSearch: (s: Record<string, unknown>): { id?: number; q?: string } => ({
    id: num(s.id),
    q: str(s.q),
  }),
});
const createGameRoute = createRoute({
  getParentRoute: () => shell,
  path: "/games/new",
  component: CreateGamePage,
  validateSearch: (s: Record<string, unknown>): { packageId?: number } => ({
    packageId: num(s.packageId),
  }),
});
const settingsRoute = createRoute({
  getParentRoute: () => shell,
  path: "/settings",
  component: SettingsPage,
});

/** The game owns the whole screen. */
const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/games/$gameId",
  component: GamePage,
});

const routeTree = rootRoute.addChildren([
  shell.addChildren([
    homeRoute,
    loginRoute,
    discordRoute,
    packagesRoute,
    createGameRoute,
    settingsRoute,
  ]),
  gameRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
