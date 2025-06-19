import { UpdateUserDTO } from "domain/types/dto/user/UpdateUserDTO";

export interface UpdateUserInputDTO
  extends Pick<UpdateUserDTO, "username" | "email" | "birthday"> {
  avatar?: string;
}
