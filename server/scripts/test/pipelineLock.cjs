const { randomUUID } = require("node:crypto");
const {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { dirname, resolve } = require("node:path");

const RECOVERY_SUFFIX = ".recovery";
const RECOVERY_OWNER_FILENAME = "owner.json";
const STALE_RECOVERY_SUFFIX = ".stale";

function acquirePipelineLock(lockFilePath) {
  const lockPath = resolve(lockFilePath);
  mkdirSync(dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const owner = createOwner();
    const candidatePath = `${lockPath}.${owner.pid}.${owner.token}.candidate`;

    writeFileSync(candidatePath, `${JSON.stringify(owner)}\n`, { flag: "wx" });

    try {
      // Publishing a fully written hard link avoids exposing a half-written
      // owner record to a competing process.
      linkSync(candidatePath, lockPath);
      unlinkSync(candidatePath);
      return createLease(lockPath, owner);
    } catch (error) {
      removeFileIfPresent(candidatePath);

      if (!existsSync(lockPath)) {
        if (isAlreadyExistsError(error)) {
          continue;
        }
        throw error;
      }

      const existingOwner = readOwner(lockPath);
      if (!existingOwner || isProcessRunning(existingOwner.pid)) {
        throw createContentionError(lockPath, existingOwner);
      }

      if (!recoverStaleLock(lockPath, existingOwner)) {
        throw createContentionError(lockPath, readOwner(lockPath));
      }
    }
  }

  throw new Error(`Unable to acquire test:pipeline lock at "${lockPath}" after stale recovery`);
}

function createLease(lockPath, owner) {
  let released = false;

  return {
    release() {
      if (released) {
        return;
      }

      const currentOwner = readOwner(lockPath);
      if (!currentOwner) {
        if (!existsSync(lockPath)) {
          released = true;
          return;
        }
        throw new Error(`Cannot read test:pipeline lock owner at "${lockPath}"`);
      }
      if (currentOwner.token !== owner.token) {
        throw new Error(
          `Refusing to release test:pipeline lock owned by PID ${currentOwner.pid}; ` +
            `current process is PID ${owner.pid}`
        );
      }

      unlinkSync(lockPath);
      released = true;
    }
  };
}

function recoverStaleLock(lockPath, staleOwner) {
  const recoveryPath = `${lockPath}${RECOVERY_SUFFIX}`;
  const recoveryLease = acquireRecoveryLease(recoveryPath);
  if (!recoveryLease) {
    return false;
  }

  try {
    const currentOwner = readOwner(lockPath);
    if (!currentOwner) {
      return true;
    }
    if (currentOwner.token !== staleOwner.token || isProcessRunning(currentOwner.pid)) {
      return false;
    }

    unlinkSync(lockPath);
    return true;
  } finally {
    recoveryLease.release();
  }
}

/**
 * Publishes a fully written recovery owner directory atomically. A process may
 * die before or after publication without leaving an unreadable fixed mutex,
 * and a later process can reclaim a published lease whose PID is dead.
 */
function acquireRecoveryLease(recoveryPath) {
  const resolvedRecoveryPath = resolve(recoveryPath);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const owner = createOwner();
    const candidatePath = `${resolvedRecoveryPath}.${owner.pid}.${owner.token}.candidate`;

    mkdirSync(candidatePath);
    try {
      writeFileSync(resolve(candidatePath, RECOVERY_OWNER_FILENAME), `${JSON.stringify(owner)}\n`, {
        flag: "wx"
      });
      renameSync(candidatePath, resolvedRecoveryPath);
      return createRecoveryLease(resolvedRecoveryPath, owner);
    } catch (error) {
      removeDirectoryIfPresent(candidatePath);

      if (!existsSync(resolvedRecoveryPath)) {
        throw error;
      }
    }

    const existingOwner = readRecoveryOwner(resolvedRecoveryPath);
    if (!existingOwner) {
      const claimedLease = claimOwnerlessRecoveryLease(resolvedRecoveryPath, owner);
      if (claimedLease) {
        return claimedLease;
      }
      continue;
    }
    if (isProcessRunning(existingOwner.pid)) {
      return undefined;
    }

    if (!reclaimStaleRecoveryLease(resolvedRecoveryPath, existingOwner)) {
      return undefined;
    }
  }

  return undefined;
}

