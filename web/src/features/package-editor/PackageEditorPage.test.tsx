import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type * as EditorStore from "./packageEditorStore";
import { createPackageEditorStore } from "./packageEditorStore";
import { loadDraft, loadMedia, saveDraft, listDrafts, deleteDraft } from "./draftStorage";
import { useDraftLibrary } from "./home/useDraftLibrary";
import { PackageEditorPage } from "./PackageEditorPage";
import { emptyPackage } from "./packageDraft";
import { mediaUrl } from "./packageMedia";
import { usePackageEditorDraft } from "./usePackageEditorDraft";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useParams: () => ({ draftId: "autosave" }),
  useNavigate: () => vi.fn(),
}));
vi.mock("./draftStorage", () => ({
  loadDraft: vi.fn(),
  loadMedia: vi.fn(),
  saveDraft: vi.fn(),
  listDrafts: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock("./packageEditorStore", async (original) => {
  const actual = await original<typeof EditorStore>();
  return { ...actual, createPackageEditorStore: vi.fn(actual.createPackageEditorStore) };
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
  vi.mocked(listDrafts).mockResolvedValue([]);
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
        <PackageEditorPage />
      </QueryClientProvider>,
    );
  });
  return vi.mocked(createPackageEditorStore).mock.results[0]?.value as ReturnType<
    typeof createPackageEditorStore
  >;
}

it.each(["draft", "media"] as const)(
  "shows a failed %s read and retries without losing the draft",
  async (phase) => {
    vi.mocked(phase === "draft" ? loadDraft : loadMedia).mockRejectedValueOnce(
      new Error("Read aborted"),
    );
    await openEditor();
    expect(screen.getByRole("heading", { name: "Couldn't load this. Try again." })).toBeVisible();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(createPackageEditorStore).toHaveBeenCalledTimes(1);
    expect(saveDraft).not.toHaveBeenCalled();
  },
);

it("recovers the draft library after read, create and delete failures", async () => {
  vi.mocked(listDrafts).mockRejectedValueOnce(new Error("Read aborted"));
  const view = renderHook(() => useDraftLibrary());
  await act(async () => {});
  expect(view.result.current.error).toBe("Couldn't load this. Try again.");
  await act(async () => view.result.current.reload());
  expect(view.result.current.drafts).toEqual([]);
  expect(view.result.current.error).toBeNull();
  vi.mocked(saveDraft).mockRejectedValueOnce(new Error("Full"));
  await act(async () => view.result.current.create());
  expect(view.result.current.busy).toBeNull();
  expect(view.result.current.error).toBe("Couldn't update drafts on this device. Try again.");
  vi.spyOn(window, "confirm").mockReturnValueOnce(true);
  vi.mocked(deleteDraft).mockRejectedValueOnce(new Error("Delete aborted"));
  await act(async () =>
    view.result.current.remove({
      id: "keep",
      title: "Keep",
      updatedAt: 1,
      rounds: 1,
      questions: 1,
    }),
  );
  expect(view.result.current.error).toBe("Couldn't update drafts on this device. Try again.");
  expect(listDrafts).toHaveBeenCalledTimes(2);
});

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

it.each(["draft", "media"] as const)(
  "ignores a late %s load after leaving the draft",
  async (phase) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    if (phase === "draft") {
      vi.mocked(loadDraft).mockImplementationOnce(async () => {
        await pending;
        return { id: "old", pkg: emptyPackage("Old"), updatedAt: 1 };
      });
    } else {
      vi.mocked(loadMedia).mockImplementationOnce(async () => {
        await pending;
        return new Map();
      });
    }
    const view = renderHook(({ id }) => usePackageEditorDraft(id), { initialProps: { id: "old" } });
    await act(async () => {});
    expect(view.result.current.store).toBeNull();
    await act(async () => view.rerender({ id: "current" }));
    const current = view.result.current.store;
    expect(current && typeof current !== "string" && current.getState().draftId).toBe("current");
    await act(async () => finish());
    expect(view.result.current.store).toBe(current);
    expect(createPackageEditorStore).toHaveBeenCalledTimes(1);
  },
);

it("flushes the last edit and releases owned media when the draft closes", async () => {
  const md5 = "b".repeat(32);
  const file = { md5, type: "image" as const, name: "image.png", bytes: new Uint8Array([1]) };
  vi.mocked(loadMedia).mockResolvedValue(new Map([[md5, file]]));
  const url = mediaUrl(file);
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const view = renderHook(() => usePackageEditorDraft("autosave"));
  await act(async () => {});
  const store = view.result.current.store;
  if (!store || typeof store === "string") throw new Error("Draft did not load");
  act(() =>
    store.getState().apply((pkg) => ({ ...pkg, title: "Last edit", logo: { md5, type: "image" } })),
  );
  expect(saveDraft).not.toHaveBeenCalled();
  await act(async () => view.unmount());
  expect(saveDraft).toHaveBeenCalledTimes(1);
  expect(vi.mocked(saveDraft).mock.calls[0]![0].pkg.title).toBe("Last edit");
  expect(revoke).toHaveBeenCalledWith(url);
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("pagehide"));
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(saveDraft).toHaveBeenCalledTimes(1);
  revoke.mockRestore();
});
