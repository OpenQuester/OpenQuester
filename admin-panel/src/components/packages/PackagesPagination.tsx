import { ChevronLeft, ChevronRight } from "lucide-react";

interface PackagesPaginationProps {
  total: number;
  offset: number;
  limit: number;
  count: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export const PackagesPagination = ({
  total,
  offset,
  limit,
  count,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: PackagesPaginationProps) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = offset + 1;
  const endItem = offset + count;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-secondaryText">
          Showing {startItem} to {endItem} of {total} packages
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="btn btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>

          <span className="text-sm text-secondaryText px-3">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={onNext}
            disabled={!hasNext}
            className="btn btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
