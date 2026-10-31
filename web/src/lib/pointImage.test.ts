import { expect, it } from "vitest";
import { pointImage } from "./pointImage";

it("resolves explicit image order without falling back when absent or ambiguous", () => {
  const files = [
    { order: 1, file: { type: "image" } },
    { order: 4, file: { type: "image" } },
  ];
  expect(pointImage(files, null)).toBe(files[0]);
  expect(pointImage(files, 4)).toBe(files[1]);
  expect(pointImage(files, 3)).toBeUndefined();
  expect(pointImage([...files, files[1]!], 4)).toBeUndefined();
});
