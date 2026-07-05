import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const jestPath = resolve(currentDir, "../../node_modules/jest/bin/jest.js");
const jestArgs = ["--detectOpenHandles", ...process.argv.slice(2)];

const jest = spawn(process.execPath, [jestPath, ...jestArgs], {
  stdio: ["inherit", "ignore", "inherit"]
});

jest.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

jest.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Jest exited with signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
