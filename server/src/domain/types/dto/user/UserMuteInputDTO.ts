import { userId } from "domain/types/ids";

export interface UserMuteInputDTO {
  userId: userId;
  mutedUntil: string;
}
