import React from "react";

export const UsersLoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6" data-testid="users-loading-skeleton">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 bg-skeleton rounded w-20 mb-2" />
                  <div className="h-6 bg-skeleton rounded w-16 mb-1" />
                  <div className="h-3 bg-skeleton rounded w-24" />
                </div>
                <div className="w-12 h-12 bg-skeleton rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-skeleton rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-skeleton rounded w-24 mb-2" />
                  <div className="h-3 bg-skeleton rounded w-32" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
