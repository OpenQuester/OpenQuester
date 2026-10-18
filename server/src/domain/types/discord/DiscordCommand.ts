/** Command types Discord knows; only the Activity entry point matters here */
export enum DiscordCommandType {
  CHAT_INPUT = 1,
  USER = 2,
  MESSAGE = 3,
  PRIMARY_ENTRY_POINT = 4
}

/** How Discord runs an entry point command */
export enum DiscordEntryPointHandler {
  APP_HANDLER = 1,
  /** Discord launches the Activity itself; no bot code involved */
  DISCORD_LAUNCH_ACTIVITY = 2
}

/** A registered application command, as `GET /applications/{id}/commands` lists it */
export interface DiscordCommand {
  id: string;
  type: DiscordCommandType;
  name: string;
}

/** Body that creates an application command */
export interface DiscordCommandInput {
  name: string;
  description: string;
  type: DiscordCommandType;
  handler?: DiscordEntryPointHandler;
  /** 0 guild install, 1 user install */
  integration_types: number[];
  /** 0 guild, 1 bot DM, 2 private channel */
  contexts: number[];
}
