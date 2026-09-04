import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";

import {
  exportOq,
  restoreOqMedia,
  validateArchive,
  validateOqMediaHashes,
} from "./archive.worker";

describe("OpenQuester archives", () => {
  it("round-trips media bytes without losing the content hash", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const zipped = await exportOq({
      rounds: [
        {
          themes: [
            {
              questions: [
                {
                  media: [
                    {
                      id: "media-1",
                      hash: "08d6c05a21512a79a1dfeb9d2a8f262f",
                      type: "image",
                      name: "sample.png",
                      size: bytes.byteLength,
                      data: bytes.buffer,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const files = unzipSync(zipped);
    const content = JSON.parse(
      new TextDecoder().decode(files["content.json"]),
    ) as unknown;
    const restored = restoreOqMedia(content, files) as {
      rounds: Array<{
        themes: Array<{
          questions: Array<{
            media: Array<{ hash: string; data: ArrayBuffer }>;
          }>;
        }>;
      }>;
    };
    const media = restored.rounds[0]!.themes[0]!.questions[0]!.media[0]!;
    expect(media.hash).toBe("08d6c05a21512a79a1dfeb9d2a8f262f");
    expect(new Uint8Array(media.data)).toEqual(bytes);
  });

  it("rejects path traversal entries", () => {
    expect(() =>
      validateArchive({ "../content.json": new Uint8Array() }),
    ).toThrow(/unsafe path/);
  });

  it("rejects media whose bytes do not match its MD5 reference", async () => {
    await expect(
      validateOqMediaHashes(
        {
          rounds: [
            {
              themes: [
                {
                  questions: [
                    {
                      media: [{ hash: "08d6c05a21512a79a1dfeb9d2a8f262f" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          "media/08d6c05a21512a79a1dfeb9d2a8f262f": new Uint8Array([9, 9, 9]),
        },
      ),
    ).rejects.toThrow(/hash mismatch/);
  });
});
