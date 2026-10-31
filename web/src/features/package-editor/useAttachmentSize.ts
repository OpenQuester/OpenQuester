import { useEffect, useState } from "react";
import type { MediaFile } from "@/features/upload/types";

const remoteSizes = new Map<string, Promise<number | null>>();

function remoteSize(key: string, url: string) {
  let request = remoteSizes.get(key);
  if (!request) {
    request = fetch(url, { method: "HEAD" })
      .then((response) => {
        const value = response.ok ? response.headers.get("Content-Length") : null;
        if (value === null || value.trim() === "") return null;
        const size = Number(value);
        return Number.isSafeInteger(size) && size >= 0 ? size : null;
      })
      .catch(() => null);
    remoteSizes.set(key, request);
  }
  return request;
}

export function useAttachmentSize(file: MediaFile | undefined): number | null {
  const url = file?.url && file.bytes.byteLength === 0 ? file.url : undefined;
  const key = url && file ? `${file.md5}:${url}` : undefined;
  const [remote, setRemote] = useState<{ key: string; size: number | null } | null>(null);
  useEffect(() => {
    if (!url || !key) return;
    let active = true;
    void remoteSize(key, url).then((size) => {
      if (active) setRemote({ key, size });
    });
    return () => {
      active = false;
    };
  }, [url, key]);
  if (!file) return null;
  if (!url) return file.bytes.byteLength;
  return remote && remote.key === key ? remote.size : null;
}
