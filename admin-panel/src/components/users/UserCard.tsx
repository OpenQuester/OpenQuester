import { Ban, Check, Eye, RotateCcw, UserX } from "lucide-react";
import { memo } from "react";

import { IconButton, IconButtonVariant } from "@/components/common/IconButton";
import { AdminBadge } from "@/components/ui/badges/AdminBadge";
import { Permissions } from "@/constants/permissions";
import { ONE_WEEK_MS } from "@/constants/time";
import { useAuth } from "@/contexts/AuthContext";
import { type UserDTO } from "@/types/dto";

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
    return (
      <div className="card">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-primaryText flex items-center gap-2 flex-wrap">
                      <span>{user.username}</span>
                      {Date.now() - new Date(user.createdAt).getTime() <
                        2 * ONE_WEEK_MS && (
                        <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700">
                          New
                        </span>
                      )}
                    </h3>
                    {user.permissions?.some(
                      (p) => p.name === Permissions.ADMIN_PANEL_ACCESS
                    ) && <AdminBadge />}
                  </div>
                  <p className="text-sm text-secondaryText">{user.email}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-mutedText">ID</p>
                  <p className="font-mono text-xs mt-1">#{user.id}</p>
                </div>
                <div>
                  <p className="text-mutedText">Joined</p>
                  <p className="mt-1 text-secondaryText">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
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
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-2 ml-4">
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
