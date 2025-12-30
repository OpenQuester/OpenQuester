# OpenQuester Server Logging Guidelines

## Overview

This document defines logging standards for the OpenQuester backend, based on the 10 rules for effective production logging. These guidelines ensure logs answer diagnostic questions without overwhelming operators.

## The 10 Rules

### 1. Golden Rule: Every log must answer a question

Before adding a log, ask: **"What question does this answer?"**

Examples:
- ✅ "Which user performed what admin action?" → `audit` log
- ✅ "Why did this HTTP request fail?" → `error` log  
- ✅ "How long did this external API call take?" → `performance` log
- ❌ "Function X was called" → No useful question

### 2. Layer Ownership: Log at boundaries only

| Layer | What to Log | Examples |
|-------|-------------|----------|
| **Transport (HTTP/Socket)** | Request/response, status codes, latency | `performanceLogMiddleware`, `errorMiddleware` |
| **Application** | Business outcomes, decisions | "User banned", "Game created" |
| **Infrastructure** | External calls, errors, retries | S3 upload failures, Redis errors |
| **Domain** | **Nothing** (keep pure) | Entities, value objects should not log |

### 3. Strict Level Semantics

| Level | When to Use | Environment | Examples |
|-------|-------------|-------------|----------|
| `trace` | Local debugging only | Never in production | Implementation details, variable values |
| `debug` | Implementation details | Dev/staging only | Cache hits, query details |
| `info` | Business events | All environments | "Game started", "User logged in" |
| `performance` | Request/operation timing | All environments | HTTP request duration, DB query time |
| `warn` | Unexpected but recovered | All environments | Lock contention, retry attempts |
| `error` | Failures that break functionality | All environments | API errors, DB failures |
| `audit` | Security/permission events | All environments | User banned, admin actions |

### 4. Cardinality & Size

**Never log:**
- Raw request bodies (unbounded size)
- File contents
- Full headers
- Long arrays/objects

**Instead log:**
- IDs (gameId, userId)
- Enums (action type, status)
- Counts (player count, queue length)
- Hashes (MD5, SHA256)

```typescript
// ❌ Bad: High cardinality
this.logger.info(`User ${userName} did action`);

// ✅ Good: Bounded identifiers
this.logger.info(`User action performed`, { userId: user.id });
```

### 5. One Event → One Log

Prefer single composed logs over multiple incremental logs.

```typescript
// ❌ Bad: Multiple logs
this.logger.debug("Starting operation");
// ... operation ...
this.logger.debug("Operation completed");

// ✅ Good: Single performance log
const log = this.logger.performance("Operation", { userId });
// ... operation ...
log.finish({ result });
```

**Exception:** Retry loops where each attempt should be logged.

### 6. Error Logging Discipline

**Log errors exactly once** at the outermost boundary that handles them.

```typescript
// ✅ Good: Log once at boundary
export const errorMiddleware = (logger) => async (err, _req, res, next) => {
  const { message, code } = await ErrorController.resolveError(err, logger);
  // ErrorController logs server errors here (once)
  res.status(code).json({ error: message });
};

// ❌ Bad: Logging at multiple levels
class Service {
  async doWork() {
    try {
      await database.query();
    } catch (error) {
      this.logger.error("Query failed"); // ❌ Don't log here
      throw error; // Let boundary handle it
    }
  }
}
```

**Exception:** Infrastructure layer may log errors before re-throwing if adding context.

### 7. Message Style

- **Declarative, past tense:** "User logged in" not "Logging in user"
- **Short:** Keep under 100 characters
- **Semantic meaning in metadata:** Use structured fields, not string interpolation

```typescript
// ❌ Bad: Present tense, interpolated
this.logger.info(`Banning user ${userId} by admin ${adminId}`);

// ✅ Good: Past tense, structured
this.logger.audit("User banned", {
  prefix: "[ADMIN]: ",
  targetUserId: userId,
  adminUserId: adminId,
});
```

### 8. Environment Rules

| Level | Local | Dev | Staging | Production |
|-------|-------|-----|---------|------------|
| trace | ✅ | ❌ | ❌ | ❌ |
| debug | ✅ | ✅ | ❌ | ❌ |
| info | ✅ | ✅ | ✅ | ✅ |
| performance | ✅ | ✅ | ✅ | ✅ |
| warn | ✅ | ✅ | ✅ | ✅ |
| error | ✅ | ✅ | ✅ | ✅ |
| audit | ✅ | ✅ | ✅ | ✅ |

Set via `LOG_LEVEL` environment variable.

### 9. PR Checklist

For every new log, document:

1. **Owner (layer):** Which layer is responsible?
2. **Purpose:** What question does it answer?
3. **Level:** Which log level and why?
4. **Cardinality:** Are all fields bounded?

Example comment:
```typescript
/**
 * Purpose: Answer "Which user was banned by which admin?"
 * Level: audit (security/permission event)
 * Cardinality: Safe - only user IDs (bounded integers)
 */
this.logger.audit("User banned", {
  targetUserId: userId,
  adminUserId: req.user.id,
});
```

### 10. Audit Preservation

Audit logs must be:
- **Immutable:** Never modified after creation
- **Retained:** Configured retention period
- **Reliable:** Separate sink if possible

Audit log fields:
- **Who:** `userId`, `adminUserId`
- **What:** Action description
- **When:** Timestamp (automatic)
- **Context:** Relevant IDs only

## Common Patterns

### HTTP Request Logging

```typescript
// performanceLogMiddleware.ts
const log = logger.performance("HTTP request", {
  method: req.method,
  url: req.url,
  userId: req.session?.userId,
});

// On response
log.finish({ statusCode: res.statusCode });
```

### Business Event Logging

```typescript
// Application layer
logger.info("Game created", {
  gameId: game.id,
  creatorId: user.id,
});
```

### External Call Logging

```typescript
// Infrastructure layer
const log = logger.performance("Discord CDN fetch", { filename });
try {
  const result = await https.get(url);
  log.finish();
  return result;
} catch (error) {
  logger.error("Discord CDN fetch failed", {
    filename,
    error: error.message,
  });
  throw error;
}
```

### Admin/Security Actions

```typescript
// Presentation layer
logger.audit("User banned", {
  prefix: "[ADMIN]: ",
  targetUserId: userId,
  adminUserId: req.user?.id,
});
```

### Game State Changes

```typescript
// Application layer
logger.info("Game phase changed", {
  gameId: game.id,
  fromPhase: oldPhase,
  toPhase: newPhase,
});
```

## Anti-Patterns

### ❌ Logging in Domain Entities

```typescript
// domain/entities/game/Game.ts
class Game {
  skipPlayer(playerId: number) {
    this.skippedPlayers.push(playerId);
    // ❌ Don't log in domain entities
    this.logger.trace("Player skipped");
  }
}
```

### ❌ Implementation Detail Logs

```typescript
// ❌ Lock acquisition/release (implementation details)
this.logger.trace("Acquiring lock");
const locked = await this.lockService.acquire();
this.logger.trace("Lock acquired");
```

### ❌ High-Cardinality Fields

```typescript
// ❌ Unbounded user input
this.logger.info("Search query", { query: userInput });

// ✅ Hash or truncate
this.logger.debug("Search query", { 
  queryHash: hash(userInput),
  queryLength: userInput.length,
});
```

### ❌ Duplicate Logs

```typescript
// ❌ Logging same event at multiple layers
try {
  await service.doWork(); // Service logs internally
  this.logger.info("Work completed"); // ❌ Duplicate
} catch (error) {
  this.logger.error("Work failed"); // ❌ Duplicate
  // ErrorController already logged this
}
```
