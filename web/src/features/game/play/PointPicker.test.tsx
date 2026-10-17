import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@/i18n";

import { PointPicker } from "./PointPicker";

describe("PointPicker from the keyboard", () => {
  it("moves the cursor with arrow keys and picks with Enter", async () => {
    const onPick = vi.fn();
    render(<PointPicker src="https://x/p" onPick={onPick} />);

    const picker = screen.getByTestId("point-picker");
    await userEvent.tab();
    expect(picker).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{Enter}");

    const [spot] = onPick.mock.calls[0]!;
    expect(spot.x).toBeCloseTo(0.54);
    expect(spot.y).toBeCloseTo(0.52);
  });

  it("uses Shift for larger steps, clamps both edges, and selects with Space", async () => {
    const onPick = vi.fn();
    render(<PointPicker src="https://x/p" onPick={onPick} />);
    const picker = screen.getByRole("button");
    await userEvent.tab();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift} ");
    expect(onPick).toHaveBeenLastCalledWith({ x: 0.6, y: 0.5 });
    await userEvent.keyboard("{Shift>}{ArrowLeft>7/}{ArrowUp>7/}{/Shift} ");
    expect(onPick).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    expect(picker).toHaveAttribute("aria-description", expect.stringContaining("0"));
    await userEvent.keyboard("{Shift>}{ArrowRight>12/}{ArrowDown>12/}{/Shift}{Enter}");
    expect(onPick).toHaveBeenLastCalledWith({ x: 1, y: 1 });
    expect(picker).toHaveAttribute("aria-description", expect.stringContaining("100"));
  });

  it("does not add a keyboard stop to the read-only answer reveal", async () => {
    render(<PointPicker src="https://x/p" target={{ x: 0.5, y: 0.5 }} />);
    expect(screen.queryByRole("button")).toBeNull();
    await userEvent.tab();
    expect(screen.getByTestId("point-picker")).not.toHaveFocus();
    expect(screen.getByTestId("point-target")).toBeInTheDocument();
  });
});
