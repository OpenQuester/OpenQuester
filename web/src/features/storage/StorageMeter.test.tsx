import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { StorageMeter } from "./StorageMeter";

function mount(used: number, quota: number | null, pending: number) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["me", "storage"], { usedBytes: used, quotaBytes: quota });
  return render(
    <QueryClientProvider client={client}>
      <StorageMeter pendingBytes={pending} />
    </QueryClientProvider>,
  );
}

it("separates actual usage from the prospective package, including sub-percent sizes", () => {
  mount(200, 1000, 1);
  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", "20");
  expect(bar).toHaveAttribute("aria-valuetext", "200 B already used; this package may add 1 B.");
  expect(bar.firstElementChild).toHaveStyle({ width: "20%" });
  expect(screen.getByTestId("storage-pending")).toHaveStyle({ width: "0.1%" });
});
it("clamps a projected overflow to available width and warns without blocking", () => {
  mount(900, 1000, 200);
  expect(screen.getByTestId("storage-pending")).toHaveStyle({ width: "10%" });
  expect(screen.getByText(/exceed your limit/)).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "90");
});
it.each([0, 100])("shows no projected segment for an already full quota %s", (quota) => {
  mount(100, quota, 200);
  expect(screen.queryByTestId("storage-pending")).toBeNull();
  expect(screen.getByText(/exceed your limit/)).toBeVisible();
});
it("shows estimated bytes without a misleading percentage for unlimited storage", () => {
  mount(100, null, 200);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByText("This package: approximately +200 B.")).toBeVisible();
});
it.each([0, -1, NaN, Infinity])("ignores invalid or empty projections: %s", (pending) => {
  mount(100, 1000, pending);
  expect(screen.queryByTestId("storage-pending")).toBeNull();
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuetext");
});
