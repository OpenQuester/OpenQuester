import { type AddressInfo } from "net";
import { type Server as HTTPServer } from "http";

interface HttpListeningStartupWaitContext {
  httpServer: HTTPServer;
  initPromise: Promise<void>;
  timeoutMs: number;
}

export function waitForHttpListeningOrStartupFailure(
  context: HttpListeningStartupWaitContext
): Promise<void> {
  const { httpServer, initPromise, timeoutMs } = context;

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timeout);
      httpServer.off("listening", onListening);
      httpServer.off("error", onError);
    };

    const settle = (settleAction: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      settleAction();
    };

    const onListening = (): void => {
      settle(resolve);
    };

    const onError = (error: Error): void => {
      settle(() => {
        reject(error);
      });
    };

    const timeout = setTimeout(() => {
      settle(() => {
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for test HTTP server to listen ` +
              `(listening=${httpServer.listening}, address=${formatServerAddress(
                httpServer.address()
              )})`
          )
        );
      });
    }, timeoutMs);

    // Observe the original startup promise without replacing it. The rejection
    // handler stays attached after listening succeeds so a later init failure is
    // still observed through ServerTestHarness.initPromise without becoming
    // unhandled here.
    void initPromise.then(
      () => undefined,
      (error: unknown) => {
        if (settled || httpServer.listening) {
          return;
        }

        settle(() => {
          reject(
            new Error(
              `Server initialization failed before HTTP listening:\n${formatErrorMessage(
                error
              )}`,
              { cause: error }
            )
          );
        });
      }
    );

    if (httpServer.listening) {
      settle(resolve);
      return;
    }

    httpServer.once("listening", onListening);
    httpServer.once("error", onError);
  });
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatServerAddress(address: AddressInfo | string | null): string {
  if (address === null) {
    return "null";
  }

  if (typeof address === "string") {
    return JSON.stringify(address);
  }

  return JSON.stringify(address);
}
