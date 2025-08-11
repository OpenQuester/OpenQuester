import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute = ({
  children,
  requiredPermission,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Still fetching /me from API
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (
    !isAuthenticated ||
    (requiredPermission && !hasPermission(requiredPermission))
  ) {
    // No session user or required permission -> redirect to forbidden page
    return (
      <Navigate to="/forbidden" replace state={{ from: location.pathname }} />
    );
  }

  return <>{children}</>;
};
