export const PackagesLoadingSkeleton = () => {
  return (
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="p-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-skeleton rounded-lg flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-skeleton rounded w-1/3"></div>
                <div className="h-4 bg-skeleton rounded w-3/4"></div>
                <div className="flex space-x-4">
                  <div className="h-3 bg-skeleton rounded w-20"></div>
                  <div className="h-3 bg-skeleton rounded w-16"></div>
                  <div className="h-3 bg-skeleton rounded w-24"></div>
                </div>
              </div>
              <div className="flex space-x-2">
                <div className="h-8 bg-skeleton rounded w-16"></div>
                <div className="h-8 bg-skeleton rounded w-16"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
