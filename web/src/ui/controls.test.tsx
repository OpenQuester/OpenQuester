import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { Dialog } from "./Dialog";
import { Pagination } from "./Pagination";
import { RadioButton } from "./RadioButton";

it("restores a controlled dialog's opener and keeps keyboard focus inside while open", async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open details</button>
        <Dialog open={open} onOpenChange={setOpen} title="Details">
          <button>Inner action</button>
        </Dialog>
      </>
    );
  }
  render(<Example />);
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: "Open details" });
  await user.click(opener);
  expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(opener).toHaveFocus());
});

it("lets a user return from a deleted final page even when only one page remains", async () => {
  function Example() {
    const [page, setPage] = useState(1);
    return (
      <>
        <output>{page}</output>
        <Pagination page={page} pages={1} setPage={setPage} />
      </>
    );
  }
  render(<Example />);
  await userEvent.click(screen.getByRole("button", { name: /Previous/ }));
  expect(screen.getByRole("status")).toHaveTextContent("0");
});

it("selects radio options with arrows and exposes only the selected option as a Tab stop", async () => {
  function Example() {
    const [value, setValue] = useState("a");
    return (
      <div role="radiogroup" aria-label="Mode">
        {["a", "b"].map((id) => (
          <RadioButton key={id} checked={value === id} onClick={() => setValue(id)}>
            {id}
          </RadioButton>
        ))}
      </div>
    );
  }
  render(<Example />);
  act(() => screen.getByRole("radio", { name: "a" }).focus());
  await userEvent.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "b" })).toHaveFocus();
  expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "a" })).toHaveAttribute("tabindex", "-1");
});
