import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useDraftLibrary } from "./useDraftLibrary";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/features/upload/upload", () => ({ readPackageFile: mocks.read }));
vi.mock("../createDraft", () => ({ draftFromParsed: mocks.save, newDraft: vi.fn() }));
vi.mock("../draftStorage", () => ({ listDrafts: vi.fn(async () => []), deleteDraft: vi.fn() }));

it("does not navigate after a stale draft save finishes", async () => {
  let finish!: (id: string) => void;
  mocks.read.mockResolvedValue({ content: {}, files: new Map(), warnings: [] });
  mocks.save.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );
  const hook = renderHook(() => useDraftLibrary());
  let task!: Promise<void>;
  act(() => {
    task = hook.result.current.importFile(new File([], "first.siq"));
  });
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  hook.unmount();
  await act(async () => {
    finish("old-draft");
    await task;
  });
  expect(mocks.navigate).not.toHaveBeenCalled();
});
