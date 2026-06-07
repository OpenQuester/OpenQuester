import { UpdateUserDTO } from "application/types/user/UpdateUserDTO";

export interface UpdateUserInputDTO
  extends Pick<UpdateUserDTO, "username" | "name" | "email" | "birthday"> {
  avatar?: string;
}
