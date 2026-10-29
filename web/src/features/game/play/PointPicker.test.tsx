import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";

import { PointPicker } from "./PointPicker";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

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

  it("describes target and default, zero or tiny radius without inventing a target", () => {
    const { rerender } = render(<PointPicker src="https://x/p" target={{ x: 0, y: 0.75 }} />);
    expect(
      screen.getByText(
        "Correct point: 0% of the image width from the left, 75% of its height from the top. Tolerance radius: 5% of the image width. Image dimensions are not yet available.",
      ),
    ).toHaveClass("sr-only");
    rerender(<PointPicker src="https://x/p" target={{ x: 0, y: 0 }} radius={0} />);
    expect(screen.getByText(/Tolerance radius: 0%/)).toBeInTheDocument();
    rerender(<PointPicker src="https://x/p" target={{ x: 0, y: 0 }} radius={0.00000001} />);
    expect(screen.getByText(/Tolerance radius: 0\.000001%/)).toBeInTheDocument();
    rerender(<PointPicker src="https://x/p" />);
    expect(screen.queryByText(/Correct point:/)).toBeNull();
  });

  it("describes only the current decoded image dimensions and forwards its load", () => {
    const onImageLoad = vi.fn();
    const target = { x: 0.5, y: 0.5 };
    const { rerender } = render(
      <PointPicker src="https://x/wide" target={target} onImageLoad={onImageLoad} />,
    );
    const img = screen.getByRole("img");
    expect(screen.getByText(/Image dimensions are not yet available/)).toBeInTheDocument();
    Object.defineProperty(img, "naturalWidth", { value: 400, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 200, configurable: true });
    fireEvent.load(img);
    expect(screen.getByText(/Image dimensions: 400 by 200 pixels/)).toBeInTheDocument();
    expect(onImageLoad).toHaveBeenLastCalledWith(400, 200);

    rerender(<PointPicker src="https://x/tall" target={target} onImageLoad={onImageLoad} />);
    expect(screen.queryByText(/400 by 200/)).toBeNull();
    expect(screen.getByText(/Image dimensions are not yet available/)).toBeInTheDocument();
    Object.defineProperty(img, "naturalWidth", { value: 200, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 400, configurable: true });
    fireEvent.load(img);
    expect(screen.getByText(/Image dimensions: 200 by 400 pixels/)).toBeInTheDocument();
    expect(onImageLoad).toHaveBeenLastCalledWith(200, 400);
    fireEvent.error(img);
    expect(screen.queryByText(/200 by 400/)).toBeNull();
    expect(screen.getByText(/Image dimensions are not yet available/)).toBeInTheDocument();
    rerender(<PointPicker src="https://x/tall" />);
    expect(screen.queryByText(/Image dimensions/)).toBeNull();
  });

  it("provides target and cursor descriptions to the interactive picker", async () => {
    render(
      <PointPicker src="https://x/p" target={{ x: 0.7, y: 0.3 }} radius={0} onPick={vi.fn()} />,
    );
    const picker = screen.getByRole("button");
    expect(picker).toHaveAccessibleDescription(/Correct point: 70%.*30%.*Tolerance radius: 0%/);
    await userEvent.tab();
    expect(picker).toHaveAccessibleDescription(/Cursor at 50%.*Correct point: 70%/);
    expect(screen.queryByText(/Correct point:/)).toBeNull();
  });

  it.each([
    ["uk", /Правильна точка: 70%.*30%.*Радіус допуску: 5%/],
    ["ru", /Правильная точка: 70%.*30%.*Радиус допуска: 5%/],
  ])("localizes the correct target in %s", async (language, expected) => {
    await i18n.changeLanguage(language);
    render(<PointPicker src="https://x/p" target={{ x: 0.7, y: 0.3 }} />);
    expect(screen.getByText(expected)).toHaveClass("sr-only");
  });
});
