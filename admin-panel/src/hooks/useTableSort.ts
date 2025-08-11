import { PaginationOrder } from "@/types/dto";
import { useCallback, useState } from "react";

interface UseTableSortOptions {
  initialSortBy: string;
  initialOrder?: PaginationOrder;
}

interface UseTableSortResult {
  sortBy: string;
  order: PaginationOrder;
  handleSort: (field: string) => void;
}

// Reusable sorting state hook for table components (client-side or server-driven)
export function useTableSort({
  initialSortBy,
  initialOrder = PaginationOrder.DESC,
}: UseTableSortOptions): UseTableSortResult {
  const [sortBy, setSortBy] = useState<string>(initialSortBy);
  const [order, setOrder] = useState<PaginationOrder>(initialOrder);

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setOrder((o) =>
          o === PaginationOrder.ASC ? PaginationOrder.DESC : PaginationOrder.ASC
        );
        return prev; // unchanged field
      }
      setOrder(PaginationOrder.DESC); // default when switching field
      return field;
    });
  }, []);

  return { sortBy, order, handleSort };
}
