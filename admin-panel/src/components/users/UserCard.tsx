import { Ban, Check, Eye, RotateCcw, UserX } from "lucide-react";
import { memo } from "react";

import { IconButton, IconButtonVariant } from "@/components/common/IconButton";
import { Avatar } from "@/components/ui/Avatar";
import { AdminBadge } from "@/components/ui/badges/AdminBadge";
import { GuestBadge } from "@/components/ui/badges/GuestBadge";
import { NewBadge } from "@/components/ui/badges/NewBadge";
import { Permissions } from "@/constants/permissions";
import { ONE_WEEK_MS } from "@/constants/time";
import { useAuth } from "@/contexts/AuthContext";
import { type UserDTO } from "@/types/dto";
import { truncateWithTooltip } from "@/utils/text";

interface UserCardProps {
  user: UserDTO;
  onView: (user: UserDTO) => void;
  onBan: (id: number) => void;
  onUnban: (id: number) => void;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
}

export const UserCard = memo(
  ({ user, onView, onBan, onUnban, onDelete, onRestore }: UserCardProps) => {
    const { hasPermission } = useAuth();
    const canBan = hasPermission(Permissions.BAN_USERS);
    const canDelete = hasPermission(Permissions.DELETE_ANOTHER_USER);

    const displayName = user.name || user.username;
    const nameData = truncateWithTooltip(displayName, 15);
    const usernameData = user.name
      ? truncateWithTooltip(user.username, 15)
      : null;

    return (
      <div className="card">
        <div className="p-6">
          <div className="flex">
            {/* User Information Column - 80% */}
            <div className="flex-1 min-w-0">
              {/* Avatar, Name, Username Row */}
              <div className="flex items-center space-x-3 mb-4">
                <Avatar
                  src={user.avatar}
                  fallback={displayName}
                  size="md"
                  alt={`${displayName}'s avatar`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-primaryText flex items-center gap-2 flex-wrap">
                      <span
                        title={
                          nameData.isTruncated ? nameData.title : undefined
                        }
                        className={nameData.isTruncated ? "cursor-help" : ""}
                      >
                        {nameData.displayText}
                      </span>
                      {usernameData && (
                        <span
                          className="text-sm text-mutedText font-normal"
                          title={
                            usernameData.isTruncated
                              ? usernameData.title
                              : undefined
                          }
                        >
                          @{usernameData.displayText}
                        </span>
                      )}
                    </h3>
                    {user.permissions?.some(
                      (p) => p.name === Permissions.ADMIN_PANEL_ACCESS
                    ) && <AdminBadge />}
                    {user.isGuest && <GuestBadge />}
                  </div>
                  <p className="text-sm text-secondaryText">
                    {user.email || "No email"}
                  </p>
                </div>
              </div>

              {/* User Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-mutedText">ID</p>
                  <p className="font-mono text-xs mt-1">#{user.id}</p>
                </div>
                <div>
                  <p className="text-mutedText">Status</p>
                  <p
                    className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.isDeleted
                        ? "badge-gray"
                        : user.isBanned
                        ? "badge-error"
                        : "badge-success"
                    }`}
                  >
                    {user.isDeleted
                      ? "Deleted"
                      : user.isBanned
                      ? "Banned"
                      : "Active"}
                  </p>
                  {Date.now() - new Date(user.createdAt).getTime() <
                    2 * ONE_WEEK_MS && <NewBadge />}
                </div>
              </div>
            </div>

            {/* Action Buttons Column - 20% */}
            <div className="w-10 flex flex-col space-y-2 flex-shrink-0">
              <IconButton
                ariaLabel="View details"
                onClick={() => onView(user)}
                title="View details"
              >
                <Eye className="h-5 w-5" />
              </IconButton>
              {canBan &&
                !user.isDeleted &&
                (!user.isBanned ? (
                  <IconButton
                    ariaLabel="Ban user"
                    title="Ban user"
                    onClick={() => onBan(user.id)}
                    variant={IconButtonVariant.DANGER}
                  >
                    <Ban className="h-5 w-5" />
                  </IconButton>
                ) : (
                  <IconButton
                    ariaLabel="Unban user"
                    title="Unban user"
                    onClick={() => onUnban(user.id)}
                    variant={IconButtonVariant.SUCCESS}
                  >
                    <Check className="h-5 w-5" />
                  </IconButton>
                ))}
              {canDelete && onDelete && !user.isDeleted && (
                <IconButton
                  ariaLabel="Delete user"
                  title="Delete user"
                  onClick={() => onDelete(user.id)}
                  variant={IconButtonVariant.DANGER}
                >
                  <UserX className="h-5 w-5" />
                </IconButton>
              )}
              {canDelete && onRestore && user.isDeleted && (
                <IconButton
                  ariaLabel="Restore user"
                  title="Restore user"
                  onClick={() => onRestore(user.id)}
                  variant={IconButtonVariant.SUCCESS}
                >
                  <RotateCcw className="h-5 w-5" />
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

UserCard.displayName = "UserCard";
