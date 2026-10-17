import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { ParsedPackage } from "@/features/upload/types";

import { loadDraft } from "./drafts";
import { draftFromParsed } from "./EditorHomePage";
import { EditorShell } from "./EditorShell";
import { emptyPackage, toUpload } from "./model";
import { createEditorStore, EditorContext } from "./store";

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
  const store = createEditorStore({
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
      <EditorContext.Provider value={store}>
        <EditorShell />
      </EditorContext.Provider>
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
