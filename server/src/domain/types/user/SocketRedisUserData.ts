import { userId } from "domain/types/ids";

export interface SocketRedisUserData {
  id: userId;
  gameId: string | null;
}
