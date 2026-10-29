import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { BidControls } from "./BidControls";

it("synchronizes slider, input and suggestions without submitting invalid drafts", async () => {
  const onBid = vi.fn();
  const props = { range: { min: 100, max: 500 }, allIn: null, pending: false, onBid };
  const { rerender } = render(<BidControls {...props} />);
  const input = screen.getByRole("textbox", { name: "Your bid" });
  const slider = screen.getByRole("slider", { name: "Bid amount slider" });
  const submit = screen.getByTestId("bid-submit");
  fireEvent.change(input, { target: { value: "235" } });
  expect(slider).toHaveValue("235");
  fireEvent.change(slider, { target: { value: "347" } });
  expect(input).toHaveValue("347");
  await userEvent.click(screen.getByRole("button", { name: "300" }));
  expect(input).toHaveValue("300");
  expect(slider).toHaveValue("300");
  for (const raw of ["", "-5", "2.5", "not a bid", "999"]) {
    fireEvent.change(input, { target: { value: raw } });
    expect(input).toHaveValue(raw);
    expect(submit).toHaveAttribute("aria-disabled", "true");
    fireEvent.submit(submit.closest("form")!);
    expect(onBid).not.toHaveBeenCalled();
  }
  expect(slider).toHaveValue("500");
  fireEvent.change(input, { target: { value: "450" } });
  rerender(<BidControls {...props} range={{ min: 100, max: 300 }} />);
  expect(input).toHaveValue("450");
  expect(slider).toHaveValue("300");
  expect(submit).toHaveAttribute("aria-disabled", "true");
  rerender(<BidControls {...props} pending />);
  expect(input).toBeDisabled();
  expect(slider).toBeDisabled();
  fireEvent.submit(submit.closest("form")!);
  expect(onBid).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Sending");
  rerender(<BidControls {...props} />);
  expect(input).toHaveValue("450");
  await userEvent.click(submit);
  expect(onBid).toHaveBeenCalledExactlyOnceWith(450);
});

it("keeps the one legal amount editable while the single-value slider is disabled", () => {
  render(<BidControls range={{ min: 1, max: 1 }} allIn={1} pending={false} onBid={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Your bid" })).toHaveValue("1");
  expect(screen.getByRole("slider", { name: "Bid amount slider" })).toBeDisabled();
  expect(screen.getByTestId("bid-submit")).not.toHaveAttribute("aria-disabled", "true");
});
