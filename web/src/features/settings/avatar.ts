import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { User } from "@/api/types";
import { meKey } from "@/features/auth/useMe";
import { md5Hex } from "@/features/upload/archive";
import { put } from "@/features/upload/upload";

const SIZE = 512;
export const AVATAR_MAX_BYTES = 20 * 1024 * 1024;

/** Crops to a centred square and scales to 512 px, as WebP (JPEG where WebP can't be encoded). */
export async function squareAvatar(file: Blob): Promise<{ bytes: Uint8Array; name: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("notImage");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("notImage");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  const final =
    blob && blob.type === "image/webp"
      ? blob
      : await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  if (!final) throw new Error("notImage");
  return {
    bytes: new Uint8Array(await final.arrayBuffer()),
    name: final.type === "image/webp" ? "avatar.webp" : "avatar.jpg",
  };
}

/**
 * Same flow as the Flutter profile screen, but the profile only changes after
 * the picture is really stored: POST /v1/files/{md5} for a link, PUT, PATCH /v1/me.
 */
export function useChangeAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("notImage");
      if (file.size > AVATAR_MAX_BYTES) throw new Error("tooBig");
      const { bytes, name } = await squareAvatar(file);
      const md5 = md5Hex(bytes);
      const { url } = await unwrap(
        api.POST("/v1/files/{filename}", { params: { path: { filename: md5 } } }),
      );
      await put({ url, file: { md5, type: "image", name, bytes } });
      return (await unwrap(api.PATCH("/v1/me", { body: { avatar: md5 } }))) as User;
    },
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}
