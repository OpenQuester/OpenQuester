import { type ReactNode } from "react";

import { PaginationOrder } from "@/types/dto";

interface SortButtonProps {
  field: string;
  activeField: string;
  order: PaginationOrder;
  onSort: (field: string) => void;
  children: ReactNode;
}

export const SortButton = ({
  field,
  activeField,
  order,
  onSort,
  children,
}: SortButtonProps) => {
  const isActive = field === activeField;
  const direction = isActive ? order : null;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`flex items-center space-x-1 hover:text-primary-600 transition-colors ${
        isActive ? "text-primary-600 font-medium" : "text-secondaryText"
      }`}
    >
      <span>{children}</span>
      {direction && (
        <span className="inline-block text-xs">
          {direction === PaginationOrder.ASC ? "▲" : "▼"}
        </span>
      )}
    </button>
  );
};
