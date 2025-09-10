import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/api/admin";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { PackagesFiltersBar } from "@/components/packages/PackagesFiltersBar";
import { PackagesListView } from "@/components/packages/PackagesListView";
import { PackagesLoadingSkeleton } from "@/components/packages/PackagesLoadingSkeleton";
import { PackagesPagination } from "@/components/packages/PackagesPagination";
import { QueryKeys } from "@/constants/queryKeys";
import { useToast } from "@/contexts/ToastContext";
import { PaginationOrder, type PaginatedResult } from "@/types/dto";
import {
  PackageSortBy,
  type AdminPackageDTO,
  type AgeRestriction,
} from "@/types/package";

const PAGE_LIMIT = 10;

enum FilterAgeRestrictionLocal {
  ALL = "all",
}

export const PackagesPage = () => {
  const [limit] = useState<number>(PAGE_LIMIT);
  const [offset, setOffset] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterAgeRestriction, setFilterAgeRestriction] = useState<
    AgeRestriction | FilterAgeRestrictionLocal
  >(FilterAgeRestrictionLocal.ALL);
  const [sortBy, setSortBy] = useState<PackageSortBy>(PackageSortBy.CREATED_AT);
  const [order, setOrder] = useState<PaginationOrder>(PaginationOrder.DESC);

  // Delete confirmation state
  const [packageToDelete, setPackageToDelete] =
    useState<AdminPackageDTO | null>(null);

  const { push: pushToast } = useToast();
  const queryClient = useQueryClient();

  // Delete package mutation
  const deletePackageMutation = useMutation({
    mutationFn: (packageId: number) => adminApi.deletePackage(packageId),
    onSuccess: () => {
      pushToast({
        variant: "success",
        title: "Package Deleted",
        description: "Package has been successfully deleted.",
      });
      // Invalidate packages query to refresh the list
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PACKAGES] });
      setPackageToDelete(null);
    },
    onError: (error) => {
      pushToast({
        variant: "error",
        title: "Delete Failed",
        description: `Failed to delete package: ${error.message}`,
      });
    },
  });

  const { data, isLoading, error } = useQuery<
    PaginatedResult<AdminPackageDTO[]>
  >({
    queryKey: [
      QueryKeys.PACKAGES,
      {
        sortBy,
        order,
        limit,
        offset,
        title: searchTerm.trim() || undefined,
      },
    ],
    queryFn: () =>
      adminApi.getPackages({
        sortBy,
        order,
        limit,
        offset,
        title: searchTerm.trim() || undefined,
      }),
    placeholderData: (prev) => prev, // treat previous data as placeholder to remove empty flashes
  });

  // Derive pagination helpers
  const total = data?.pageInfo?.total ?? 0;
  const effectiveLimit = limit;
  const hasNext = offset + effectiveLimit < total;
  const hasPrev = offset > 0;

  // Keep offset in valid range when total shrinks
  useEffect(() => {
    if (data?.pageInfo?.total != null && offset >= data.pageInfo.total) {
      setOffset(0);
    }
  }, [data?.pageInfo?.total, offset]);

  // Reset offset on search/filter change
  useEffect(() => {
    setOffset(0);
  }, [searchTerm, filterAgeRestriction, sortBy, order]);

  // Stable callback passed to search input component
  const handleSearch = useCallback((val: string) => {
    setSearchTerm(val);
  }, []);

  // Client-side filtering for age restriction since backend doesn't support it yet
  const packages = data?.data ?? [];
  const filteredPackages = packages.filter((pkg) => {
    if (filterAgeRestriction !== FilterAgeRestrictionLocal.ALL) {
      return pkg.ageRestriction === filterAgeRestriction;
    }
    return true;
  });

  const handleDeletePackage = useCallback(
    async (packageId: number) => {
      const packageToDelete = packages.find((p) => p.id === packageId);
      if (packageToDelete) {
        setPackageToDelete(packageToDelete);
      }
    },
    [packages]
  );

  const confirmDelete = useCallback(() => {
    if (packageToDelete?.id) {
      deletePackageMutation.mutate(packageToDelete.id);
    }
  }, [packageToDelete, deletePackageMutation]);

  const cancelDelete = useCallback(() => {
    setPackageToDelete(null);
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">Packages</h1>
          <p className="mt-2 text-secondaryText">
            Manage all packages in the system
          </p>
        </div>
        <div className="card">
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-error-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-error-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-error-800">
                  Failed to load packages data
                </h3>
                <p className="text-sm text-error-600 mt-1">
                  Please check your connection and try again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">Packages</h1>
          <p className="mt-2 text-secondaryText">
            Manage all packages in the system
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <PackagesFiltersBar
        searchTerm={searchTerm}
        onSearch={handleSearch}
        filterAgeRestriction={filterAgeRestriction}
        onAgeRestrictionChange={(v) =>
          setFilterAgeRestriction(
            v as AgeRestriction | FilterAgeRestrictionLocal
          )
        }
        sortBy={sortBy}
        onSortByChange={setSortBy}
        order={order}
        onOrderChange={setOrder}
      />

      {/* Packages List or Loading Skeleton */}
      {isLoading && !data && <PackagesLoadingSkeleton />}
      {!isLoading && (
        <PackagesListView
          packages={filteredPackages}
          onDelete={handleDeletePackage}
        />
      )}

      {/* Pagination */}
      {data?.pageInfo && (
        <PackagesPagination
          total={data.pageInfo.total || 0}
          offset={offset}
          limit={effectiveLimit}
          count={filteredPackages.length}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={() => setOffset(Math.max(0, offset - effectiveLimit))}
          onNext={() => setOffset(offset + effectiveLimit)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!packageToDelete}
        title="Delete Package"
        message={`Are you sure you want to delete "${packageToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={deletePackageMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};
