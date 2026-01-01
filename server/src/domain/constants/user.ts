import { User } from "infrastructure/database/models/User";

// Discord-style username validation (2-32 chars, lowercase letters, numbers, underscore, period)
export const USER_USERNAME_MAX_CHARS = 32;
export const USER_USERNAME_MIN_CHARS = 2;

// Name validation (1-50 chars, allows whitespace but not consecutive, allows Unicode letters)
export const USER_NAME_MAX_CHARS = 50;
export const USER_NAME_MIN_CHARS = 1;

export const USER_SELECT_FIELDS: Array<keyof User> = [
  "id",
  "username",
  "name",
  "email",
  "discord_id",
  "birthday",
  "created_at",
  "updated_at",
  "is_deleted",
  "is_banned",
  "is_guest",
  "muted_until",
];

export const USER_RELATIONS: Array<keyof User> = ["avatar", "permissions"];
