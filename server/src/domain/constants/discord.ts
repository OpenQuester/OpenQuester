import {
  type DiscordCommandInput,
  DiscordCommandType,
  DiscordEntryPointHandler
} from "domain/types/discord/DiscordCommand";

export const getDiscordCDNLink = (discordUserId: string, filename: string) => {
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${filename}`;
};

export const DISCORD_API_URL = "https://discord.com/api";

/** Discord calls made at startup give up after this long */
export const DISCORD_STARTUP_REQUEST_TIMEOUT_MS = 5000;

/** Discord calls made while a request waits (sign-in, lobby checks) give up after this long */
export const DISCORD_REQUEST_TIMEOUT_MS = 5000;

/** Client-credentials scope that may create the application's own commands */
export const DISCORD_COMMANDS_UPDATE_SCOPE = "applications.commands.update";

/**
 * The "Launch" command Discord shows in the app launcher. Discord makes it
 * when Activities are first enabled, but not always; the server adds it when
 * it is missing.
 */
export const DISCORD_ACTIVITY_ENTRY_POINT: DiscordCommandInput = {
  name: "launch",
  description: "Play OpenQuester in this voice channel",
  type: DiscordCommandType.PRIMARY_ENTRY_POINT,
  handler: DiscordEntryPointHandler.DISCORD_LAUNCH_ACTIVITY,
  integration_types: [0, 1],
  contexts: [0, 1, 2]
};

/** Discord serves an Activity from `https://{clientId}.discordsays.com` */
export const getDiscordActivityOrigin = (clientId: string): string => {
  return `https://${clientId}.discordsays.com`;
};

/** Pages that may embed the web app as an Activity */
export const DISCORD_ACTIVITY_FRAME_ANCESTORS = [
  "https://discord.com",
  "https://*.discord.com",
  "https://*.discordsays.com"
];

/** URL mapping prefix the Developer Portal must point at the media host */
export const DISCORD_ACTIVITY_MEDIA_PREFIX = "/media";

/** One Activity instance keeps its lobby for this long without a new game */
export const DISCORD_ACTIVITY_GAME_TTL_MS = 12 * 60 * 60 * 1000;

/** Guards get-or-create so two launches in one call can't make two lobbies */
export const DISCORD_ACTIVITY_LOCK_TTL_SECONDS = 10;

export const getDiscordActivityGameKey = (instanceId: string): string => {
  return `discord:activity:${instanceId}:game`;
};

export const getDiscordActivityLockKey = (instanceId: string): string => {
  return `discord:activity:${instanceId}:lock`;
};

/** A confirmed call member isn't rechecked with Discord for this long (the lobby polls) */
export const DISCORD_ACTIVITY_MEMBER_TTL_MS = 10 * 60 * 1000;

export const getDiscordActivityMemberKey = (instanceId: string, discordUserId: string): string => {
  return `discord:activity:${instanceId}:member:${discordUserId}`;
};
