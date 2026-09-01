import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import pipelineLock from "./pipelineLock.cjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const jestPath = resolve(currentDir, "../../node_modules/jest/bin/jest.js");
const pipelineLockPath = resolve(
  currentDir,
  "../../node_modules/.cache/openquester-test-pipeline.lock"
);
const forwardedArgs = process.argv.slice(2);
const forbiddenArg = findForbiddenArg(forwardedArgs);
const { acquirePipelineLock } = pipelineLock;

if (forbiddenArg) {
  console.error(
    `Unsupported pipeline Jest argument "${forbiddenArg}": ` +
      "open-handle detection must remain enabled and force-exit is not allowed."
  );
  process.exitCode = 1;
} else {
  try {
    runJestWithLock(acquirePipelineLock(pipelineLockPath));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

function runJestWithLock(lock) {
  const openHandleProcessorPath = resolve(currentDir, "./failOnOpenHandles.cjs");
  const jestArgs = [
    ...forwardedArgs,
    "--detectOpenHandles",
    "--testResultsProcessor",
    openHandleProcessorPath
  ];
  let jest;
  try {
    jest = spawn(process.execPath, [jestPath, ...jestArgs], {
      stdio: ["inherit", "ignore", "inherit"]
    });
  } catch (error) {
    try {
      lock.release();
    } catch (releaseError) {
      throw new AggregateError(
        [error, releaseError],
        "Failed to start Jest and release the test:pipeline lock"
      );
    }
    throw error;
  }

  const signalHandlers = new Map();
  let completed = false;
  let forceKillTimer;
  let forceReleaseTimer;
  let requestedSignal;

  const releaseOnProcessExit = () => {
    try {
      lock.release();
    } catch {
      // A following invocation can recover this dead PID's lock.
    }
  };
  process.once("exit", releaseOnProcessExit);

  const finish = (code, signal) => {
    if (completed) {
      return;
    }
    completed = true;
    clearTimeout(forceKillTimer);
    clearTimeout(forceReleaseTimer);

    for (const [registeredSignal, handler] of signalHandlers) {
      process.off(registeredSignal, handler);
    }
    process.off("exit", releaseOnProcessExit);

    try {
      lock.release();
    } catch (error) {
      console.error("Failed to release test:pipeline lock:", error);
      process.exit(1);
    }

    if (requestedSignal) {
      process.exit(signalExitCode(requestedSignal));
    }
    if (signal) {
      console.error(`Jest exited with signal ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  };

  jest.on("error", (error) => {
    console.error(error);
    finish(1);
  });
  jest.on("close", finish);

  for (const signal of supportedTerminationSignals()) {
    const handler = () => {
      if (requestedSignal) {
        return;
      }
      requestedSignal = signal;

      try {
        if (!jest.kill(signal)) {
          finish(1, signal);
          return;
        }
      } catch (error) {
        console.error(`Failed to forward ${signal} to Jest:`, error);
        finish(1, signal);
        return;
      }

      forceKillTimer = setTimeout(() => {
        console.error(`Jest did not stop after ${signal}; forcing termination.`);
        try {
          if (!jest.kill("SIGKILL")) {
            finish(1, signal);
            return;
          }
        } catch (error) {
          console.error("Failed to force-stop Jest:", error);
          finish(1, signal);
          return;
        }

        forceReleaseTimer = setTimeout(() => finish(1, signal), 1000);
      }, 2000);
    };
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }
}

function supportedTerminationSignals() {
  return process.platform === "win32"
    ? ["SIGINT", "SIGTERM", "SIGBREAK"]
    : ["SIGHUP", "SIGINT", "SIGTERM"];
}

function signalExitCode(signal) {
  return (
    {
      SIGHUP: 129,
      SIGINT: 130,
      SIGTERM: 143,
      SIGBREAK: 149
    }[signal] ?? 1
  );
}

function findForbiddenArg(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [option, value] = arg.split("=", 2);
    const normalizedOption = option.replace(/^-+/, "").replaceAll("-", "").toLowerCase();

    if (normalizedOption === "forceexit" || normalizedOption === "nodetectopenhandles") {
      return arg;
    }

    if (
      normalizedOption === "detectopenhandles" &&
      (value?.toLowerCase() === "false" || args[index + 1]?.toLowerCase() === "false")
    ) {
      return value === undefined ? `${arg} ${args[index + 1]}` : arg;
    }
  }

  return undefined;
}
