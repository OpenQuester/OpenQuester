import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Menu } from "./Menu";

describe("Menu", () => {
  it("moves focus into the list when it opens", async () => {
    render(
      <Menu
        label="More"
        items={[
          { label: "Rename", onSelect: vi.fn() },
          { label: "Delete", onSelect: vi.fn(), danger: true },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More" }));

    expect(await screen.findByRole("menuitem", { name: "Rename" })).toHaveFocus();
  });
});
