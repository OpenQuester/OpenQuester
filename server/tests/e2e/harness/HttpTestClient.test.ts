import { describe, expect, it, jest } from "@jest/globals";
import { createServer, type Server as HTTPServer, type ServerResponse } from "http";

import { createHttpTestClient, fetchJson } from "tests/e2e/harness/HttpTestClient";
import { createControlledPromise, withTimeout } from "tests/e2e/harness/TestPromiseUtils";

const bodyTimeoutMs = 100;
const lifecycleTimeoutMs = 2000;

describe("HttpTestClient", () => {
  it.each([0, -1, Infinity, NaN])("rejects an unbounded request timeout: %s", (timeoutMs) => {
    expect(() => createHttpTestClient("http://127.0.0.1:1", timeoutMs)).toThrow(
      "HTTP test request timeout must be a positive finite number"
    );
  });

  it("sends JSON, query parameters and explicit cookies over the listening HTTP server", async () => {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        response.writeHead(201, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            method: request.method,
            url: request.url,
            cookie: request.headers.cookie,
            body: JSON.parse(Buffer.concat(chunks).toString())
          })
        );
      });
    });
    await listen(server);

    try {
      const http = createHttpTestClient(getServerUrl(server));
      const response = await http
        .post("/echo")
        .query({ page: 2 })
        .set("Cookie", "session=player")
        .send({ title: "Question" })
        .expect(201);

      expect(response.body).toEqual({
        method: "POST",
        url: "/echo?page=2",
        cookie: "session=player",
        body: { title: "Question" }
      });
    } finally {
      await close(server);
    }
  });

  it("does not reuse authentication cookies in later guest requests", async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": "session=admin; Path=/"
      });
      response.end(JSON.stringify({ cookie: request.headers.cookie ?? null }));
    });
    await listen(server);

    try {
      const http = createHttpTestClient(getServerUrl(server));
      const authenticated = await http.get("/me").set("Cookie", "session=player");
      expect(authenticated.body.cookie).toBe("session=player");

      const guest = await http.get("/me");
      expect(guest.body.cookie).toBeNull();
    } finally {
      await close(server);
    }
  });

  it("bounds the complete fluent response body and identifies the failed HTTP operation", async () => {
    const socketClosed = createControlledPromise();
    const server = createServer((_request, response) => {
      response.socket!.once("close", () => socketClosed.resolve());
      response.writeHead(200, { "content-type": "application/json" });
      response.flushHeaders();
      response.write('{"status":');
    });
    await listen(server);
    const serverUrl = getServerUrl(server);
    const warn = jest.spyOn(console, "warn");

    try {
      const http = createHttpTestClient(serverUrl, bodyTimeoutMs);
      await expect(http.get("/partial")).rejects.toThrow(
        `HTTP GET ${serverUrl}/partial: Timeout of ${bodyTimeoutMs}ms exceeded`
      );
      await withTimeout(
        socketClosed.promise,
        lifecycleTimeoutMs,
        "HTTP socket to close after the response deadline, before server cleanup"
      );
    } finally {
      try {
        await close(server);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    }
  });

  it("preserves connection failures with the HTTP method and URL", async () => {
    const server = createServer();
    await listen(server);
    const serverUrl = getServerUrl(server);
    await close(server);

    const http = createHttpTestClient(serverUrl);
    const failure = http.get("/missing-server");
    await expect(failure).rejects.toThrow(`HTTP GET ${serverUrl}/missing-server:`);
    await expect(failure).rejects.toThrow("ECONNREFUSED");
  });

  it("preserves failing response assertions with the HTTP method and URL", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(403);
      response.end();
    });
    await listen(server);
    const serverUrl = getServerUrl(server);

    try {
      const http = createHttpTestClient(serverUrl);
      await expect(http.get("/denied").expect(200)).rejects.toThrow(
        `HTTP GET ${serverUrl}/denied: expected 200 "OK", got 403 "Forbidden"`
      );
    } finally {
      await close(server);
    }
  });

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
