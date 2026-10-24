import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Menu } from "./Menu";

describe("Menu", () => {
  it("returns Tab to the page order and restores trigger focus after selection", async () => {
    render(
      <>
        <Menu
          label="More"
          items={[
            { label: "Rename", onSelect: vi.fn() },
            { label: "Delete", onSelect: vi.fn() },
          ]}
        />
        <button>Next control</button>
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Next control" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });
  it("moves focus into the list when it opens", async () => {
    render(
      <Menu
        label="More"
        items={[
          { label: "Unavailable", onSelect: vi.fn(), disabled: true },
          { label: "Rename", onSelect: vi.fn() },
          { label: "Delete", onSelect: vi.fn(), danger: true },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More" }));

    expect(await screen.findByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Rename" })).toHaveFocus();
  });

  it("releases document and viewport listeners on close and unmount", async () => {
    const documentAdd = vi.spyOn(document, "addEventListener");
    const documentRemove = vi.spyOn(document, "removeEventListener");
    const windowAdd = vi.spyOn(window, "addEventListener");
    const windowRemove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <Menu label="Actions" items={[{ label: "Rename", onSelect: vi.fn() }]} />,
    );
    const user = userEvent.setup();
    try {
      for (const close of [() => fireEvent.resize(window), unmount]) {
        await user.click(screen.getByRole("button", { name: "Actions" }));
        expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
        const documentHandlers = documentAdd.mock.calls
          .filter(([type]) => type === "pointerdown" || type === "keydown")
          .slice(-2);
        const windowHandlers = windowAdd.mock.calls
          .filter(([type]) => String(type) === "resize" || String(type) === "scroll")
          .slice(-2);
        close();
        expect(screen.queryByRole("menu")).toBeNull();
        for (const args of documentHandlers) expect(documentRemove).toHaveBeenCalledWith(...args);
        for (const args of windowHandlers) expect(windowRemove).toHaveBeenCalledWith(...args);
        const key = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
        document.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(false);
      }
    } finally {
      documentAdd.mockRestore();
      documentRemove.mockRestore();
      windowAdd.mockRestore();
      windowRemove.mockRestore();
    }
  });
});
