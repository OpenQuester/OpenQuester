import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { strToU8, zipSync } from "fflate";
import { expect, it, vi } from "vitest";
import { HtmlRemovalDialog, useHtmlRemovalConfirmation } from "./HtmlRemovalDialog";
import { PackageImportCancelledError } from "./htmlRemoval";

const makeFile = (name = "x.siq", all = false) => {
  const xml = `<package><rounds><round name="&lt;img src=x onerror=alert(1)&gt;"><themes><theme name="T"><questions><question price="100" type="html"/>${all ? "" : '<question price="200"><scenario><atom>safe</atom></scenario></question>'}</questions></theme></themes></round></rounds></package>`;
  const archive = zipSync({ "content.xml": new Uint8Array(strToU8(xml)) });
  return {
    name,
    arrayBuffer: async () =>
      archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength),
  } as File;
};
function Harness({ onDone, file = makeFile() }: { onDone: (value: string) => void; file?: File }) {
  const confirmation = useHtmlRemovalConfirmation();
  const [state, setState] = useState("idle");
  const start = () => {
    const { promise, signal } = confirmation.begin(file);
    setState("reading");
    void promise.then(
      () => {
        if (!signal.aborted) {
          setState("done");
          onDone("done");
        }
      },
      (err: unknown) => {
        if (!signal.aborted) {
          setState(err instanceof PackageImportCancelledError ? "cancelled" : "error");
          onDone("cancelled");
        }
      },
    );
  };
  return (
    <>
      <button data-import-picker onClick={start}>
        Pick
      </button>
      <span>{state}</span>
      <HtmlRemovalDialog report={confirmation.report} settle={confirmation.settle} />
    </>
  );
}
it.each(["Cancel", "Close", "Escape"])(
  "cancels with %s and can retry the same file",
  async (method) => {
    const done = vi.fn();
    const user = userEvent.setup();
    render(<Harness onDone={done} />);
    await user.click(screen.getByText("Pick"));
    expect(await screen.findByRole("dialog")).toHaveTextContent("question 1");
    expect(document.querySelector("img")).toBeNull();
    expect(done).not.toHaveBeenCalled();
    if (method === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: method }));
    await screen.findByText("cancelled");
    await waitFor(() => expect(screen.getByText("Pick")).toHaveFocus());
    await user.click(screen.getByText("Pick"));
    await user.click(await screen.findByRole("button", { name: "Remove and continue" }));
    await screen.findByText("done");
    expect(done.mock.calls).toEqual([["cancelled"], ["done"]]);
  },
);
it("blocks an all-HTML package and does not settle twice", async () => {
  const done = vi.fn();
  const user = userEvent.setup();
  render(<Harness onDone={done} file={makeFile("all.siq", true)} />);
  await user.click(screen.getByText("Pick"));
  expect(await screen.findByRole("alert")).toHaveTextContent("No questions would remain");
  expect(screen.getByRole("button", { name: "Remove and continue" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByText("cancelled");
  expect(done).toHaveBeenCalledTimes(1);
});
it("cancels pending work on unmount", async () => {
  const done = vi.fn();
  const user = userEvent.setup();
  const view = render(<Harness onDone={done} />);
  await user.click(screen.getByText("Pick"));
  await screen.findByRole("dialog");
  view.unmount();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
});

it("ignores a delayed previous file and asks separately for the new file", async () => {
  const hook = renderHook(() => useHtmlRemovalConfirmation());
  const oldFile = makeFile("old.siq");
  let release!: (data: ArrayBuffer) => void;
  const bytesPromise = oldFile.arrayBuffer();
  oldFile.arrayBuffer = () =>
    new Promise<ArrayBuffer>((resolve) => {
      release = resolve;
    });
  let old!: ReturnType<typeof hook.result.current.begin>;
  let next!: ReturnType<typeof hook.result.current.begin>;
  act(() => {
    old = hook.result.current.begin(oldFile);
  });
  void old.promise.catch(() => {});
  act(() => {
    next = hook.result.current.begin(makeFile("new.siq"));
  });
  await waitFor(() => expect(hook.result.current.report).not.toBeNull());
  const report = hook.result.current.report;
  await act(async () => release(await bytesPromise));
  expect(old.signal.aborted).toBe(true);
  expect(hook.result.current.report).toBe(report);
  act(() => hook.result.current.settle(true));
  await expect(next.promise).resolves.toMatchObject({ format: "siq" });
  await expect(old.promise).rejects.toBeInstanceOf(PackageImportCancelledError);
});

it("cancels pending consent for A when B is picked and does not reuse it", async () => {
  const hook = renderHook(() => useHtmlRemovalConfirmation());
  let first!: ReturnType<typeof hook.result.current.begin>;
  let second!: ReturnType<typeof hook.result.current.begin>;
  act(() => {
    first = hook.result.current.begin(makeFile("first.siq"));
  });
  void first.promise.catch(() => {});
  await waitFor(() => expect(hook.result.current.report).not.toBeNull());
  act(() => {
    second = hook.result.current.begin(makeFile("second.siq"));
  });
  await waitFor(() => expect(hook.result.current.report).not.toBeNull());
  expect(first.signal.aborted).toBe(true);
  act(() => hook.result.current.settle(true));
  await expect(first.promise).rejects.toBeInstanceOf(PackageImportCancelledError);
  await expect(second.promise).resolves.toMatchObject({ format: "siq" });
});

it("settles a double confirmation only once", async () => {
  const done = vi.fn();
  const user = userEvent.setup();
  render(<Harness onDone={done} />);
  await user.click(screen.getByText("Pick"));
  const confirm = await screen.findByRole("button", { name: "Remove and continue" });
  act(() => {
    fireEvent.click(confirm);
    fireEvent.click(confirm);
  });
  await screen.findByText("done");
  expect(done).toHaveBeenCalledTimes(1);
});
