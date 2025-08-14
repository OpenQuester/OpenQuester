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

import { Modal } from "@/components/common/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { type UserDTO } from "@/types/dto";

interface UserDetailModalProps {
  user: UserDTO | null;
  onClose: () => void;
}

export const UserDetailModal = memo(
  ({ user, onClose }: UserDetailModalProps) => {
    const [showRaw, setShowRaw] = useState(false);
    if (!user) return null;
    const created = new Date(user.createdAt).toLocaleString();
    const updated = new Date(user.updatedAt).toLocaleString();
    return (
      <Modal isOpen={!!user} title={`User #${user.id}`} onClose={onClose}>
        <section className="space-y-3">
          <div className="flex items-start space-x-3">
            <Avatar
              src={user.avatar}
              fallback={user.name || user.username}
              size="md"
              alt={`${user.name || user.username}'s avatar`}
            />
            <div className="flex-1">
              <h4 className="text-base font-semibold text-primaryText flex items-center space-x-2">
                <span>{user.name || user.username}</span>
                {user.name && (
                  <span className="text-sm text-mutedText font-normal">
                    @{user.username}
                  </span>
                )}
                {user.isBanned ? (
                  <span className="badge badge-error">Banned</span>
                ) : user.isDeleted ? (
                  <span className="badge badge-gray">Deleted</span>
                ) : (
                  <span className="badge badge-success">Active</span>
                )}
                {user.isGuest && (
                  <span className="badge badge-warning">Guest</span>
                )}
              </h4>
              <p className="text-xs text-mutedText">
                Discord ID: {user.discordId || "-"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {
              <DetailItem
                icon={<User className="h-4 w-4" />}
                label="Display Name"
                value={user.name ? user.name : "-"}
              />
            }
            <DetailItem
              icon={<User className="h-4 w-4" />}
              label="Username"
              value={user.username}
            />
            <DetailItem
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={user.email || "-"}
            />
            <DetailItem
              icon={<UserCheck className="h-4 w-4" />}
              label="Account Type"
              value={user.isGuest ? "Guest" : "Registered"}
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
              value={String(user.permissions.length)}
            />
            <DetailItem
              icon={
                user.isBanned || user.isDeleted ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )
              }
              label="Status"
              value={
                user.isDeleted ? "Deleted" : user.isBanned ? "Banned" : "Active"
              }
            />
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-mutedText mb-2">
              Permissions
            </h5>
            {user.permissions.length ? (
              <div className="flex flex-wrap gap-2">
                {user.permissions.map((p) => (
                  <span key={p.id} className="badge badge-primary text-xs">
                    {p.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mutedText">No permissions assigned</p>
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
                {JSON.stringify(user, null, 2)}
              </pre>
            )}
          </div>
        </section>
      </Modal>
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
