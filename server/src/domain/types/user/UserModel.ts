import { BaseModel } from "domain/types/BaseModel";
import { File } from "infrastructure/database/models/File";
import { Permission } from "infrastructure/database/models/Permission";
import { userId } from "../ids";

/** All possible user fields */
export interface UserModel extends BaseModel {
  id?: userId;
  username: string;
  name?: string | null;
  email?: string | null;
  discord_id?: string | null;
  birthday?: Date | null;
  avatar?: File | null;
  permissions?: Permission[];
  is_banned?: boolean;
  is_guest?: boolean;
  muted_until?: Date | null;
}
