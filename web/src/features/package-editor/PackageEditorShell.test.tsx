import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { ParsedPackage } from "@/features/upload/types";

import { loadDraft } from "./draftStorage";
import { draftFromParsed } from "./createDraft";
import { PackageEditorShell } from "./PackageEditorShell";
import { emptyPackage, newQuestion, newRound, newTheme, toUpload } from "./packageDraft";
import { createPackageEditorStore, PackageEditorContext } from "./packageEditorStore";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

afterEach(() => vi.unstubAllGlobals());

it("keeps a hidden import report available in the publish check", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const parsed: ParsedPackage = {
    format: "siq",
    content: toUpload(emptyPackage("Imported")),
    files: new Map(),
    warnings: [
      { code: "choiceAsSimple", where: "Round 1 · Cities · 100" },
      { code: "emptyQuestion", where: "Round 1 · Cities · 200" },
      { code: "missingFile", where: "Round 1 · Cities · 300", detail: "photo.png" },
    ],
  };
  const draftId = await draftFromParsed(parsed);
  const draft = (await loadDraft(draftId))!;
  const store = createPackageEditorStore({
    draftId,
    pkg: draft.pkg,
    media: new Map(),
    savedAt: draft.updatedAt,
    importWarnings: draft.importWarnings,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { id: 1, username: "Author", isGuest: false });
  render(
    <QueryClientProvider client={client}>
      <PackageEditorContext.Provider value={store}>
        <PackageEditorShell />
      </PackageEditorContext.Provider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  expect(within(screen.getByTestId("upload-warnings")).getAllByRole("listitem")).toHaveLength(3);
  await user.click(screen.getByRole("button", { name: "Hide this report" }));
  expect(screen.queryByTestId("upload-warnings")).not.toBeInTheDocument();
  expect(store.getState().importWarnings).toEqual(parsed.warnings);

  await user.click(screen.getByTestId("publish"));
  const report = within(screen.getByRole("dialog")).getByTestId("upload-warnings");
  expect(within(report).getAllByRole("listitem")).toHaveLength(3);
  expect(report).toHaveTextContent("photo.png");
});

it.each(["number", "point"] as const)(
  "blocks publish until a %s target is supplied",
  async (answerType) => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    const md5 = "a".repeat(32);
    const question = newQuestion(100, {
      text: "Question?",
      answerText: "Answer",
      answerType,
      questionFiles: [{ md5, type: "image", displayTime: null }],
    });
    const pkg = {
      ...emptyPackage("Quiz"),
      rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [question])] }],
    };
    const store = createPackageEditorStore({
      draftId: "target-check",
      pkg,
      savedAt: null,
      media: new Map([
        [
          md5,
          {
            md5,
            type: "image",
            name: "target.png",
            bytes: new Uint8Array(),
            url: "https://media.example/target.png",
          },
        ],
      ]),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], { id: 1, username: "Author", isGuest: false });
    render(
      <QueryClientProvider client={client}>
        <PackageEditorContext.Provider value={store}>
          <PackageEditorShell />
        </PackageEditorContext.Provider>
      </QueryClientProvider>,
    );
    await userEvent.setup().click(screen.getByTestId("publish"));
    expect(screen.getByTestId("publish-confirm")).toBeDisabled();
    act(() =>
      store.getState().apply((current) => ({
        ...current,
        rounds: [
          {
            ...current.rounds[0]!,
            themes: [
              newTheme("Theme", [{ ...question, answerNumber: 0, answerPoint: { x: 0, y: 1 } }]),
            ],
          },
        ],
      })),
    );
    expect(screen.getByTestId("publish-confirm")).toBeEnabled();
  },
);
