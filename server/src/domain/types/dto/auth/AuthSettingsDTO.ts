/** Public sign-in settings the clients read at runtime */
export interface AuthSettingsDTO {
  /** Discord application id for Discord sign-in, or null when it is off */
  discordClientId: string | null;
}
