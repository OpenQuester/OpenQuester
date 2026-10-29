import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { i18n } from "@/i18n/index";
import { useSettings } from "@/features/settings/settingsStore";
import type * as Upload from "@/features/upload/upload";
import type { MediaFile } from "@/features/upload/types";
import { uploadPackage } from "@/features/upload/upload";
import { PointImageDimensionsError } from "@/features/upload/pointImageDimensions";
import { FinalMediaDurationError } from "@/features/upload/finalMediaDuration";
import { emptyPackage, newQuestion, newRound, newTheme } from "./packageDraft";
import { PublishPackageDialog } from "./PublishPackageDialog";
import { createPackageEditorStore, PackageEditorContext } from "./packageEditorStore";
import { validatePackage } from "./validatePackage";

vi.mock("@/features/upload/upload", async (original) => ({
  ...(await original<typeof Upload>()),
  uploadPackage: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

afterEach(() => {
  vi.mocked(uploadPackage).mockReset();
  act(() => useSettings.setState({ compressMedia: true }));
});

it.each([
  [new ApiError("Offline", 0), "upload.networkError"],
  [new ApiError("Forbidden", 403), "editor.publish.notYours"],
  [new ApiError("Package too large", 413), "Package too large"],
  [new ApiError("Storage full", 507), "Storage full"],
  [new ApiError("Invalid content", 400), "upload.serverRejected"],
  [new PointImageDimensionsError(), "upload.pointImageDimensions"],
  [new FinalMediaDurationError("tooLong", "video"), "upload.finalMedia.tooLong"],
  [new Error("Local failure"), "Error: Local failure"],
] as const)(
  "preserves publish error %s and retries as a new package with current compression settings",
  async (error, message) => {
    const file: MediaFile = {
      md5: "a".repeat(32),
      type: "image",
      name: "accepted.png",
      bytes: new Uint8Array([1, 2, 3]),
      preserveEncoding: true,
    };
    const media = new Map([
      [file.md5, file],
      ["unused", { ...file, md5: "unused" }],
    ]);
    const q = newQuestion(100, {
      text: "Question",
      answerText: "Answer",
      questionFiles: [{ md5: file.md5, type: "image", displayTime: null }],
    });
    const pkg = {
      ...emptyPackage("Publishing"),
      rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [q])] }],
    };
    const store = createPackageEditorStore({
      draftId: "publish",
      pkg,
      media,
      savedAt: null,
      publishedId: 12,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], { id: 1, isGuest: false });
    client.setQueryData(["auth-settings"], { oauthProviders: [] });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(uploadPackage)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ id: 24, failed: [], state: null });
    useSettings.setState({ compressMedia: false });
    render(
      <QueryClientProvider client={client}>
        <PackageEditorContext.Provider value={store}>
          <PublishPackageDialog
            open
            onClose={() => {}}
            report={validatePackage(pkg, (hash) => media.has(hash))}
            onJump={() => {}}
          />
        </PackageEditorContext.Provider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("publish-confirm"));
    const expected =
      message.startsWith("upload.") || message.startsWith("editor.")
        ? i18n.t(message, { message: "Invalid content", name: "video" })
        : message;
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(store.getState().publishedId).toBe(12);
    expect(invalidate).not.toHaveBeenCalled();
    expect(vi.mocked(uploadPackage).mock.calls[0]?.slice(2)).toEqual([12, false, null]);

    act(() => useSettings.setState({ compressMedia: true }));
    await user.click(screen.getByRole("button", { name: i18n.t("editor.publish.publishAsNew") }));
    await screen.findByTestId("publish-done");
    const call = vi.mocked(uploadPackage).mock.calls[1]!;
    expect(call.slice(2)).toEqual([undefined, true, null]);
    expect([...call[0].files.values()]).toEqual([file]);
    expect(call[0].files.get(file.md5)).toBe(file);
    expect(store.getState().publishedId).toBe(24);
    expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual([
      ["package", 24],
      ["packages"],
      ["me", "storage"],
      ["package-upload", 24],
    ]);
  },
);
