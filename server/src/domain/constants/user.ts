import { User } from "infrastructure/database/models/User";

export const USER_NAME_MAX_CHARS = 30;
export const USER_NAME_MIN_CHARS = 3;

export const USER_SELECT_FIELDS: Array<keyof User> = [
  "id",
  "username",
  "email",
  "discord_id",
  "birthday",
  "created_at",
  "updated_at",
  "is_deleted",
  "is_banned",
];

export const USER_RELATIONS: Array<keyof User> = ["avatar", "permissions"];
