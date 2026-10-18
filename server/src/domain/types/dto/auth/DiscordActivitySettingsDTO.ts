/** One Discord Activity URL mapping: requests to `target` go through `prefix` */
export interface DiscordUrlMappingDTO {
  prefix: string;
  /** Host (and optional path) without the scheme, as the Embedded App SDK expects */
  target: string;
}

/** What the web app needs to run as a Discord Activity */
export interface DiscordActivitySettingsDTO {
  /**
   * Hosts outside the app that the Activity loads from (package media).
   * Each needs the same mapping in the Developer Portal.
   */
  urlMappings: DiscordUrlMappingDTO[];
}
