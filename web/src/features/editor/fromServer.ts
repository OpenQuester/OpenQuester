import { api, unwrap } from "@/api/client";
import { toContent } from "@/features/upload/oq";
import type { ImportWarning, MediaFile, MediaType } from "@/features/upload/types";

import { listDrafts, saveDraft } from "./drafts";
import { fromUpload, newId, type EditorPackage } from "./model";

/** md5 → public link for every file a package uses, read from its API JSON. */
function fileLinks(json: unknown): Map<string, string> {
  const links = new Map<string, string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.md5 === "string" && typeof o.link === "string")
      links.set(o.md5.toLowerCase(), o.link);
    Object.values(o).forEach(walk);
  };
  walk(json);
  return links;
}

/**
 * A published package as an editor tree, with its media pointing at storage
 * links instead of downloaded bytes.
 */
export async function loadServerPackage(
  packageId: number,
): Promise<{ pkg: EditorPackage; media: Map<string, MediaFile> }> {
  const json = await unwrap(api.GET("/v1/packages/{id}", { params: { path: { id: packageId } } }));
  const types = new Map<string, MediaType>();
  const warnings: ImportWarning[] = [];
  const content = toContent(json as unknown as Record<string, unknown>, types, warnings);
  const links = fileLinks(json);
  const media = new Map<string, MediaFile>();
  for (const [md5, type] of types) {
    const url = links.get(md5);
    if (url) media.set(md5, { md5, type, name: md5, bytes: new Uint8Array(0), url });
  }
  return { pkg: fromUpload(content), media };
}

/**
 * Opens a published package for editing: a draft that remembers the package id
 * (so Publish can save changes back) with its media referenced in storage
 * rather than downloaded. Reuses an existing draft of the same package.
 */
export async function draftFromPackage(packageId: number): Promise<string> {
  const existing = (await listDrafts()).find((d) => d.publishedId === packageId);
  if (existing) return existing.id;

  const { pkg, media } = await loadServerPackage(packageId);
  const id = newId();
  await saveDraft({ id, pkg, updatedAt: Date.now(), publishedId: packageId }, media.values());
  return id;
}
