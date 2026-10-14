# Admin panel, staff roles and moderation

The web admin panel lives at `/admin` (`web/src/features/admin/`). The REST API is
`/v1/admin/api/*` (`AdminRestApiController`).

## Roles

A role is not stored. It is a named set of permissions (`server/src/domain/constants/staffRoles.ts`):

| Role      | Rule                                   | Default permissions                                                                                                                        |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin     | has `manage_permissions`               | every permission                                                                                                                           |
| Moderator | has `admin_panel_access`, not an admin | `admin_panel_access`, `view_users_info`, `get_all_users`, `get_another_user`, `ban_users`, `mute_player`, `manage_games`, `delete_package` |
| User      | anything else                          | none                                                                                                                                       |

Not given to moderators by default: deleting accounts, editing other people's profiles or packages,
deleting files, permissions, server health and logs. An admin picks a role in the Users tab (that
applies the preset) and can then tick any permission on or off for that person
(`PUT /v1/admin/api/users/{id}/permissions`, `GET /v1/admin/api/roles`).

Guards on every admin action on another account (`AdminService.assertCanModerateUser`):

- Nobody acts on their own account (`cannot_moderate_self`, 403).
- Only admins act on staff, i.e. admins and moderators (`cannot_moderate_staff`, 403).

`ADMIN_EMAILS` grants every permission at startup. A dev account listed there that is created later
(`POST /v1/dev/login/:num`, dev only) becomes admin on its first login; the web e2e stack uses
`dev@example.com-990001`.

## Games (`manage_games`)

- `GET /games` lists every game, private ones included. `GET /games/{id}` adds everyone in it.
- `POST /games/{id}/players/{playerId}/kick` removes anyone connected, the showman included. The
  room receives `player-kicked`.
- `POST /games/{id}/pause` and `/unpause` work like the showman's; the room receives `game-pause` /
  `game-unpause`.
- `DELETE /games/{id}` closes the game: everyone in it receives `game-closed`
  (`{ gameId, reason: "moderator" }`), the game is deleted, and the lobby list receives the usual
  `games` delete event. The web client sends everyone home with "A moderator closed the game."

Each of these is a moderation `GameActionType` (`ADMIN_*`) submitted through `GameActionExecutor`, so
it queues behind in-flight player actions. They have no socket event. Players who left stay in the
game as `disconnected` (seat and score kept); the panel shows them as "Left or offline".

## Packages

`delete_package` and `edit_package` already let staff delete or edit anyone's package
(`DELETE`/`PUT /v1/packages/{id}`); the Packages tab lists every package with those actions.
