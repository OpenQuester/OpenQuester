import { Filter } from "lucide-react";
import React from "react";

import { Select } from "@/components/ui/Select";
import { SearchUsersInput } from "@/components/users/SearchUsersInput";
import type { UserStatus } from "@/types/userStatus";

interface StatusOption {
  value: string;
  label: string;
}

interface UsersFiltersBarProps {
  searchTerm: string;
  onSearch: (val: string) => void;
  filterStatus: string;
  onFilterChange: (val: string) => void;
  statusOptions: StatusOption[];
}

export const UsersFiltersBar: React.FC<UsersFiltersBarProps> = ({
  searchTerm,
  onSearch,
  filterStatus,
  onFilterChange,
  statusOptions,
}) => {
  return (
    <div className="card" data-testid="users-filters-bar">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <SearchUsersInput
            initialValue={searchTerm}
            onSearch={onSearch}
            delayMs={200}
          />
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-mutedText" />
            <Select
              ariaLabel="Filter users by status"
              value={filterStatus as UserStatus | string}
              onChange={(v) => onFilterChange(v as string)}
              options={statusOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
