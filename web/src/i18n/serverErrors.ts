import { i18n } from "./index";

/**
 * Socket errors arrive as plain server messages. Known client-side codes get a
 * translated sentence; anything else is shown as the server wrote it.
 */
export function translateServerError(message: string): string {
  const key = `errors.${message}`;
  return i18n.exists(key) ? i18n.t(key) : message;
}
