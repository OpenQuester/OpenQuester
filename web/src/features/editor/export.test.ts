// @vitest-environment node
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaFile } from "@/features/upload/types";
import { md5Hex } from "@/features/upload/archive";
import { parseOq } from "@/features/upload/oq";

import { ExportMediaError, exportOq } from "./media";
import { emptyPackage, newQuestion, newRound, newTheme } from "./model";

const MD5 = "a".repeat(32);

function packageUsing(md5: string) {
  const pkg = emptyPackage("Published");
  const round = newRound("Round 1");
  const question = newQuestion(100, {
    text: "Look",
    answerText: "Here",
    questionFiles: [{ md5, type: "image", displayTime: 5000 }],
  });
  round.themes = [newTheme("Pictures", [question])];
  pkg.rounds = [round];
  return pkg;
}

const stored: MediaFile = {
  md5: MD5,
  type: "image",
  name: `${MD5}.png`,
  bytes: new Uint8Array(),
  url: "https://files.test/a.png",
};

describe("exporting a draft opened from a published package", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("downloads media that only lives in storage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([7, 8, 9]))),
    );

    const blob = await exportOq(packageUsing(MD5), new Map([[MD5, stored]]));
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect([...files[`files/${MD5}`]!]).toEqual([7, 8, 9]);
  });

  it("fails instead of leaving the media out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    await expect(exportOq(packageUsing(MD5), new Map([[MD5, stored]]))).rejects.toBeInstanceOf(
      ExportMediaError,
    );
  });

  it("refuses an archive when a referenced media record is missing", async () => {
    await expect(exportOq(packageUsing(MD5), new Map())).rejects.toBeInstanceOf(ExportMediaError);
  });

  it("round-trips remote and local media without downloading unused files", async () => {
    const remoteBytes = new Uint8Array([7, 8, 9]);
    const localBytes = new Uint8Array([10, 11, 12]);
    const remoteId = md5Hex(remoteBytes);
    const localId = md5Hex(localBytes);
    const pkg = packageUsing(remoteId);
    pkg.rounds[0]!.themes[0]!.questions[0]!.answerFiles = [
      { md5: localId, type: "image", displayTime: 5000 },
    ];
    pkg.logo = { md5: remoteId, type: "image" };
    const fetch = vi.fn(async () => new Response(remoteBytes));
    vi.stubGlobal("fetch", fetch);
    const media = new Map<string, MediaFile>([
      [remoteId, { ...stored, md5: remoteId }],
      [localId, { ...stored, md5: localId, bytes: localBytes }],
      [MD5, stored],
    ]);
    const blob = await exportOq(pkg, media);
    const parsed = await parseOq(unzipSync(new Uint8Array(await blob.arrayBuffer())));
    expect(parsed.warnings).toEqual([]);
    expect([...parsed.files.keys()].sort()).toEqual([remoteId, localId].sort());
    expect(parsed.files.get(remoteId)?.bytes).toEqual(remoteBytes);
    expect(parsed.files.get(localId)?.bytes).toEqual(localBytes);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(stored.url);
  });
});
