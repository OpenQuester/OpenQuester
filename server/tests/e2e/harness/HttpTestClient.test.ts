import { describe, expect, it } from "@jest/globals";
import { createServer, type Server as HTTPServer, type ServerResponse } from "http";

import { fetchJson } from "tests/e2e/harness/HttpTestClient";
import { createControlledPromise, withTimeout } from "tests/e2e/harness/TestPromiseUtils";

const bodyTimeoutMs = 100;
const lifecycleTimeoutMs = 2000;

describe("HttpTestClient", () => {
  it("keeps the request timeout active while reading a JSON response body", async () => {
    const responseStarted = createControlledPromise();
    let activeResponse: ServerResponse | undefined;
    const server = createServer((_request, response) => {
      activeResponse = response;
      response.writeHead(200, { "content-type": "application/json" });
      response.flushHeaders();
      response.write('{"status":');
      responseStarted.resolve();
    });

    await listen(server);
    const serverUrl = getServerUrl(server);

    try {
      const timeoutAssertion = expect(fetchJson(serverUrl, bodyTimeoutMs)).rejects.toThrow(
        `Timed out after ${bodyTimeoutMs}ms waiting for HTTP JSON response from "${serverUrl}"`
      );

      await withTimeout(
        responseStarted.promise,
        lifecycleTimeoutMs,
        "partial HTTP response body to start"
      );
      await timeoutAssertion;
    } finally {
      activeResponse?.end();
      await close(server);
    }
  });
});

async function listen(server: HTTPServer): Promise<void> {
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.listen(0, "127.0.0.1", onListening);
    }),
    lifecycleTimeoutMs,
    "partial-response HTTP server to listen"
  );
}

async function close(server: HTTPServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
      server.closeAllConnections();
    }),
    lifecycleTimeoutMs,
    "partial-response HTTP server to close"
  );
}

function getServerUrl(server: HTTPServer): string {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected partial-response HTTP server to bind to a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}
