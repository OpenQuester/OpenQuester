import { type UserDTO } from "domain/types/dto/user/UserDTO";

export interface DiscordActivityLoginInputDTO {
  /** Code from the Embedded App SDK's `authorize` command */
  code: string;
}

export interface DiscordActivityLoginDTO {
  user: UserDTO;
  /** Discord access token the Activity passes to the SDK's `authenticate` command */
  accessToken: string;
}
