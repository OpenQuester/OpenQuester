import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LoginPage } from "@/features/auth/LoginPage";
import { HomePage } from "@/features/home/HomePage";

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
  component: lazyRouteComponent(
    () => import("@/features/auth/DiscordCallbackPage"),
    "DiscordCallbackPage",
  ),
  validateSearch: (s: Record<string, unknown>): { code?: string; error?: string } => ({
    code: str(s.code),
    error: str(s.error),
  }),
});
const packagesRoute = createRoute({
  getParentRoute: () => shell,
  path: "/packages",
  component: lazyRouteComponent(() => import("@/features/packages/PackagesPage"), "PackagesPage"),
  validateSearch: (s: Record<string, unknown>): { id?: number; q?: string } => ({
    id: num(s.id),
    q: str(s.q),
  }),
});
const uploadRoute = createRoute({
  getParentRoute: () => shell,
  path: "/packages/upload",
  component: lazyRouteComponent(
    () => import("@/features/upload/UploadPackagePage"),
    "UploadPackagePage",
  ),
});
const resumeUploadRoute = createRoute({
  getParentRoute: () => shell,
  path: "/packages/$packageId/upload",
  component: lazyRouteComponent(
    () => import("@/features/upload/ResumeUploadPage"),
    "ResumeUploadPage",
  ),
});
const editorHomeRoute = createRoute({
  getParentRoute: () => shell,
  path: "/packages/editor",
  component: lazyRouteComponent(() => import("@/features/editor/EditorHomePage"), "EditorHomePage"),
});
const createGameRoute = createRoute({
  getParentRoute: () => shell,
  path: "/games/new",
  component: lazyRouteComponent(
    () => import("@/features/create-game/CreateGamePage"),
    "CreateGamePage",
  ),
  validateSearch: (s: Record<string, unknown>): { packageId?: number } => ({
    packageId: num(s.packageId),
  }),
});
const leaderboardRoute = createRoute({
  getParentRoute: () => shell,
  path: "/leaderboard",
  component: lazyRouteComponent(
    () => import("@/features/stats/LeaderboardPage"),
    "LeaderboardPage",
  ),
});
const settingsRoute = createRoute({
  getParentRoute: () => shell,
  path: "/settings",
  component: lazyRouteComponent(() => import("@/features/settings/SettingsPage"), "SettingsPage"),
});

/** The editor owns the whole screen, like the game. */
const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/packages/editor/$draftId",
  component: lazyRouteComponent(() => import("@/features/editor/EditorPage"), "EditorPage"),
});

const myPackagesRoute = createRoute({
  getParentRoute: () => shell,
  path: "/packages/mine",
  component: lazyRouteComponent(
    () => import("@/features/packages/MyPackagesPage"),
    "MyPackagesPage",
  ),
});
const adminRoute = createRoute({
  getParentRoute: () => shell,
  path: "/admin",
  component: lazyRouteComponent(() => import("@/features/admin/AdminPage"), "AdminPage"),
});

const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/packages/$packageId/preview",
  component: lazyRouteComponent(
    () => import("@/features/editor/PackagePreviewPage"),
    "PackagePreviewPage",
  ),
});

/** The game owns the whole screen. */
const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/games/$gameId",
  component: lazyRouteComponent(() => import("@/features/game/GamePage"), "GamePage"),
});

const routeTree = rootRoute.addChildren([
  shell.addChildren([
    homeRoute,
    loginRoute,
    discordRoute,
    packagesRoute,
    uploadRoute,
    resumeUploadRoute,
    editorHomeRoute,
    createGameRoute,
    settingsRoute,
    leaderboardRoute,
    adminRoute,
    myPackagesRoute,
  ]),
  editorRoute,
  previewRoute,
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
