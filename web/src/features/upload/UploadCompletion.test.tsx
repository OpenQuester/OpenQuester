import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { emptyPackage, newQuestion, newRound, newTheme, toUpload } from "@/features/editor/model";
import { PublishDialog } from "@/features/editor/PublishDialog";
import { createEditorStore, EditorContext } from "@/features/editor/store";
import { validate } from "@/features/editor/validate";
import { useSettings } from "@/features/settings/settingsStore";
import type { MediaFile, ParsedPackage } from "./types";
import type * as Upload from "./upload";
import { UploadPackagePage } from "./UploadPackagePage";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test", DISCORD_CLIENT_ID: "" }));
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
    const store = createEditorStore({ draftId: "completion", pkg, media, savedAt: null });
    const { container } = render(
      <QueryClientProvider client={client}>
        {surface === "upload" ? (
          <UploadPackagePage />
        ) : (
          <EditorContext.Provider value={store}>
            <PublishDialog
              open
              onClose={() => {}}
              report={validate(pkg, (hash) => media.has(hash))}
              onJump={() => {}}
            />
          </EditorContext.Provider>
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
