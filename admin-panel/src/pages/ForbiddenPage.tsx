import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Permissions } from "@/constants/permissions";
import { useAuth } from "@/contexts/AuthContext";

export const ForbiddenPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;

  // If user gained required base admin permission after refresh, send them back
  useEffect(() => {
    if (!from) return;
    if (hasPermission(Permissions.ADMIN_PANEL_ACCESS)) {
      navigate(from, { replace: true });
    }
  }, [from, hasPermission, navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8 bg-bg text-primaryText">
      <div className="relative max-w-md w-full text-center rounded-2xl p-10 shadow-soft border border-border bg-card animate-fade-in overflow-hidden">
        {/* Subtle radial accent (uses absolute layering without darkening light theme) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70 theme-dark:opacity-60 theme-pure-dark:opacity-50"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="w-24 h-24 mx-auto rounded-full bg-error-500/10 border border-error-500/30 flex items-center justify-center mb-8">
            <span className="text-4xl" role="img" aria-label="Forbidden">
              🚫
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight gradient-text mb-6">
            Access Forbidden
          </h1>
          <p className="text-secondaryText leading-relaxed mb-6">
            You don't have permission to access this area of the admin panel.
            {from && (
              <span className="block mt-4 text-sm text-mutedText">
                Attempted path:{" "}
                <code className="font-mono bg-hover px-2 py-1 rounded border border-border">
                  {from}
                </code>
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
