import { X } from "lucide-react";
import React, { memo, useMemo, useState } from "react";

import { Modal } from "@/components/common/Modal";
import { Permissions } from "@/constants/permissions";
import { type UserDTO } from "@/types/dto";

interface EditPermissionsModalProps {
  user: UserDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (permissions: string[]) => Promise<void>;
  isSaving?: boolean;
}

/**
 * Modal for editing user permissions with a clean, scalable interface
 * Handles 15-100+ permissions with search and categorization
 */
export const EditPermissionsModal = memo(
  ({
    user,
    isOpen,
    onClose,
    onSave,
    isSaving = false,
  }: EditPermissionsModalProps) => {
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
      new Set()
    );

    // Initialize selected permissions when user changes or modal opens
    React.useEffect(() => {
      if (user && isOpen) {
        setSelectedPermissions(new Set(user.permissions.map((p) => p.name)));
      }
    }, [user, isOpen]);

    // Get all available permissions from the enum
    const allPermissions = useMemo(() => {
      return Object.values(Permissions).map((permission) => ({
        name: permission,
        displayName: permission.replace(/_/g, " ").toLowerCase(),
        category: getPermissionCategory(permission),
      }));
    }, []);

    // Group permissions by category
    const groupedPermissions = useMemo(() => {
      const groups: Record<string, typeof allPermissions> = {};
      allPermissions.forEach((permission) => {
        if (!groups[permission.category]) {
          groups[permission.category] = [];
        }
        groups[permission.category].push(permission);
      });
      return groups;
    }, [allPermissions]);

    const handleTogglePermission = (permissionName: string) => {
      const newSelected = new Set(selectedPermissions);
      if (newSelected.has(permissionName)) {
        newSelected.delete(permissionName);
      } else {
        newSelected.add(permissionName);
      }
      setSelectedPermissions(newSelected);
    };

    const handleSave = async () => {
      if (!user) return;

      const permissionsArray = Array.from(selectedPermissions);
      await onSave(permissionsArray);
    };

    const handleCancel = () => {
      // Reset to original permissions
      if (user) {
        setSelectedPermissions(new Set(user.permissions.map((p) => p.name)));
      }
      onClose();
    };

    const hasChanges = useMemo(() => {
      if (!user) return false;
      const originalPermissions = new Set(user.permissions.map((p) => p.name));

      if (originalPermissions.size !== selectedPermissions.size) return true;

      for (const permission of selectedPermissions) {
        if (!originalPermissions.has(permission)) return true;
      }

      return false;
    }, [user, selectedPermissions]);

    if (!user) return null;

    return (
      <Modal
        isOpen={isOpen}
        title={`Edit Permissions - ${user.name || user.username}`}
        onClose={handleCancel}
        size="lg"
      >
        <div className="space-y-4">
          {/* Selected Count */}
          <div className="text-sm text-mutedText">
            {selectedPermissions.size} of {allPermissions.length} permissions
            selected
          </div>

          {/* Permissions Grid */}
          <div className="max-h-96 overflow-y-auto space-y-4">
            {Object.entries(groupedPermissions).map(
              ([category, permissions]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-semibold text-primaryText capitalize border-b border-border pb-1">
                    {category.replace("_", " ")}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map((permission) => {
                      const isSelected = selectedPermissions.has(
                        permission.name
                      );

                      return (
                        <button
                          key={permission.name}
                          onClick={() =>
                            handleTogglePermission(permission.name)
                          }
                          disabled={isSaving}
                          className={`permission-item ${
                            isSelected ? "permission-item-selected" : ""
                          } ${
                            isSaving
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }
                          disabled:hover:bg-card disabled:hover:border-border
                        `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium capitalize leading-tight">
                                {permission.displayName}
                              </div>
                              <div className="text-xs text-mutedText mt-1 font-mono">
                                {permission.name}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex-shrink-0 ml-2">
                                <div className="permission-item-indicator">
                                  <X className="h-3 w-3" />
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-mutedText bg-transparent border border-border rounded-lg hover:bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
);

EditPermissionsModal.displayName = "EditPermissionsModal";

/**
 * Categorize permissions for better organization
 */
function getPermissionCategory(permission: string): string {
  if (permission.includes("user") || permission.includes("ban")) {
    return "User Management";
  }
  if (permission.includes("package")) {
    return "Package Management";
  }
  if (permission.includes("file")) {
    return "File Management";
  }
  if (
    permission.includes("admin") ||
    permission.includes("system") ||
    permission.includes("health") ||
    permission.includes("permission")
  ) {
    return "Admin";
  }
  return "Other";
}
