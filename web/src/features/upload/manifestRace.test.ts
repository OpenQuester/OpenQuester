import { expect, it, vi } from "vitest";
import type * as Archive from "./archive";
import { readPackageFile } from "./upload";
import { readZip } from "./archive";
vi.mock("./archive", async (original) => ({
  ...(await original<typeof Archive>()),
  readZip: vi.fn(),
}));

it.each([false, true])(
  "rejects aliases independently of inflate completion order (reverse=%s)",
  async (reverse) => {
    const names = ["CONTENT.XML", "Content.Xml"];
    vi.mocked(readZip).mockImplementationOnce(async (_bytes, filter) => {
      names.forEach((name) => filter?.(name, 1));
      const result: Record<string, Uint8Array<ArrayBuffer>> = {};
      for (const name of reverse ? [...names].reverse() : names) result[name] = new Uint8Array([1]);
      return result;
    });
    const file = { name: "x.siq", arrayBuffer: async () => new ArrayBuffer(0) } as File;
    const confirm = vi.fn();
    await expect(readPackageFile(file, { confirmHtmlRemoval: confirm })).rejects.toThrow(
      "ambiguousManifest",
    );
    expect(confirm).not.toHaveBeenCalled();
  },
);
