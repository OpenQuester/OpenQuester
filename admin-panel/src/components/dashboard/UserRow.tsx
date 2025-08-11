import {
  Ban,
  Calendar,
  Check,
  Eye,
  Mail,
  RotateCcw,
  UserX,
} from "lucide-react";
import { memo, type ReactNode } from "react";

import {
  IconButtonVariant,
  IconButton as SharedIconButton,
} from "@/components/common/IconButton";
import { LabelNew } from "@/components/ui/LabelNew";
import { Permissions } from "@/constants/permissions";
import { ONE_WEEK_MS } from "@/constants/time";
import { useAuth } from "@/contexts/AuthContext";
import { type UserDTO } from "@/types/dto";
import { AdminBadge } from "../ui/badges/AdminBadge";

interface UserRowProps {
  user: UserDTO;
  onView: (u: UserDTO) => void;
  onBan: (id: number) => void;
  onUnban: (id: number) => void;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
}

const createdAtDelta = (createdAt: Date | string) => {
  return Date.now() - new Date(createdAt).getTime();
};

export const UserRow = memo(
  ({ user, onView, onBan, onUnban, onDelete, onRestore }: UserRowProps) => {
    const { hasPermission } = useAuth();
    const canBan = hasPermission(Permissions.BAN_USERS);
    const canDelete = hasPermission(Permissions.DELETE_ANOTHER_USER);
    const initial = user.username.charAt(0).toUpperCase();
    return (
      <div
        className="p-6 group hover:bg-hover transition-colors/75"
        key={user.id}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-sm group-hover:scale-[1.03] transition-transform">
                <span className="text-sm font-semibold text-white select-none">
                  {initial}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success-500 rounded-full border-2 border-surface" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-primaryText flex items-center gap-2 flex-wrap">
                  <span>{user.username}</span>
                  {user.permissions?.some(
                    (p) => p.name === Permissions.ADMIN_PANEL_ACCESS
                  ) && <AdminBadge />}
                </p>
                {createdAtDelta(user.createdAt) <= ONE_WEEK_MS && <LabelNew />}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1">
                <UserMeta
                  icon={<Mail className="h-3 w-3" />}
                  label={user.email}
                />
                <UserMeta
                  icon={<Calendar className="h-3 w-3" />}
                  label={new Date(user.createdAt).toLocaleDateString()}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <SharedIconButton
              ariaLabel="View details"
              title="View details"
              onClick={() => onView(user)}
            >
              <Eye className="h-4 w-4" />
            </SharedIconButton>
            {canBan &&
              !user.isDeleted &&
              (!user.isBanned ? (
                <SharedIconButton
                  ariaLabel="Ban user"
                  title="Ban user"
                  onClick={() => onBan(user.id)}
                  variant={IconButtonVariant.DANGER}
                >
                  <Ban className="h-4 w-4" />
                </SharedIconButton>
              ) : (
                <SharedIconButton
                  ariaLabel="Unban user"
                  title="Unban user"
                  onClick={() => onUnban(user.id)}
                  variant={IconButtonVariant.SUCCESS}
                >
                  <Check className="h-4 w-4" />
                </SharedIconButton>
              ))}
            {canDelete && onDelete && !user.isDeleted && (
              <SharedIconButton
                ariaLabel="Delete user"
                title="Delete user"
                onClick={() => onDelete(user.id)}
                variant={IconButtonVariant.DANGER}
              >
                <UserX className="h-4 w-4" />
              </SharedIconButton>
            )}
            {canDelete && onRestore && user.isDeleted && (
              <SharedIconButton
                ariaLabel="Restore user"
                title="Restore user"
                onClick={() => onRestore(user.id)}
                variant={IconButtonVariant.SUCCESS}
              >
                <RotateCcw className="h-4 w-4" />
              </SharedIconButton>
            )}
          </div>
        </div>
      </div>
    );
  }
);
UserRow.displayName = "UserRow";

const UserMeta = ({ icon, label }: { icon: ReactNode; label: string }) => (
  <div className="flex items-center gap-1 text-xs text-mutedText">
    {icon}
    <span className="truncate max-w-[140px]" title={label}>
      {label}
    </span>
  </div>
);
