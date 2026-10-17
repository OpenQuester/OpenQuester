#!/usr/bin/env node
// Fails when src/api/schema.d.ts is out of date with openapi/schema.json.
// Fix by running `npm run gen:api` and committing the result.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const temporary = mkdtempSync(join(tmpdir(), "oq-api-"));
const out = join(temporary, "schema.d.ts");
try {
  const cli = fileURLToPath(
    new URL("../node_modules/openapi-typescript/bin/cli.js", import.meta.url),
  );
  // Execute JavaScript directly: .cmd shims and shell quoting are unnecessary.
  execFileSync(process.execPath, [cli, "../openapi/schema.json", "-o", out], { stdio: "ignore" });
  const text = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  if (text(out) !== text("src/api/schema.d.ts")) {
    console.error("src/api/schema.d.ts is stale. Run `npm run gen:api` in web/ and commit it.");
    process.exitCode = 1;
  } else {
    console.log("API types are up to date.");
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
