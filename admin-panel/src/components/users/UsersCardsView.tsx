import { EmptyState } from "@/components/common/EmptyState";
import { UserCard } from "@/components/users/UserCard";
import type { UserDTO } from "@/types/dto";
import { Users } from "lucide-react";
import React from "react";

interface UsersCardsViewProps {
  users: UserDTO[];
  onView: (user: UserDTO) => void;
  onBan: (id: number) => void;
  onUnban: (id: number) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
}

export const UsersCardsView: React.FC<UsersCardsViewProps> = ({
  users,
  onView,
  onBan,
  onUnban,
  onDelete,
  onRestore,
}) => {
  if (users.length === 0) {
    return (
      <div className="col-span-full card" data-testid="users-cards-empty">
        <EmptyState
          icon={<Users className="h-16 w-16 text-mutedText" />}
          title="No users found"
          message="No users on this page."
        />
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="users-cards-view"
    >
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onView={onView}
          onBan={onBan}
          onUnban={onUnban}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
};
