import { type UserDTO } from "@/types/dto";
import { createApiClient } from "./client";

const authClient = createApiClient("/v1");

export const authApi = {
  // Current authenticated user (permissions included)
  getCurrentUser: async (): Promise<UserDTO> => {
    const { data } = await authClient.get<UserDTO>("/me");
    return data;
  },
};
