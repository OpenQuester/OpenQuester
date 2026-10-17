import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaFile } from "@/features/upload/types";

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
});
