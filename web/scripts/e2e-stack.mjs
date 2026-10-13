#!/usr/bin/env node
// Local backend for end-to-end tests: Postgres, Redis and S3 in Docker plus the
// API server built from ../server.
//
//   node scripts/e2e-stack.mjs up       start everything (idempotent)
//   node scripts/e2e-stack.mjs restart  rebuild and restart only the API server
//   node scripts/e2e-stack.mjs down     stop the server and remove the containers
//   node scripts/e2e-stack.mjs run [-- playwright args]
//                                       up, run Playwright, then down
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const server = resolve(web, "../server");
const stack = join(web, "e2e/stack");
const runDir = join(web, ".e2e-stack");
const pidFile = join(runDir, "server.pid");
const logFile = join(runDir, "server.log");
const env = Object.fromEntries(
  readFileSync(join(stack, "server.env"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const API = `http://localhost:${env.API_PORT}`;

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
}

const compose = (...args) => sh("docker", ["compose", "-f", join(stack, "compose.yml"), ...args]);

async function waitFor(url, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not ready
    }
    if (Date.now() > deadline) throw new Error(`${label} did not come up at ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function stopServer() {
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, "utf8"));
  rmSync(pidFile, { force: true });
  if (!alive(pid)) return;
  process.kill(pid, "SIGTERM");
  // Graceful shutdown closes sockets and Redis first; wait so the port is free.
  const deadline = Date.now() + 15_000;
  while (alive(pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  if (alive(pid)) process.kill(pid, "SIGKILL");
}

async function startServer() {
  await stopServer();
  if (!existsSync(join(server, "node_modules"))) sh("npm", ["ci"], { cwd: server });
  sh("npm", ["run", "build"], { cwd: server });
  mkdirSync(runDir, { recursive: true });
  const out = openSync(logFile, "w");
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: server,
    env: { ...process.env, ...env },
    stdio: ["ignore", out, out],
    detached: true,
  });
  child.unref();
  child.on("exit", (code) => {
    throw new Error(`API server exited early (${code}); see ${logFile}`);
  });
  closeSync(out);
  writeFileSync(pidFile, String(child.pid));
  await waitFor(`${API}/v1/games?limit=1&offset=0`, "API server");
  child.removeAllListeners("exit");
  console.log(`API server up on ${API} (log: ${logFile})`);
}

async function up() {
  compose("up", "-d", "--wait");
  // The S3 bucket for package media; PUT is idempotent.
  await waitFor(`${env.S3_ENDPOINT}/`, "S3");
  await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}`, { method: "PUT" });
  await startServer();
}

async function down() {
  await stopServer();
  compose("down", "-v");
}

const [cmd = "up", ...rest] = process.argv.slice(2);
try {
  if (cmd === "up") await up();
  else if (cmd === "restart") await startServer();
  else if (cmd === "down") await down();
  else if (cmd === "run") {
    await up();
    const args = rest[0] === "--" ? rest.slice(1) : rest;
    const res = spawnSync("npx", ["playwright", "test", ...args], {
      cwd: web,
      stdio: "inherit",
      env: { ...process.env, OQ_API_URL: API },
    });
    if (!process.env.OQ_KEEP_STACK) await down();
    process.exit(res.status ?? 1);
  } else {
    console.error(`unknown command ${cmd}`);
    process.exit(2);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
