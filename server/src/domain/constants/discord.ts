export const getDiscordCDNLink = (discordUserId: string, filename: string) => {
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${filename}`;
};

export const DISCORD_API_URL = "https://discord.com/api";

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
