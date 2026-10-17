import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type * as EditorStore from "./store";
import { createEditorStore } from "./store";
import { loadDraft, loadMedia, saveDraft } from "./drafts";
import { EditorPage } from "./EditorPage";
import { emptyPackage } from "./model";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useParams: () => ({ draftId: "autosave" }),
}));
vi.mock("./drafts", () => ({ loadDraft: vi.fn(), loadMedia: vi.fn(), saveDraft: vi.fn() }));
vi.mock("./store", async (original) => {
  const actual = await original<typeof EditorStore>();
  return { ...actual, createEditorStore: vi.fn(actual.createEditorStore) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.mocked(loadDraft).mockResolvedValue({
    id: "autosave",
    pkg: emptyPackage("Before"),
    updatedAt: 1,
  });
  vi.mocked(loadMedia).mockResolvedValue(new Map());
  vi.mocked(saveDraft).mockResolvedValue();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { id: 1, username: "Author", isGuest: false });
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <EditorPage />
      </QueryClientProvider>,
    );
  });
  return vi.mocked(createEditorStore).mock.results[0]!.value as ReturnType<
    typeof createEditorStore
  >;
}

it.each(["QuotaExceededError", "AbortError"])(
  "keeps %s edits in memory and retries the current draft",
  async (name) => {
    const store = await openEditor();
    vi.mocked(saveDraft).mockRejectedValueOnce(new DOMException("Cannot write", name));
    act(() => store.getState().apply((pkg) => ({ ...pkg, title: "Unsaved changes" })));
    await act(() => vi.advanceTimersByTimeAsync(600));
    const alert = screen.getByTestId("save-failed");
    expect(alert).toHaveTextContent("Changes aren't saved on this device");
    expect(within(alert).getByRole("button", { name: "Export .oq" })).toBeEnabled();
    expect(store.getState().pkg.title).toBe("Unsaved changes");
    expect(store.getState().savedAt).toBe(1);
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: "Retry saving" }));
    });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveDraft).mock.calls[1]![0].pkg.title).toBe("Unsaved changes");
    expect(screen.queryByTestId("save-failed")).not.toBeInTheDocument();
    expect(store.getState().savedAt).toBeGreaterThan(1);
  },
);

it("resupplies existing media when undo restores its last saved reference", async () => {
  const md5 = "a".repeat(32);
  const file = { md5, type: "image" as const, name: "image.png", bytes: new Uint8Array([1, 2, 3]) };
  vi.mocked(loadDraft).mockResolvedValue({
    id: "autosave",
    pkg: { ...emptyPackage("Media"), logo: { md5, type: "image" } },
    updatedAt: 1,
  });
  vi.mocked(loadMedia).mockResolvedValue(new Map([[md5, file]]));
  const savedFiles: unknown[][] = [];
  vi.mocked(saveDraft).mockImplementation(async (_draft, files) => {
    savedFiles.push([...(files ?? [])]);
  });
  const store = await openEditor();
  act(() => store.getState().apply((pkg) => ({ ...pkg, logo: null })));
  await act(() => vi.advanceTimersByTimeAsync(600));
  act(() => store.getState().undo());
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(saveDraft).toHaveBeenCalledTimes(2);
  expect(vi.mocked(saveDraft).mock.calls[1]![0].pkg.logo?.md5).toBe(md5);
  expect(savedFiles[1]).toContainEqual(file);
});
