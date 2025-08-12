import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { RouteErrorFallback } from "@/components/common/RouteErrorFallback";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Permissions } from "@/constants/permissions";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";

// Lazy loaded pages (code-split non-auth-critical views)
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const UsersPage = lazy(() =>
  import("./pages/UsersPage").then((m) => ({ default: m.UsersPage }))
);
const SystemHealthPage = lazy(() =>
  import("./pages/SystemHealthPage").then((m) => ({
    default: m.SystemHealthPage,
  }))
);
const ForbiddenPage = lazy(() =>
  import("./pages/ForbiddenPage").then((m) => ({ default: m.ForbiddenPage }))
);

interface AppRouteConfig {
  path: string;
  element: React.JSX.Element;
  protected?: boolean;
  requiredPermission?: string;
}

const appRoutes: AppRouteConfig[] = [
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
    protected: true,
    requiredPermission: Permissions.ADMIN_PANEL_ACCESS,
  },
  {
    path: "/dashboard",
    element: <DashboardPage />,
    protected: true,
    requiredPermission: Permissions.ADMIN_PANEL_ACCESS,
  },
  {
    path: "/users",
    element: <UsersPage />,
    protected: true,
    requiredPermission: Permissions.VIEW_USERS_INFO,
  },
  {
    path: "/system",
    element: <SystemHealthPage />,
    protected: true,
    requiredPermission: Permissions.VIEW_SYSTEM_HEALTH,
  },
  { path: "/forbidden", element: <ForbiddenPage /> },
];

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Suspense
            // Lightweight centered spinner while code-split bundles load
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="loading-spinner h-8 w-8 border-b-2 border-primary-600" />
              </div>
            }
          >
            {/* Catches render/runtime errors inside route tree */}
            <ErrorBoundary fallback={<RouteErrorFallback />}>
              <Routes>
                {appRoutes.map(
                  ({
                    path,
                    element,
                    protected: isProtected,
                    requiredPermission,
                  }) => {
                    // Wrap protected pages with auth + permission guard + layout
                    if (isProtected) {
                      return (
                        <Route
                          key={path}
                          path={path}
                          element={
                            <ProtectedRoute
                              requiredPermission={requiredPermission}
                            >
                              <Layout>{element}</Layout>
                            </ProtectedRoute>
                          }
                        />
                      );
                    }
                    // Public route (login, error, etc.)
                    return <Route key={path} path={path} element={element} />;
                  }
                )}
                {/* Catch-all: unify unknown paths -> dashboard (could be swapped for 404 page later) */}
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
