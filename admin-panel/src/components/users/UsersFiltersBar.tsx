import { Filter, User } from "lucide-react";
import React from "react";

import { Select } from "@/components/ui/Select";
import { SearchUsersInput } from "@/components/users/SearchUsersInput";

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
  filterUserType: string;
  onUserTypeChange: (val: string) => void;
  userTypeOptions: StatusOption[];
}

export const UsersFiltersBar: React.FC<UsersFiltersBarProps> = ({
  searchTerm,
  onSearch,
  filterStatus,
  onFilterChange,
  statusOptions,
  filterUserType,
  onUserTypeChange,
  userTypeOptions,
}) => {
  return (
    <div className="card" data-testid="users-filters-bar">
      <div className="p-6">
        <div className="flex flex-col space-y-6">
          {/* Search Section */}
          <div>
            <SearchUsersInput
              initialValue={searchTerm}
              onSearch={onSearch}
              delayMs={200}
            />
          </div>

          {/* Filters Section */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
            {/* Status Filter */}
            <div className="bg-surface/50 rounded-lg p-4 flex-1">
              <div className="mb-2">
                <h3 className="text-sm font-medium text-foreground">
                  Account Status
                </h3>
                <p className="text-xs text-mutedText">
                  Filter users by their account status
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-mutedText" />
                <Select
                  ariaLabel="Filter users by status"
                  value={filterStatus}
                  onChange={(v) => onFilterChange(v as string)}
                  options={statusOptions}
                />
              </div>
            </div>

            {/* User Type Filter */}
            <div className="bg-surface/50 rounded-lg p-4 flex-1">
              <div className="mb-2">
                <h3 className="text-sm font-medium text-foreground">
                  User Type
                </h3>
                <p className="text-xs text-mutedText">
                  Filter by registration type
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-mutedText" />
                <Select
                  ariaLabel="Filter users by type"
                  value={filterUserType}
                  onChange={(v) => onUserTypeChange(v as string)}
                  options={userTypeOptions}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
