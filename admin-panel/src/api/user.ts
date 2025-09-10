import { createApiClient } from "@/api/client";
import { wrap } from "@/api/errors";
import type { UserDTO } from "@/types/dto";

interface UpdatePermissionsRequest {
  permissions: string[];
}

interface UpdatePermissionsResponse {
  message: string;
  data: UserDTO;
}

const userClient = createApiClient("/v1");

export const userApi = {
  // Update user permissions
  updatePermissions: async (
    userId: number,
    permissions: string[]
  ): Promise<UserDTO> =>
    wrap("permissions.update", async () => {
      const { data } = await userClient.patch<UpdatePermissionsResponse>(
        `/users/${userId}/permissions`,
        { permissions } as UpdatePermissionsRequest
      );
      return data.data;
    }),
};
