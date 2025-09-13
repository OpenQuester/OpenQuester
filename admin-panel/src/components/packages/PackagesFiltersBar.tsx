import { Search } from "lucide-react";
import { useCallback } from "react";

import { PaginationOrder } from "@/types/dto";
import {
  ageRestrictionOptions,
  packageSortOptions,
  type AgeRestriction,
  type PackageSortBy,
} from "@/types/package";

interface PackagesFiltersBarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  filterAgeRestriction: AgeRestriction | "all";
  onAgeRestrictionChange: (restriction: AgeRestriction | "all") => void;
  sortBy: PackageSortBy;
  onSortByChange: (sortBy: PackageSortBy) => void;
  order: PaginationOrder;
  onOrderChange: (order: PaginationOrder) => void;
}

export const PackagesFiltersBar = ({
  searchTerm,
  onSearch,
  filterAgeRestriction,
  onAgeRestrictionChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: PackagesFiltersBarProps) => {
  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    },
    [onSearch]
  );

  return (
    <div className="card p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label
            htmlFor="search"
            className="block text-sm font-medium text-secondaryText mb-1"
          >
            Search packages
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-mutedText" />
            <input
              type="text"
              id="search"
              className="input pl-10"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={handleSearchInput}
            />
          </div>
        </div>

        {/* Age Restriction Filter */}
        <div>
          <label
            htmlFor="ageRestriction"
            className="block text-sm font-medium text-secondaryText mb-1"
          >
            Age Restriction
          </label>
          <select
            id="ageRestriction"
            value={filterAgeRestriction}
            onChange={(e) =>
              onAgeRestrictionChange(e.target.value as AgeRestriction | "all")
            }
            className="input"
          >
            <option value="all">All Restrictions</option>
            {ageRestrictionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label
            htmlFor="sortBy"
            className="block text-sm font-medium text-secondaryText mb-1"
          >
            Sort by
          </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as PackageSortBy)}
            className="input"
          >
            {packageSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Order */}
        <div>
          <label
            htmlFor="order"
            className="block text-sm font-medium text-secondaryText mb-1"
          >
            Order
          </label>
          <select
            id="order"
            value={order}
            onChange={(e) => onOrderChange(e.target.value as PaginationOrder)}
            className="input"
          >
            <option value={PaginationOrder.ASC}>Ascending</option>
            <option value={PaginationOrder.DESC}>Descending</option>
          </select>
        </div>
      </div>
    </div>
  );
};
