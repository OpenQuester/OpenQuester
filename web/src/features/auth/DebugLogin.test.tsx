import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppHeader } from "@/app/AppHeader";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function header(enabled?: string) {
  vi.stubEnv("VITE_DEBUG_LOGIN", enabled);
  return render(<AppHeader user={null} isLoading={false} path="/" />);
}

it.each([undefined, "", "false", "0"])("hides dev login when the flag is %s", (enabled) => {
  header(enabled);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dev sign in" })).not.toBeInTheDocument();
});

it("signs in as the selected numbered account and reloads the app", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  const assign = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("location", { assign });
  const user = userEvent.setup();
  header("true");
  const number = screen.getByRole("spinbutton", { name: "Dev user #" });
  await user.clear(number);
  await user.type(number, "42");
  await user.click(screen.getByRole("button", { name: "Dev sign in" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/v1/dev/login/42", {
    method: "POST",
    credentials: "include",
  });
});

it.each(["", "0", "1.5", "1000000"])("rejects invalid account number %s", (number) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  header("true");
  const input = screen.getByRole("spinbutton");
  fireEvent.change(input, { target: { value: number } });
  expect(screen.getByRole("button", { name: "Dev sign in" })).toBeDisabled();
  fireEvent.submit(input.closest("form")!);
  expect(fetch).not.toHaveBeenCalled();
});

it("shows failures and permits retry without changing the account", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  const assign = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("location", { assign });
  const user = userEvent.setup();
  header("true");
  await user.click(screen.getByRole("button", { name: "Dev sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 401");
  expect(screen.getByRole("button", { name: "Dev sign in" })).toBeEnabled();
  expect(assign).not.toHaveBeenCalled();
});
