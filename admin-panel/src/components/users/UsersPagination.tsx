import React from "react";

interface UsersPaginationProps {
  total: number;
  offset: number;
  limit: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

// Pagination bar with status text (logic mirrors original inline implementation)
export const UsersPagination: React.FC<UsersPaginationProps> = ({
  total,
  offset,
  limit,
  count,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const start = total === 0 ? 0 : offset + 1;
  const end = offset + count;
  const expectedEnd = Math.min(offset + limit, total);
  const showExpectedWarning = end !== expectedEnd && count < limit;

  return (
    <div className="card" data-testid="users-pagination">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="text-sm text-secondaryText">
          Showing <span className="font-medium">{start}</span> to{" "}
          <span className="font-medium">{end}</span>{" "}
          {showExpectedWarning && (
            <span className="text-warning-600 ml-1">
              (expected {expectedEnd})
            </span>
          )}{" "}
          of <span className="font-medium">{total}</span> results
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="btn btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="btn btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
