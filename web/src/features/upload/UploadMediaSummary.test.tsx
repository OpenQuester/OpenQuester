import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UploadMediaSummary } from "./UploadMediaSummary";
import { estimateMediaBytes } from "./optimize/estimate";
import type { MediaFile } from "./types";

vi.mock("./optimize/estimate", () => ({ estimateMediaBytes: vi.fn() }));
afterEach(() => vi.mocked(estimateMediaBytes).mockReset());

function files(md5: string, size: number) {
  const file: MediaFile = { md5, name: "sound.wav", type: "audio", bytes: new Uint8Array(size) };
  return new Map([[md5, file]]);
}
function client() {
  const result = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  result.setQueryData(["me", "storage"], { usedBytes: 0, quotaBytes: 1000 });
  return result;
}
it("keeps the original size as a conservative forecast if inspection fails", async () => {
  vi.mocked(estimateMediaBytes).mockRejectedValue(new Error("Unavailable"));
  const queryClient = client();
  render(
    <QueryClientProvider client={queryClient}>
      <UploadMediaSummary files={files("one", 100)} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("≈ 100 B")).toBeVisible();
  expect(screen.getByTestId("storage-pending")).toHaveStyle({ width: "10%" });
  expect(screen.queryByRole("checkbox")).toBeNull();
  queryClient.clear();
});
it("does not show a previous package's forecast after choosing another file", async () => {
  let finishFirst!: (bytes: number) => void;
  vi.mocked(estimateMediaBytes)
    .mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockResolvedValueOnce(20);
  const queryClient = client();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <UploadMediaSummary files={files("first", 100)} />
    </QueryClientProvider>,
  );
  await vi.waitFor(() => expect(estimateMediaBytes).toHaveBeenCalledOnce());
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <UploadMediaSummary files={files("second", 50)} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("≈ 20 B")).toBeVisible();
  await act(async () => finishFirst(90));
  expect(screen.queryByText("≈ 90 B")).toBeNull();
  expect(screen.getByText("50 B")).toBeVisible();
  expect(screen.getByTestId("storage-pending")).toHaveStyle({ width: "2%" });
  queryClient.clear();
});
