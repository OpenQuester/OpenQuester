# Storage limits — proposal

Status: **proposal, waiting for a decision**. Nothing here is built yet.

## Where we are today

- Media is content-addressed: the S3 key is the file's MD5
  (`infrastructure/utils/StorageUtils.ts`), so identical files are stored once
  for everyone. Upload links are presigned PUTs with `Content-MD5` and
  `If-None-Match: *` (`infrastructure/storage/S3ObjectStorage.ts`).
- No limits exist: no per-file size, per-package size, per-user quota or
  bucket ceiling. A presigned PUT can't cap the body size.
- File size is never recorded (no DB column, no `HeadObject`).
- `POST /v1/files/:filename` hands out an upload link without a session
  (`authMiddleware.ts` public list).
- Leaks:
  - Replacing a package (`PUT /v1/packages/:id`) drops its `file_usage` rows
    but never deletes the old `file` rows or objects.
  - Changing an avatar drops the old usage row but keeps the row and object.
  - The nightly `S3FilesCleanupJob` only deletes objects that have **no**
    `file` row, so both leaks above live forever.
  - Package creation writes a new `file` row per reference, so one MD5 can
    have many rows.

## Proposal

### 1. Record what is stored

New table `storage_object`, one row per MD5 (unique):
`md5`, `size_bytes`, `mime`, `first_uploader_id`, `created_at`,
`verified_at`. `file` rows point at it; a migration merges duplicate `file`
rows by MD5.

Sizes come from the client when it asks for links (see 3) and are confirmed by
the server with `HeadObject` after upload.

### 2. How usage is counted

**A user's usage = the sum of distinct MD5s referenced by their packages and
avatar.** The same picture in ten of your packages counts once. A file shared
with another user counts for both of you, because either of you could delete
your copy of the reference; the bucket still stores it once.

Deleting or editing a package frees quota immediately. This is simple to
explain on a "Storage" bar in My packages, and it can't be gamed by
uploading the same file from several accounts.

### 3. Limits and where they are enforced

Suggested defaults (env-configurable, admins exempt):

| Limit | Default |
| --- | --- |
| Picture | 10 MB |
| Sound | 20 MB |
| Video | 100 MB |
| One package | 500 MB |
| One user | 1 GB (`user.storage_quota` overrides it) |
| Bucket soft limit | 80 % of `S3_BUCKET_QUOTA`: alert admins |
| Bucket hard limit | 95 %: new uploads refused, games keep working |

Enforcement happens in **`POST`/`PUT /v1/packages`** (and the avatar link),
before any link is issued:

1. The request lists every file it will upload: `{ md5, size, mime }`.
2. The server checks each file against the type limit, the package total,
   the user's usage after this change (only MD5s the user doesn't already
   reference count) and the bucket limit.
3. If anything is over, it answers `413` with which limit and by how much, so
   the client can say "This package needs 620 MB; your limit is 500 MB" and
   suggest turning compression on.
4. After uploading, the client calls `POST /v1/packages/{id}/uploaded`. The
   server `HeadObject`s each new file; a size that doesn't match what was
   declared deletes the object and marks the package incomplete (the same
   state as a failed upload today, with a retry).

`POST /v1/files` requires a signed-in, non-guest user and goes through the
same check.

### 4. Cleanup

- Package replace and avatar change delete files that lost their last usage,
  exactly like package delete already does.
- The nightly job also deletes `storage_object`/`file` rows (and objects)
  with no usage that are older than 24 hours. The grace period covers uploads
  in progress.
- Objects older than 24 hours with no row are deleted, as today.
- Packages whose upload never finished for 7 days are removed with their
  orphaned files.

### 5. Visibility

- My packages shows "312 MB of 1 GB used" and the size of each package.
- The admin page shows bucket usage, the top users by usage, and a quota
  override per user.

## Decisions needed

1. Count shared files for every user who references them (recommended), or
   only for the first uploader?
2. The numbers in the table above, especially 1 GB per user and 500 MB per
   package.
3. Should guests be able to upload an avatar? Today they can't upload
   packages, and `POST /v1/files` doesn't check at all.

## Build order once decided

1. `storage_object` + sizes recorded, the leak fixes and the extended cleanup
   job (useful even without limits).
2. Limits in `POST`/`PUT /v1/packages`, the `413` details and the
   `uploaded` confirmation.
3. The usage bar in My packages and the admin view.
