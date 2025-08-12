export const SkeletonCard = () => (
  <div className="card animate-pulse">
    <div className="p-6">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-xl bg-skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-skeleton rounded" />
          <div className="h-6 bg-skeleton rounded w-20" />
        </div>
      </div>
    </div>
  </div>
);
