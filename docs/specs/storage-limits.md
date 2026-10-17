# Storage limits

Status: **built** (migration 0.26.0). Decisions taken by the project owner:
shared files count for every user who uses them, the defaults below apply
with admin overrides per group and per user, and guests may store an avatar
with automatic cleanup of their files and accounts.

## Model

- Media is content-addressed: the S3 key is the file's MD5, so identical files
  are stored once. Deduplication saves bucket space, not user quota.
- `file.size` holds each file's bytes: declared by the uploader
  (`fileSizes` in `POST`/`PUT /v1/packages`), then confirmed from storage
  (`size_verified_at`) by `HeadObject` on the user's next upload and by the
  nightly bucket listing. The same confirmation decides whether a package's
  upload is finished (`docs/specs/package-upload-state.md`).
- **A user's usage** is the sum of distinct MD5s referenced by packages they
  wrote plus their avatar (`StorageRepository.getUserFiles`). A file in
  several of your packages counts once; a file someone else also uses counts
  for both of you.

## Groups and limits

A user's group is derived, never stored: `guest` (is_guest), `admin`
(manage_permissions), `moderator` (admin_panel_access), else `user`.
Limits live in the `storage_limit` table, one row per group; null means no
limit. `user.storage_quota_bytes` overrides the total for one user.

| Group | Total | Package | Picture | Sound | Video |
| --- | --- | --- | --- | --- | --- |
| guest | 20 MB | 0 | 5 MB | 0 | 0 |
| user | 1 GB | 500 MB | 10 MB | 20 MB | 100 MB |
| moderator | 1 GB | 500 MB | 10 MB | 20 MB | 100 MB |
| admin | none | none | none | none | none |

`S3_BUCKET_QUOTA_BYTES` (optional) caps the whole bucket: new uploads are
refused with 507 at 95 %, admins excepted. Games keep working.

## Enforcement

`StorageQuotaService.assertPackageFits` runs in `POST /v1/packages` and
`PUT /v1/packages/{id}` before any upload link is issued. Over a limit the
API answers **413** with a message naming the limit and the sizes, for
example "This package's media is 620 MB; the limit for one package is
500 MB." Edits are charged to the package's author, and the package being
replaced does not count against itself.

On an upload, previously declared file sizes are confirmed before evaluating
file and package limits, so that upload uses any newly measured storage sizes.

Avatars (`PATCH /v1/me` with a new avatar) are checked against the picture
limit and the total using the stored object's real size.
Replacement excludes the old avatar's usage, but the old file still counts
if one of the user's packages references it. The new avatar counts once even
when it is already used in their packages.
`POST /v1/files/{filename}` needs a session (guests included).

Clients that send no `fileSizes` (older Flutter builds) are checked with the
sizes already known at creation. Before new or replaced content becomes
`ready`, every referenced file must have a storage-confirmed size and the
file, package, author's total, and bucket limits are checked again. This
includes logos, question/answer media, and choice images. Missing or false
declarations cannot make over-quota content playable; the upload state and
game creation endpoints return 413 (or 507 for the bucket) until it fits.

This is an acceptance limit, not an S3 transfer limit: presigned PUTs and the
generic file endpoint can still receive bytes before they are checked.
Rejected packages remain `uploading` and retain their references until edited
or deleted. Existing ready packages and running games are not revalidated.

## Cleanup

- Package delete, package edit and avatar change delete files that lost
  their last use (`StorageCleanupService.removeIfUnused`).
- Nightly (`S3FilesCleanupJob`, `CRON_S3_CLEANUP_EXPRESSION`):
  unused files older than 24 hours are deleted, objects with no database row
  are deleted, and every stored file's size is recorded from the listing.
- Nightly (`GuestCleanupJob`, `CRON_GUEST_CLEANUP_EXPRESSION`, default 4 AM):
  guests not seen for `GUEST_INACTIVE_DAYS` (default 30) are deleted with
  their avatar. Each batch is removed in a database transaction, followed by
  one bulk cleanup of avatars that have no remaining references. A guest who
  appears in game statistics or owns a package is marked deleted instead,
  preserving scores, game history and package attribution. `user.last_seen_at` is
  written at most hourly by the auth middleware.

## API and UI

- `GET /v1/me/storage`: usage, quota and limits. Shown as a bar in My
  packages and on the upload review.
- `GET /v1/admin/api/storage` (admin_panel_access): bucket usage, group
  limits, the 20 heaviest users.
- `PUT /v1/admin/api/storage/groups/{group}` and
  `PUT /v1/admin/api/storage/users/{id}` (manage_storage): edit limits and a
  user's own quota. The admin panel's Storage tab drives both.
