import {
  Calendar,
  KeyRound,
  Mail,
  Shield,
  ShieldOff,
  User,
  UserCheck,
} from "lucide-react";
import React, { memo, useState } from "react";

import { userApi } from "@/api/user";
import { Modal } from "@/components/common/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { EditPermissionsModal } from "@/components/users/EditPermissionsModal";
import { Permissions } from "@/constants/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { type UserDTO } from "@/types/dto";

interface UserDetailModalProps {
  user: UserDTO | null;
  onClose: () => void;
  onUserUpdated?: (updatedUser: UserDTO) => void;
}

export const UserDetailModal = memo(
  ({ user, onClose, onUserUpdated }: UserDetailModalProps) => {
    const [showRaw, setShowRaw] = useState(false);
    const [isEditPermissionsOpen, setIsEditPermissionsOpen] = useState(false);
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserDTO | null>(user);

    const { hasPermission } = useAuth();
    const { push: pushToast } = useToast();

    const canManagePermissions = hasPermission(Permissions.MANAGE_PERMISSIONS);

    // Update currentUser when user prop changes
    React.useEffect(() => {
      setCurrentUser(user);
      // Reset edit permissions modal when user changes
      if (!user) {
        setIsEditPermissionsOpen(false);
      }
    }, [user]);

    if (!currentUser) return null;

    const created = new Date(currentUser.createdAt).toLocaleString();
    const updated = new Date(currentUser.updatedAt).toLocaleString();

    const handleSavePermissions = async (permissions: string[]) => {
      if (!currentUser) return;

      setIsSavingPermissions(true);
      try {
        const updatedUser = await userApi.updatePermissions(
          currentUser.id,
          permissions
        );
        setCurrentUser(updatedUser);
        onUserUpdated?.(updatedUser);
        setIsEditPermissionsOpen(false);
        pushToast({
          variant: "success",
          title: "Permissions updated",
          description: `Successfully updated permissions for ${
            updatedUser.name || updatedUser.username
          }`,
        });
      } catch (error) {
        console.error("Failed to update permissions:", error);
        pushToast({
          variant: "error",
          title: "Update failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to update permissions",
        });
      } finally {
        setIsSavingPermissions(false);
      }
    };

    const handleClose = () => {
      setIsEditPermissionsOpen(false);
      setShowRaw(false);
      onClose();
    };
    return (
      <>
        <Modal
          isOpen={!!currentUser}
          title={`User #${currentUser.id}`}
          onClose={handleClose}
        >
          <section className="space-y-3">
            <div className="flex items-start space-x-3">
              <Avatar
                src={currentUser.avatar}
                fallback={currentUser.name || currentUser.username}
                size="md"
                alt={`${currentUser.name || currentUser.username}'s avatar`}
              />
              <div className="flex-1">
                <h4 className="text-base font-semibold text-primaryText flex items-center space-x-2">
                  <span>{currentUser.name || currentUser.username}</span>
                  {currentUser.name && (
                    <span className="text-sm text-mutedText font-normal">
                      @{currentUser.username}
                    </span>
                  )}
                  {currentUser.isBanned ? (
                    <span className="badge badge-error">Banned</span>
                  ) : currentUser.isDeleted ? (
                    <span className="badge badge-gray">Deleted</span>
                  ) : (
                    <span className="badge badge-success">Active</span>
                  )}
                  {currentUser.isGuest && (
                    <span className="badge badge-warning">Guest</span>
                  )}
                </h4>
                <p className="text-xs text-mutedText">
                  Discord ID: {currentUser.discordId || "-"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {
                <DetailItem
                  icon={<User className="h-4 w-4" />}
                  label="Display Name"
                  value={currentUser.name ? currentUser.name : "-"}
                />
              }
              <DetailItem
                icon={<User className="h-4 w-4" />}
                label="Username"
                value={currentUser.username}
              />
              <DetailItem
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={currentUser.email || "-"}
              />
              <DetailItem
                icon={<UserCheck className="h-4 w-4" />}
                label="Account Type"
                value={currentUser.isGuest ? "Guest" : "Registered"}
              />
              <DetailItem
                icon={<Calendar className="h-4 w-4" />}
                label="Created"
                value={created}
              />
              <DetailItem
                icon={<Calendar className="h-4 w-4" />}
                label="Updated"
                value={updated}
              />
              <DetailItem
                icon={<KeyRound className="h-4 w-4" />}
                label="Permissions"
                value={String(currentUser.permissions.length)}
              />
              <DetailItem
                icon={
                  currentUser.isBanned || currentUser.isDeleted ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )
                }
                label="Status"
                value={
                  currentUser.isDeleted
                    ? "Deleted"
                    : currentUser.isBanned
                    ? "Banned"
                    : "Active"
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-mutedText">
                  Permissions
                </h5>
                {canManagePermissions && (
                  <button
                    onClick={() => setIsEditPermissionsOpen(true)}
                    className="btn-interactive"
                  >
                    Edit Permissions
                  </button>
                )}
              </div>
              {currentUser.permissions.length ? (
                <div className="flex flex-wrap gap-2">
                  {currentUser.permissions.map((p) => (
                    <span key={p.id} className="badge badge-primary text-xs">
                      {p.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-mutedText">
                  No permissions assigned
                </p>
              )}
            </div>
            <div>
              <button
                onClick={() => setShowRaw((s) => !s)}
                className="text-xs font-medium text-primary-600 hover:underline focus:outline-none"
              >
                {showRaw ? "Hide raw JSON" : "Show raw JSON"}
              </button>
              {showRaw && (
                <pre className="mt-2 p-3 bg-card rounded-lg overflow-x-auto text-xs text-secondaryText whitespace-pre-wrap break-words">
                  {JSON.stringify(currentUser, null, 2)}
                </pre>
              )}
            </div>
          </section>
        </Modal>

        <EditPermissionsModal
          user={currentUser}
          isOpen={isEditPermissionsOpen}
          onClose={() => setIsEditPermissionsOpen(false)}
          onSave={handleSavePermissions}
          isSaving={isSavingPermissions}
        />
      </>
    );
  }
);
UserDetailModal.displayName = "UserDetailModal";

interface DetailItemProps {
  icon: React.JSX.Element;
  label: string;
  value: string;
}
const DetailItem = ({ icon, label, value }: DetailItemProps) => (
  <div className="p-3 rounded-lg border border-border bg-card">
    <div className="flex items-center space-x-2 text-xs font-medium text-mutedText mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-sm font-medium text-primaryText break-all">
      {value || "-"}
    </p>
  </div>
);
