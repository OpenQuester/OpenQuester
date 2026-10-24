import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { UploadProgressCard } from "./UploadProgressCard";
import type { UploadProgress } from "./upload";
import { useUploadWarning } from "./useUploadWarning";

it("shows loading instead of a completed upload while the encoders load", () => {
  render(
    <UploadProgressCard
      title="Quiz"
      progress={{ phase: "optimizing", done: 0, total: 0, sentBytes: 0, totalBytes: 0, files: [] }}
    />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByTestId("upload-progress")).toHaveTextContent("Loading");
});

it("warns only during an upload and removes the browser listener on teardown", () => {
  const { rerender, unmount } = renderHook(({ busy }) => useUploadWarning(busy), {
    initialProps: { busy: false },
  });
  const warns = () => {
    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);
    return event.defaultPrevented;
  };
  expect(warns()).toBe(false);
  rerender({ busy: true });
  expect(warns()).toBe(true);
  rerender({ busy: false });
  expect(warns()).toBe(false);
  rerender({ busy: true });
  unmount();
  expect(warns()).toBe(false);
});

it("keeps file-list expansion through progress updates and puts failed files first", async () => {
  const progress: UploadProgress = {
    phase: "media",
    done: 8,
    total: 10,
    sentBytes: 800,
    totalBytes: 1000,
    files: Array.from({ length: 10 }, (_, index) => ({
      md5: String(index),
      name: `picture-${index}.png`,
      type: "image",
      bytes: 100,
      sent: index < 8 ? 100 : 0,
      state: index < 8 ? "done" : "waiting",
    })),
  };
  const { rerender } = render(<UploadProgressCard title="Quiz" progress={progress} />);
  const list = screen.getByTestId("upload-files");
  expect(within(list).getAllByRole("listitem")).toHaveLength(8);
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("picture-8.png");
  await userEvent.setup().click(screen.getByRole("button", { name: /Show all 10/ }));
  expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  const updated: UploadProgress = {
    ...progress,
    files: progress.files.map((file) => (file.md5 === "9" ? { ...file, state: "failed" } : file)),
  };
  rerender(<UploadProgressCard title="Quiz" progress={updated} />);
  expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("picture-9.png");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "81");
});
