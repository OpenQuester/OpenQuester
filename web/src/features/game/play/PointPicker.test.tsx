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
    picker.focus();
    expect(picker).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{Enter}");

    const [spot] = onPick.mock.calls[0]!;
    expect(spot.x).toBeCloseTo(0.54);
    expect(spot.y).toBeCloseTo(0.52);
  });
});