function claimOwnerlessRecoveryLease(recoveryPath, owner) {
  const ownerPath = resolve(recoveryPath, RECOVERY_OWNER_FILENAME);

  try {
    // Legacy recovery mutexes could crash after mkdir but before publishing an
    // owner. Exclusive creation lets exactly one contender adopt that mutex.
    writeFileSync(ownerPath, `${JSON.stringify(owner)}\n`, { flag: "wx" });
    return createRecoveryLease(recoveryPath, owner);
  } catch (error) {
    if (isAlreadyExistsError(error) || isMissingError(error)) {
      return undefined;
    }
    throw error;
  }
}

function createRecoveryLease(recoveryPath, owner) {
  let released = false;

  return {
    release() {
      if (released) {
        return;
      }

      const currentOwner = readRecoveryOwner(recoveryPath);
      if (!currentOwner) {
        if (!existsSync(recoveryPath)) {
          released = true;
          return;
        }
        throw new Error(`Cannot read test:pipeline recovery owner at "${recoveryPath}"`);
      }
      if (currentOwner.token !== owner.token) {
        throw new Error(
          `Refusing to release test:pipeline recovery owned by PID ${currentOwner.pid}; ` +
            `current process is PID ${owner.pid}`
        );
      }

      rmSync(recoveryPath, { recursive: true });
      released = true;
    }
  };
}

function reclaimStaleRecoveryLease(recoveryPath, staleOwner) {
  const currentOwner = readRecoveryOwner(recoveryPath);
  if (
    !currentOwner ||
    currentOwner.token !== staleOwner.token ||
    isProcessRunning(currentOwner.pid)
  ) {
    return false;
  }

  // Keep the token-specific tombstone. It prevents a delayed contender that
  // observed this same dead owner from renaming a newly published live lease.
  const tombstonePath = `${recoveryPath}${STALE_RECOVERY_SUFFIX}.${staleOwner.token}`;

  try {
    renameSync(recoveryPath, tombstonePath);
    return true;
  } catch (error) {
    if (!existsSync(recoveryPath)) {
      return true;
    }

    const refreshedOwner = readRecoveryOwner(recoveryPath);
    if (!refreshedOwner || refreshedOwner.token !== staleOwner.token) {
      return false;
    }

    throw error;
  }
}

function readRecoveryOwner(recoveryPath) {
  return readOwner(resolve(recoveryPath, RECOVERY_OWNER_FILENAME));
}

function createOwner() {
  return {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    token: randomUUID()
  };
}

function readOwner(lockPath) {
  let value;
  try {
    value = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch (error) {
    if (isMissingError(error)) {
      return undefined;
    }
    return undefined;
  }

  if (
    !Number.isSafeInteger(value?.pid) ||
    value.pid <= 0 ||
    typeof value?.token !== "string" ||
    value.token.length === 0
  ) {
    return undefined;
  }

  return value;
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function createContentionError(lockPath, owner) {
  const ownerDetails = owner
    ? `PID ${owner.pid}, started ${owner.startedAt ?? "at an unknown time"}`
    : "an unreadable owner record";

  return new Error(
    `Another test:pipeline process owns this checkout (${ownerDetails}). ` +
      `Wait for it to finish before retrying. Lock: "${lockPath}"`
  );
}

function removeFileIfPresent(filePath) {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (!isMissingError(error)) {
      throw error;
    }
  }
}

function removeDirectoryIfPresent(directoryPath) {
  try {
    rmSync(directoryPath, { recursive: true });
  } catch (error) {
    if (!isMissingError(error)) {
      throw error;
    }
  }
}

function isAlreadyExistsError(error) {
  return error?.code === "EEXIST" || error?.code === "ENOTEMPTY";
}

function isMissingError(error) {
  return error?.code === "ENOENT";
}

module.exports = { acquirePipelineLock, acquireRecoveryLease };
