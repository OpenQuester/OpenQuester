import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "@/features/package-editor/packageDraft";
import { PublishPackageDialog } from "@/features/package-editor/PublishPackageDialog";
import {
  createPackageEditorStore,
  PackageEditorContext,
} from "@/features/package-editor/packageEditorStore";
import { validatePackage } from "@/features/package-editor/validatePackage";
import { useSettings } from "@/features/settings/settingsStore";
import type { MediaFile, ParsedPackage } from "./types";
import type * as Upload from "./upload";
import { uploadPackage } from "./upload";
import { UploadPackagePage } from "./UploadPackagePage";
import { draftFromParsed } from "@/features/package-editor/createDraft";

vi.mock("@/features/package-editor/createDraft", () => ({ draftFromParsed: vi.fn() }));
vi.mock("./optimize/index", () => ({
  optimizePackage: () => Promise.reject(new Error("encoder failed")),
}));

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const { fetchMock, readFile } = vi.hoisted(() => {
  const fetchMock = vi.fn<typeof fetch>();
  globalThis.fetch = fetchMock;
  return { fetchMock, readFile: vi.fn() };
});
vi.mock("./upload", async (importOriginal) => ({
  ...(await importOriginal<typeof Upload>()),
  readPackageFile: readFile,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
  }) => <a href={to.replace(/\$(\w+)/g, (_, key: string) => params?.[key] ?? key)}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

afterEach(() => {
  fetchMock.mockReset();
  readFile.mockReset();
  vi.mocked(draftFromParsed).mockReset();
});

it("reports a busy upload synchronously before loading or running the encoders", async () => {
  const progress = vi.fn();
  const file: MediaFile = {
    md5: "image",
    type: "image",
    name: "image.png",
    bytes: new Uint8Array([1]),
  };
  const job = uploadPackage(
    {
      format: "oq",
      content: toUpload(emptyPackage("Busy")),
      warnings: [],
      files: new Map([[file.md5, file]]),
    },
    progress,
    undefined,
    true,
  );
  expect(progress).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ phase: "optimizing" }),
  );
  await expect(job).rejects.toThrow("encoder failed");
});

it("keeps an imported package review retryable when creating a local draft fails", async () => {
  const parsed: ParsedPackage = {
    format: "oq",
    content: toUpload(emptyPackage("Recover me")),
    files: new Map(),
    warnings: [],
  };
  readFile.mockResolvedValue(parsed);
  vi.mocked(draftFromParsed)
    .mockRejectedValueOnce(new Error("Storage full"))
    .mockResolvedValueOnce("retry-draft");
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ data: [], pageInfo: { total: 0 } }), {
      headers: { "content-type": "application/json" },
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { id: 1, username: "Author", isGuest: false });
  client.setQueryData(["auth-settings"], { oauthProviders: [] });
  const view = render(
    <QueryClientProvider client={client}>
      <UploadPackagePage />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.upload(
    view.container.querySelector<HTMLInputElement>("input[type=file]")!,
    new File(["archive"], "recover.oq"),
  );
  await user.click(await screen.findByTestId("upload-edit"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Storage full");
  expect(screen.getByTestId("upload-review")).toHaveTextContent("Recover me");
  expect(screen.getByTestId("upload-edit")).toBeEnabled();
  await user.click(screen.getByTestId("upload-edit"));
  expect(draftFromParsed).toHaveBeenCalledTimes(2);
  expect(draftFromParsed).toHaveBeenLastCalledWith(parsed);
  client.clear();
});

it.each([
  ["upload", false],
  ["upload", true],
  ["publish", false],
  ["publish", true],
] as const)(
  "keeps %s resumable unless the final server status is ready (%s)",
  async (surface, ready) => {
    useSettings.setState({ compressMedia: false });
    const md5 = "a".repeat(32);
    const question = newQuestion(100, {
      text: "Q?",
      answerText: "A",
      questionFiles: [{ md5, type: "image", displayTime: null }],
    });
    const pkg = {
      ...emptyPackage("Quiz"),
      rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [question])] }],
    };
    const parsed: ParsedPackage = {
      format: "oq",
      content: toUpload(pkg),
      files: new Map(),
      warnings: [{ code: "missingFile", where: "", detail: md5 }],
    };
    readFile.mockResolvedValue(parsed);
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (url.pathname === "/v1/packages" && request.method === "GET")
        return json({ data: [], pageInfo: { total: 0 } });
      if (url.pathname === "/v1/packages" && request.method === "POST")
        return json({
          id: 7,
          uploadStatus: "uploading",
          uploadLinks: { [md5]: "https://media.example/missing" },
        });
      if (url.pathname === "/v1/packages/7/upload")
        return ready
          ? json({
              id: 7,
              status: "ready",
              totalFiles: 1,
              uploadedFiles: 1,
              missing: [],
              uploadLinks: {},
            })
          : json({ error: "status unavailable" }, 503);
      throw new Error(`unexpected request ${request.method} ${url}`);
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], { id: 1, username: "Author", isGuest: false });
    const media = new Map<string, MediaFile>([
      [
        md5,
        {
          md5,
          type: "image",
          name: "remote.png",
          bytes: new Uint8Array(),
          url: "https://media.example/old-file",
        },
      ],
    ]);
    const store = createPackageEditorStore({ draftId: "completion", pkg, media, savedAt: null });
    const { container } = render(
      <QueryClientProvider client={client}>
        {surface === "upload" ? (
          <UploadPackagePage />
        ) : (
          <PackageEditorContext.Provider value={store}>
            <PublishPackageDialog
              open
              onClose={() => {}}
              report={validatePackage(pkg, (hash) => media.has(hash))}
              onJump={() => {}}
            />
          </PackageEditorContext.Provider>
        )}
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    if (surface === "upload") {
      await user.upload(
        container.querySelector<HTMLInputElement>("input[type=file]")!,
        new File(["archive"], "quiz.oq"),
      );
      await user.click(await screen.findByRole("button", { name: "Upload package" }));
      await screen.findByTestId(ready ? "upload-done" : "upload-partial");
    } else {
      await user.click(screen.getByTestId("publish-confirm"));
      await screen.findByTestId("publish-done");
    }
    const resume =
      surface === "upload"
        ? screen.queryByRole("link", { name: "Finish later" })
        : document.querySelector('a[href="/packages/7/upload"]');
    expect(Boolean(resume)).toBe(!ready);
    if (!ready && surface === "upload") expect(resume).toHaveAttribute("href", "/packages/mine");
    if (surface === "publish")
      expect(Boolean(document.querySelector('a[href="/games/new"]'))).toBe(ready);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        (input as Request).url.endsWith("/v1/packages/7/upload"),
      ),
    ).toBe(true);
  },
);
