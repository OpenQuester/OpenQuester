import { File } from "infrastructure/database/models/File";

export interface RegisterUser {
  username: string;
  name?: string | null;
  email?: string | null;
  discord_id?: string | null;
  birthday?: Date | null;
  avatar?: File | null;
  is_guest?: boolean;
}
