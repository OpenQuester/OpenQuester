import { Calendar, Hash, Package, Trash2, User } from "lucide-react";

import {
  IconButton,
  IconButtonSize,
  IconButtonVariant,
} from "@/components/common/IconButton";
import { Permissions } from "@/constants/permissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  ageRestrictionOptions,
  type AdminPackageDTO,
  type AgeRestriction,
} from "@/types/package";

interface PackagesListViewProps {
  packages: AdminPackageDTO[];
  onDelete: (packageId: number) => void;
}

export const PackagesListView = ({
  packages,
  onDelete,
}: PackagesListViewProps) => {
  const { hasPermission } = useAuth();
  const canDeletePackages = hasPermission(Permissions.DELETE_PACKAGE);

  const getAgeRestrictionLabel = (ageRestriction: AgeRestriction) => {
    const option = ageRestrictionOptions.find(
      (opt) => opt.value === ageRestriction
    );
    return option?.label || ageRestriction;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (packages.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Package className="h-12 w-12 text-mutedText mx-auto mb-4" />
        <h3 className="text-lg font-medium text-secondaryText mb-2">
          No packages found
        </h3>
        <p className="text-mutedText">
          Try adjusting your search or filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {packages.map((pkg) => (
        <div
          key={pkg.id}
          className="card p-4 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <div className="w-24 h-24 flex-shrink-0">
              {pkg.logo?.file?.link ? (
                <img
                  src={pkg.logo.file.link}
                  alt={`${pkg.title} logo`}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-full bg-hover rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-mutedText" />
                </div>
              )}
            </div>

            {/* Package Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-primaryText truncate">
                      {pkg.title}
                    </h3>
                    <span className="badge badge-primary font-mono text-xs flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {pkg.id}
                    </span>
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-secondaryText line-clamp-2 mt-1">
                      {pkg.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {canDeletePackages && (
                    <IconButton
                      ariaLabel="Delete package"
                      onClick={() => pkg.id && onDelete(pkg.id)}
                      title="Delete package"
                      variant={IconButtonVariant.DANGER}
                      size={IconButtonSize.SM}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              </div>

              {/* Meta Information */}
              <div className="space-y-2 mt-3">
                {/* First row: User, Date, Age Restriction, Language */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-mutedText">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{pkg.author.username}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(pkg.createdAt)}</span>
                  </div>

                  <div className="badge badge-neutral">
                    {getAgeRestrictionLabel(pkg.ageRestriction)}
                  </div>

                  {pkg.language && (
                    <div className="badge badge-info">{pkg.language}</div>
                  )}
                </div>

                {/* Second row: Tags */}
                <div className="flex flex-wrap items-center gap-1">
                  {pkg.tags && pkg.tags.length > 0 ? (
                    <>
                      {pkg.tags.slice(0, 3).map((tag) => (
                        <span key={tag.tag} className="badge badge-success">
                          {tag.tag}
                        </span>
                      ))}
                      {pkg.tags.length > 3 && (
                        <span className="badge badge-gray">
                          +{pkg.tags.length - 3} more
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-mutedText italic">
                      no tags
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
