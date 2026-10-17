/**
 * Whether every media file a package uses is in storage. A package is
 * created `uploading` when it has files storage hasn't confirmed, and only
 * a `ready` package can be picked for a game.
 */
export enum PackageUploadStatus {
  UPLOADING = "uploading",
  READY = "ready"
}
