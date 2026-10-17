import { Permissions } from "domain/enums/Permissions";

/**
 * Staff role presets for the admin panel. A role is not stored: it is a
 * named set of permissions, and an admin can tick permissions on or off for
 * each staff member afterwards. Admins hold every permission.
 */
export enum StaffRole {
  USER = "user",
  MODERATOR = "moderator",
  ADMIN = "admin"
}

/**
 * Default moderator permissions: day-to-day moderation of people, games and
 * packages. Left out on purpose: deleting accounts, editing other people's
 * packages or profiles, files, permissions and server internals.
 */
export const MODERATOR_DEFAULT_PERMISSIONS: readonly Permissions[] = [
  Permissions.ADMIN_PANEL_ACCESS,
  Permissions.VIEW_USERS_INFO,
  Permissions.GET_ALL_USERS,
  Permissions.GET_ANOTHER_USER,
  Permissions.BAN_USERS,
  Permissions.MUTE_PLAYER,
  Permissions.MANAGE_GAMES,
  Permissions.DELETE_PACKAGE
];

export const ADMIN_PERMISSIONS: readonly Permissions[] = Object.values(Permissions);

/**
 * Derives the role shown in the admin panel. Anyone who can manage
 * permissions is an admin; anyone else with panel access is a moderator.
 */
export function staffRoleOf(permissionNames: readonly string[]): StaffRole {
  if (permissionNames.includes(Permissions.MANAGE_PERMISSIONS)) {
    return StaffRole.ADMIN;
  }

  if (permissionNames.includes(Permissions.ADMIN_PANEL_ACCESS)) {
    return StaffRole.MODERATOR;
  }

  return StaffRole.USER;
}
