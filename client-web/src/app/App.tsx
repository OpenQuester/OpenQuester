import { Suspense, lazy, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  DiscordCallbackPage,
  RequireSession,
  SignInPage,
} from "../features/auth/auth";
import { AppShell } from "./AppShell";
import styles from "../shared/ui/ui.module.css";
import { applyPreferences, usePreferences } from "../shared/preferences";
import { SESSION_EXPIRED_EVENT } from "../shared/api/client";

const HomePage = lazy(() =>
  import("../features/games/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);
const CreateGamePage = lazy(() =>
  import("../features/games/CreateGamePage").then((module) => ({
    default: module.CreateGamePage,
  })),
);
const GamePage = lazy(() =>
  import("../features/gameplay/GamePage").then((module) => ({
    default: module.GamePage,
  })),
);
const GameJoinPage = lazy(() =>
  import("../features/gameplay/GamePage").then((module) => ({
    default: module.GameJoinPage,
  })),
);
const PackagesPage = lazy(() =>
  import("../features/packages/PackagesPage").then((module) => ({
    default: module.PackagesPage,
  })),
);
const PackageDetailPage = lazy(() =>
  import("../features/packages/PackageDetailPage").then((module) => ({
    default: module.PackageDetailPage,
  })),
);
const EditorPage = lazy(() =>
  import("../features/editor/EditorPage").then((module) => ({
    default: module.EditorPage,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

export function App() {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  useEffect(() => applyPreferences(preferences), [preferences]);
  useEffect(() => {
    const sessionExpired = () => {
      queryClient.setQueryData(["session"], undefined);
      void navigate("/sign-in", {
        replace: true,
        state: { from: `${location.pathname}${location.search}` },
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
  }, [location.pathname, location.search, navigate, queryClient]);
  return (
    <Suspense
      fallback={<div className={styles.centerState}>{t("common.loading")}</div>}
    >
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/auth/discord/callback"
          element={<DiscordCallbackPage />}
        />
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route
            path="games/new"
            element={
              <RequireSession>
                <CreateGamePage />
              </RequireSession>
            }
          />
          <Route path="j/:gameId" element={<GameJoinPage />} />
          <Route
            path="games/:gameId"
            element={
              <RequireSession>
                <GamePage />
              </RequireSession>
            }
          />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="packages/:packageId" element={<PackageDetailPage />} />
          <Route
            path="editor/new"
            element={
              <RequireSession>
                <EditorPage />
              </RequireSession>
            }
          />
          <Route
            path="editor/:packageId"
            element={
              <RequireSession>
                <EditorPage />
              </RequireSession>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.centerState}>
      <div>
        <p className={styles.eyebrow}>404</p>
        <h1>{t("error.title")}</h1>
        <p className={styles.lede}>{t("error.body")}</p>
        <Link className={styles.primaryButton} style={{ marginTop: 20 }} to="/">
          {t("error.home")}
        </Link>
      </div>
    </div>
  );
}
