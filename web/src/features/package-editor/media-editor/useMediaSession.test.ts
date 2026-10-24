import { act, renderHook, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { MediaFile } from "@/features/upload/types";
import { releaseMediaUrl } from "../packageMedia";
import { acquireMedia } from "./processMedia";
import { useMediaSession } from "./useMediaSession";

vi.mock("./processMedia", () => ({ acquireMedia: vi.fn() }));
vi.mock("../packageMedia", () => ({ releaseMediaUrl: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it.each(["cancel", "unmount"] as const)(
  "does not accept a late processing result after %s and releases unaccepted bytes",
  async (ending) => {
    const source: MediaFile = {
      md5: "source",
      type: "image",
      name: "source.png",
      bytes: new Uint8Array([1]),
    };
    const output = { ...source, md5: "output", preserveEncoding: true };
    vi.mocked(acquireMedia).mockResolvedValue({ file: source, mime: "image/png" });
    const onSave = vi.fn(),
      onClose = vi.fn();
    const { result, unmount } = renderHook(() =>
      useMediaSession({
        source,
        title: "Question media",
        index: 0,
        total: 1,
        closeRef: createRef(),
        onSave,
        onClose,
        onSkip: vi.fn(),
        onRemaining: async () => {},
      }),
    );
    await waitFor(() => expect(result.current.loaded?.file).toBe(source));
    let finish!: (value: { file: MediaFile; geometryChanged: boolean }) => void;
    let processingSignal!: AbortSignal;
    act(() => {
      result.current.statusChanged({ dirty: true, ready: true });
      result.current.controlRef.current = {
        save: (signal) => {
          processingSignal = signal;
          // Deliberately resolve after abort: the session must guard completion,
          // even when a processor cannot stop its underlying work immediately.
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      };
    });
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.save();
    });
    expect(result.current.busy).toBe(true);
    if (ending === "unmount") unmount();
    else act(() => result.current.requestClose());
    expect(processingSignal.aborted).toBe(true);
    await act(async () => {
      finish({ file: output, geometryChanged: true });
      await saving;
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    if (ending === "cancel") {
      expect(result.current.busy).toBe(false);
      expect(result.current.status).toEqual({ dirty: true, ready: true });
      act(() => {
        result.current.controlRef.current = {
          save: async () => ({ file: output, geometryChanged: true }),
        };
      });
      await act(async () => {
        await result.current.save();
      });
      expect(onSave).toHaveBeenCalledWith({ source, file: output, geometryChanged: true });
      unmount();
      expect(releaseMediaUrl).not.toHaveBeenCalled(); // Ownership passed to the form.
    } else expect(releaseMediaUrl).toHaveBeenCalledWith(source);
  },
);
