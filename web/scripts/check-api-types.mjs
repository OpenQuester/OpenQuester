#!/usr/bin/env node
// Fails when src/api/schema.d.ts is out of date with openapi/schema.json.
// Fix by running `npm run gen:api` and committing the result.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "oq-api-")), "schema.d.ts");
execFileSync("npx", ["openapi-typescript", "../openapi/schema.json", "-o", out], {
  stdio: "ignore",
});
if (readFileSync(out, "utf8") !== readFileSync("src/api/schema.d.ts", "utf8")) {
  console.error("src/api/schema.d.ts is stale. Run `npm run gen:api` in web/ and commit it.");
  process.exit(1);
}
console.log("API types are up to date.");
