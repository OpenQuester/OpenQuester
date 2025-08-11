import { Link } from "react-router-dom";

export const RouteErrorFallback = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8 bg-bg text-primaryText">
      <div className="relative w-full max-w-lg text-center rounded-2xl p-10 shadow-soft border border-border bg-card animate-fade-in overflow-hidden">
        <div className="relative">
          <div className="w-24 h-24 mx-auto rounded-full bg-error-500/10 border border-error-500/30 flex items-center justify-center mb-8 animate-pulse">
            <span className="text-4xl" role="img" aria-label="Confused">
              😕
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight gradient-text mb-6">
            Something went wrong
          </h1>
          <p className="text-secondaryText leading-relaxed mb-8 max-w-prose mx-auto">
            An unexpected error occurred while rendering this view. You can try
            refreshing the page or returning to the dashboard.
          </p>
          <div className="flex flex-col sm:flex-row sm:justify-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full sm:w-auto"
            >
              Refresh
            </button>
            <Link
              to="/dashboard"
              className="btn btn-secondary w-full sm:w-auto"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
