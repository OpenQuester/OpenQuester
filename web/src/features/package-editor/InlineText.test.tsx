import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { InlineText } from "./InlineText";

it("commits a rename once, follows external undo and discards Escape without another commit", async () => {
  const onCommit = vi.fn();
  const view = render(<InlineText value="Round one" label="Round name" onCommit={onCommit} />);
  const input = screen.getByRole("textbox", { name: "Round name" });
  const user = userEvent.setup();
  await user.clear(input);
  await user.type(input, "Renamed round");
  expect(onCommit).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(onCommit).toHaveBeenCalledExactlyOnceWith("Renamed round");
  view.rerender(<InlineText value="Renamed round" label="Round name" onCommit={onCommit} />);
  view.rerender(<InlineText value="Round one" label="Round name" onCommit={onCommit} />);
  expect(input).toHaveValue("Round one");
  await user.clear(input);
  await user.type(input, "Discard this");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(input).not.toHaveFocus());
  expect(input).toHaveValue("Round one");
  expect(onCommit).toHaveBeenCalledTimes(1);
});
