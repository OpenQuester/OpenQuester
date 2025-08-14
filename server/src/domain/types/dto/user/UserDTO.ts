import { PermissionDTO } from "domain/types/dto/permission/PermissionDTO";

export interface UserDTO {
  id: number;
  username: string;
  name?: string | null;
  email?: string | null;
  discordId?: string | null;
  birthday?: Date | null;
  /** presigned link to file in bucket */
  avatar?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  isBanned: boolean;
  isGuest: boolean;
  permissions: PermissionDTO[] | [];
}
