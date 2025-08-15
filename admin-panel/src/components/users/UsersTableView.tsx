import { Ban, Check, Eye, RotateCcw, Users, UserX } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import {
  IconButton,
  IconButtonSize,
  IconButtonVariant,
} from "@/components/common/IconButton";
import { SortButton } from "@/components/common/SortButton";
import { Avatar } from "@/components/ui/Avatar";
import { AdminBadge } from "@/components/ui/badges/AdminBadge";
import { GuestBadge } from "@/components/ui/badges/GuestBadge";
import { NewBadge } from "@/components/ui/badges/NewBadge";
import { Permissions } from "@/constants/permissions";
import { ONE_WEEK_MS } from "@/constants/time";
import type { PaginationOrder, UserDTO } from "@/types/dto";
import { truncateWithTooltip } from "@/utils/text";

interface UsersTableViewProps {
  users: UserDTO[];
  sortBy: string;
  order: PaginationOrder;
  onSort: (field: string) => void;
  hasPermission: (perm: Permissions) => boolean;
  onView: (user: UserDTO) => void;
  onBan: (id: number) => void;
  onUnban: (id: number) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
}

export const UsersTableView: React.FC<UsersTableViewProps> = ({
  users,
  sortBy,
  order,
  onSort,
  hasPermission,
  onView,
  onBan,
  onUnban,
  onDelete,
  onRestore,
}) => {
  return (
    <div className="card overflow-hidden" data-testid="users-table-view">
      <div className="overflow-x-auto">
        <table className="table">
          <thead className="bg-card">
            <tr>
              <th className="table-header">
                <SortButton
                  activeField={sortBy}
                  order={order}
                  field="id"
                  onSort={onSort}
                >
                  ID
                </SortButton>
              </th>
              <th className="table-header">
                <SortButton
                  activeField={sortBy}
                  order={order}
                  field="username"
                  onSort={onSort}
                >
                  User
                </SortButton>
              </th>
              <th className="table-header">
                <SortButton
                  activeField={sortBy}
                  order={order}
                  field="email"
                  onSort={onSort}
                >
                  Email
                </SortButton>
              </th>
              <th className="table-header">
                <SortButton
                  activeField={sortBy}
                  order={order}
                  field="created_at"
                  onSort={onSort}
                >
                  Created
                </SortButton>
              </th>
              <th className="table-header">Status</th>
              <th className="table-header w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length > 0 ? (
              users.map((user) => {
                const isNew =
                  Date.now() - new Date(user.createdAt).getTime() <
                  2 * ONE_WEEK_MS;

                const displayName = user.name || user.username;
                const nameData = truncateWithTooltip(displayName, 12);
                const usernameData = user.name
                  ? truncateWithTooltip(user.username, 12)
                  : null;

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-hover transition-colors"
                  >
                    <td className="table-cell font-mono text-xs">#{user.id}</td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-3">
                        <Avatar
                          src={user.avatar}
                          fallback={displayName}
                          size="sm"
                          alt={`${displayName}'s avatar`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium flex items-center gap-2 flex-wrap">
                            <span
                              title={
                                nameData.isTruncated
                                  ? nameData.title
                                  : undefined
                              }
                              className={
                                nameData.isTruncated ? "cursor-help" : ""
                              }
                            >
                              {nameData.displayText}
                            </span>
                            {usernameData && (
                              <span
                                className="text-xs text-mutedText font-normal"
                                title={
                                  usernameData.isTruncated
                                    ? usernameData.title
                                    : undefined
                                }
                              >
                                @{usernameData.displayText}
                              </span>
                            )}
                            {isNew && <NewBadge />}
                            {user.permissions?.some(
                              (p) => p.name === Permissions.ADMIN_PANEL_ACCESS
                            ) && <AdminBadge />}
                            {user.isGuest && <GuestBadge />}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-secondaryText">{user.email}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-mutedText">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      {(() => {
                        const isDeleted = (user as any).isDeleted;
                        const isBanned = user.isBanned;
                        const label = isDeleted
                          ? "Deleted"
                          : isBanned
                          ? "Banned"
                          : "Active";
                        const cls = isDeleted
                          ? "badge-gray"
                          : isBanned
                          ? "badge-error"
                          : "badge-success";
                        return <span className={`badge ${cls}`}>{label}</span>;
                      })()}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-1">
                        <IconButton
                          ariaLabel="View details"
                          size={IconButtonSize.SM}
                          onClick={() => onView(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        {(user as any).isDeleted ? (
                          hasPermission(Permissions.DELETE_ANOTHER_USER) && (
                            <IconButton
                              ariaLabel="Restore user"
                              size={IconButtonSize.SM}
                              onClick={() => onRestore(user.id)}
                              variant={IconButtonVariant.SUCCESS}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </IconButton>
                          )
                        ) : (
                          <>
                            {hasPermission(Permissions.BAN_USERS) &&
                              (!user.isBanned ? (
                                <IconButton
                                  ariaLabel="Ban user"
                                  size={IconButtonSize.SM}
                                  onClick={() => onBan(user.id)}
                                  variant={IconButtonVariant.DANGER}
                                >
                                  <Ban className="h-4 w-4" />
                                </IconButton>
                              ) : (
                                <IconButton
                                  ariaLabel="Unban user"
                                  size={IconButtonSize.SM}
                                  onClick={() => onUnban(user.id)}
                                  variant={IconButtonVariant.SUCCESS}
                                >
                                  <Check className="h-4 w-4" />
                                </IconButton>
                              ))}
                            {hasPermission(Permissions.DELETE_ANOTHER_USER) && (
                              <IconButton
                                ariaLabel="Delete user"
                                size={IconButtonSize.SM}
                                onClick={() => onDelete(user.id)}
                                variant={IconButtonVariant.DANGER}
                              >
                                <UserX className="h-4 w-4" />
                              </IconButton>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <EmptyState
                    icon={<Users className="h-12 w-12 text-mutedText" />}
                    title="No users found"
                    message="No users on this page."
                    compact
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
