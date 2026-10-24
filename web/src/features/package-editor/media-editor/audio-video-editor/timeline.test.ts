import { expect, it } from "vitest";
import { fadeEnvelopePoints, timelineKeyPosition } from "./timeline";

it("keeps keyboard seek increments and leaves unrelated keys to their owner", () => {
  expect(timelineKeyPosition("Home", false, 4, 20)).toBe(0);
  expect(timelineKeyPosition("End", false, 4, 20)).toBe(20);
  expect(timelineKeyPosition("ArrowRight", false, 4, 20)).toBe(4.1);
  expect(timelineKeyPosition("ArrowLeft", true, 4, 20)).toBe(3);
  expect(timelineKeyPosition("ArrowUp", true, 4, 20)).toBe(5);
  expect(timelineKeyPosition("ArrowDown", false, 4, 20)).toBe(3.9);
  expect(timelineKeyPosition("PageUp", false, 4, 20)).toBe(14);
  expect(timelineKeyPosition("PageDown", false, 4, 20)).toBe(-6);
  expect(timelineKeyPosition(" ", false, 4, 20)).toBeNull();
});

it("places fade boundaries in source time with no duplicate envelope points", () => {
  const edits = { kind: "audio" as const, start: 10, end: 14, mute: false, fadeIn: 1, fadeOut: 2 };
  expect(fadeEnvelopePoints(edits)).toBe("10,90 11,10 12,10 14,90");
  expect(fadeEnvelopePoints({ ...edits, fadeIn: 4, fadeOut: 0 })).toBe("10,90 14,10");
});
