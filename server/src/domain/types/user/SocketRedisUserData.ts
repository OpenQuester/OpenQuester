import { userId } from "../ids";

export interface SocketRedisUserData {
  id: userId;
  gameId: string | null;
}
