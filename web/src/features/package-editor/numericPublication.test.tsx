import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { useSettings } from "@/features/settings/settingsStore";
import { emptyPackage, newQuestion, newRound, newTheme, toUpload } from "./packageDraft";
import { uploadPackage } from "@/features/upload/upload";
import { createPackageEditorStore, PackageEditorContext } from "./packageEditorStore";
import { PublishPackageDialog } from "./PublishPackageDialog";
import { validatePackage } from "./validatePackage";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const { fetchMock } = vi.hoisted(() => {
  const fetchMock = vi.fn<typeof fetch>();
  globalThis.fetch = fetchMock;
  return { fetchMock };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

afterEach(() => {
  fetchMock.mockReset();
  useSettings.setState({ compressMedia: true });
});

it.each([false, true])(
  "publishes a numeric projection while preserving the editor draft (replace: %s)",
  async (replace) => {
    useSettings.setState({ compressMedia: false });
    const question = newQuestion(100, {
      text: "Question",
      answerType: "number",
      answerNumber: -12.5,
      answerDeviation: 0.5,
      answerText: "Old answer",
      rightAnswers: ["Old right"],
      wrongAnswers: ["Old wrong"],
    });
    const pkg = {
      ...emptyPackage("Numeric"),
      rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [question])] }],
    };
    const store = createPackageEditorStore({
      draftId: "numeric-publish",
      pkg,
      media: new Map(),
      savedAt: null,
      publishedId: replace ? 7 : undefined,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], { id: 1, username: "Author", isGuest: false });
    client.setQueryData(["auth-settings"], { oauthProviders: [] });
    let body: unknown;
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      const json = (value: unknown) =>
        new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
      if (
        (request.method === "POST" && url.pathname === "/v1/packages") ||
        (request.method === "PUT" && url.pathname === "/v1/packages/7")
      ) {
        body = await request.json();
        return json({ id: 7, uploadStatus: "ready", uploadLinks: {} });
      }
      if (url.pathname === "/v1/packages/7/upload")
        return json({
          id: 7,
          status: "ready",
          totalFiles: 0,
          uploadedFiles: 0,
          missing: [],
          uploadLinks: {},
        });
      throw new Error(`Unexpected request ${request.method} ${url.pathname}`);
    });
    render(
      <QueryClientProvider client={client}>
        <PackageEditorContext.Provider value={store}>
          <PublishPackageDialog
            open
            onClose={() => {}}
            report={validatePackage(pkg, () => true)}
            onJump={() => {}}
          />
        </PackageEditorContext.Provider>
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByTestId("publish-confirm"));
    await waitFor(() => expect(body).toBeDefined());
    await screen.findByTestId("publish-done");
    expect(body).toMatchObject({
      content: {
        rounds: [
          {
            themes: [
              {
                questions: [
                  {
                    answerType: "number",
                    answerNumber: -12.5,
                    answerText: "-12.5",
                    rightAnswers: null,
                    wrongAnswers: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
      answerText: "Old answer",
      rightAnswers: ["Old right"],
      wrongAnswers: ["Old wrong"],
    });
  },
);

it("does not rewrite numeric text when an existing archive is uploaded directly", async () => {
  const question = newQuestion(100, {
    text: "Question",
    answerType: "number",
    answerNumber: 42,
    answerText: "42 units",
    rightAnswers: ["forty-two"],
    wrongAnswers: ["other"],
  });
  const pkg = {
    ...emptyPackage("Imported"),
    rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [question])] }],
  };
  let body: unknown;
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
    if (request.method === "POST" && url.pathname === "/v1/packages") {
      body = await request.json();
      return json({ id: 7, uploadStatus: "ready", uploadLinks: {} });
    }
    if (url.pathname === "/v1/packages/7/upload")
      return json({
        id: 7,
        status: "ready",
        totalFiles: 0,
        uploadedFiles: 0,
        missing: [],
        uploadLinks: {},
      });
    throw new Error(`Unexpected request ${request.method} ${url.pathname}`);
  });
  await uploadPackage(
    { format: "oq", content: toUpload(pkg), files: new Map(), warnings: [] },
    () => {},
  );
  expect(body).toMatchObject({
    content: {
      rounds: [
        {
          themes: [
            {
              questions: [
                { answerText: "42 units", rightAnswers: ["forty-two"], wrongAnswers: ["other"] },
              ],
            },
          ],
        },
      ],
    },
  });
});
