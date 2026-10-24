# Package upload state

Status: **built** (migration 0.30.0).

## Why

Clients upload media straight to storage with presigned links, so a package
row exists before its files do. A closed tab or a dropped connection used to
leave a package that looked normal but showed "couldn't load" in the game.
Now the server knows whether every file arrived, an unfinished package can't
be played, and its author can finish the upload later.

## Model

- `package.upload_status`: `uploading` or `ready` (existing packages were
  migrated as `ready`). `upload_started_at` records when it last became
  `uploading`. Each content replacement receives a new timestamp; an older
  check cannot mark a newer replacement ready.
- A file counts as stored once `file.size_verified_at` is set, i.e. storage
  answered `HeadObject` for it (`StorageQuotaService.verifyFile`) or the
  nightly listing saw it.
- `POST`/`PUT /v1/packages` save content, source hash and `uploading` status
  together. The status becomes `ready` only when every referenced file is
  confirmed and its measured sizes pass the file, package, author and bucket
  limits. Already confirmed files need no new upload. The response carries
  `uploadStatus`.
- `PackageUploadService.refresh` asks storage about each unconfirmed file and
  saves the result. It runs on `GET /v1/packages/{id}/upload`, before a game
  is created with the package, and every 5 minutes for packages that started
  uploading in the last 2 days (`PackageUploadCheckJob`), so clients that
  never report back (the Flutter app) still end up `ready`.

## Rules

- `POST /v1/games` and changing a game's package refuse an `uploading`
  package with **409** `package_upload_unfinished`, naming how many files are
  missing or unconfirmed. Storage errors keep unconfirmed uploads unplayable;
  ready packages keep working. Measured quota violations return **413**, or
  **507** for the bucket, and keep the package `uploading`.
- Games snapshot the package when created, so a ready package can't become
  unplayable under a running game.
- `GET /v1/packages?uploadStatus=ready` lists only playable packages. The web
  app's public list uses it; an author's own list ("Mine", My packages) shows
  unfinished packages with an "Upload not finished" badge.

## Resuming

`GET /v1/packages/{id}/upload` (author or `edit_package`) returns
`{ status, totalFiles, uploadedFiles, missing, uploadLinks }` with fresh links
for the missing MD5s. The web app resumes in this order:

1. Files of an unfinished upload are kept in IndexedDB (`oq-uploads`) per
   package until each is uploaded, so the same browser resumes with one tap
   and without re-encoding.
2. Otherwise the author picks the same `.siq`/`.oq` again. Its media is
   matched to the missing MD5s as it is, then re-encoded the way the first
   upload did. Video encoders don't give identical bytes twice, so when files
   still don't match, the package is saved again from that file (`PUT`, same
   id) and only what storage lacks is sent. A file whose title differs is
   refused, so resuming can't replace a package with another one.

## Duplicates

Uploads send `sourceHash`, the MD5 of the parsed package content before
media is re-encoded. Before uploading, the web app asks
`GET /v1/packages?sourceHash=` and, when the same file was uploaded before,
offers to open that package (or finish your own unfinished upload of it)
instead of making a copy; "Upload anyway" stays available. Content saved
from the editor sends `sourceHash: null`, since it no longer matches any file.
