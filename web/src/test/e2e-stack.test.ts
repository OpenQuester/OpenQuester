/// <reference types="node" />
// @vitest-environment node
import { spawn } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0 })),
  spawn: vi.fn(() => ({
    pid: 12345,
    unref: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => "API_PORT=53000\r\nDB_HOST=127.0.0.1\r\nREDIS_PORT=56379\r\n"),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  openSync: vi.fn(() => 1),
  closeSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

afterEach(() => vi.unstubAllGlobals());

it("starts the API with clean environment values from a Windows checkout", async () => {
  const argv = process.argv;
  process.argv = [process.execPath, "e2e-stack.mjs", "restart"];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));
  try {
    const script = "../../scripts/e2e-stack.mjs";
    await import(script);
    expect(spawn).toHaveBeenCalledOnce();
    const options = vi.mocked(spawn).mock.calls[0]![2] as { env: NodeJS.ProcessEnv };
    expect([options.env.API_PORT, options.env.DB_HOST, options.env.REDIS_PORT]).toEqual([
      "53000",
      "127.0.0.1",
      "56379",
    ]);
  } finally {
    process.argv = argv;
  }
});
