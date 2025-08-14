import { File } from "infrastructure/database/models/File";

export interface UpdateUserDTO {
  username?: string;
  name?: string;
  email?: string;
  birthday?: string;
  avatar?: File;
}
