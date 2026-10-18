/** Discord's answer to an OAuth2 code exchange */
export interface DiscordToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
