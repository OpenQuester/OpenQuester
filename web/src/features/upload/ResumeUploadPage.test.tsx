import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type * as Upload from "./upload";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  Navigate: () => null,
  useParams: () => ({ packageId: "7" }),
}));
vi.mock("./upload", async (importOriginal) => ({
  ...(await importOriginal<typeof Upload>()),
  readPackageFile: vi.fn(async () => ({
    format: "oq",
    content: { title: "Same title", rounds: [] },
    files: new Map(),
    warnings: [],
  })),
}));

import { ResumeUploadPage } from "./ResumeUploadPage";

afterEach(() => fetchMock.mockReset());

it("shows a recoverable network error instead of a blank resume page", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { id: 1, username: "Author" });
  client.setQueryData(["package", 7], { id: 7, title: "Retry upload" });
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(
    <QueryClientProvider client={client}>
      <ResumeUploadPage />
    </QueryClientProvider>,
  );
  expect(await screen.findByTestId("resume-error")).toBeVisible();
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: "ready",
        totalFiles: 0,
        uploadedFiles: 0,
        missing: [],
        uploadLinks: {},
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByTestId("resume-done")).toBeVisible();
  client.clear();
});

it("explains why a same-title archive cannot replace the original upload", async () => {
  const state = {
    id: 7,
    status: "uploading",
    totalFiles: 1,
    uploadedFiles: 0,
    missing: ["a".repeat(32)],
    uploadLinks: {},
  };
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    expect(request.method).toBe("GET");
    const body =
      url.pathname === "/v1/packages/7/upload" ? state : { data: [], pageInfo: { total: 0 } };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { id: 1, username: "Author" });
  client.setQueryData(["package", 7], { id: 7, title: "Same title" });
  client.setQueryData(["package-upload", 7], state);
  const { container } = render(
    <QueryClientProvider client={client}>
      <ResumeUploadPage />
    </QueryClientProvider>,
  );
  await userEvent
    .setup()
    .upload(
      container.querySelector<HTMLInputElement>("input[type=file]")!,
      new File(["archive"], "same-title.oq"),
    );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This file isn't the one this package was uploaded from",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Upload it as a new package instead.");
  expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "PUT")).toBe(false);
});
