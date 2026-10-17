/// <reference types="node" />
// @vitest-environment node
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it.each([false, true])(
  "checks API types with spaces and CRLF (stale=%s)",
  (stale) => {
    const temporary = mkdtempSync(join(tmpdir(), "oq api test "));
    try {
      const web = join(temporary, "web");
      mkdirSync(join(web, "src/api"), { recursive: true });
      mkdirSync(join(temporary, "openapi"));
      copyFileSync("../openapi/schema.json", join(temporary, "openapi/schema.json"));
      const schema = readFileSync("src/api/schema.d.ts", "utf8").replace(/\r?\n/g, "\r\n");
      writeFileSync(join(web, "src/api/schema.d.ts"), schema + (stale ? "\r\n// stale\r\n" : ""));
      const result = spawnSync(process.execPath, [resolve("scripts/check-api-types.mjs")], {
        cwd: web,
        env: { ...process.env, TMP: temporary, TEMP: temporary, TMPDIR: temporary },
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(stale ? 1 : 0);
      if (stale) expect(result.stderr).toContain("schema.d.ts is stale");
      else expect(result.stdout).toContain("API types are up to date.");
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
  15000,
);
