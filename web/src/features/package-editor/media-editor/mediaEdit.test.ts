import { expect, it, vi } from "vitest";
import { optimizePackage } from "@/features/upload/optimize/index";
import type { MediaFile } from "@/features/upload/types";
import { emptyPackage, newQuestion, newRound, newTheme, toUpload } from "../packageDraft";
import { createPackageEditorStore } from "../packageEditorStore";
import { updateQuestion } from "../packageOperations";
import { collectMedia, loadMedia, saveDraft } from "../draftStorage";
import {
  fadeGain,
  unrotate,
  validTrim,
  updateAudioVideoEdits,
  formatTime,
  parseTime,
  trimAtPlayhead,
  imageChanged,
  initialImageEdits,
} from "./mediaEdits";
import { imageSize } from "./renderImage";
import { detectMediaMime, isStillImage } from "@/features/upload/archive";

it("uses the same linear fade envelope at both ends and validates trim bounds", () => {
  expect([0, 0.25, 0.5, 1, 1.5, 1.75, 2].map((t) => fadeGain(t, 2, 0.5, 0.5))).toEqual([
    0, 0.5, 1, 1, 1, 0.5, 0,
  ]);
  const edit = { kind: "audio" as const, start: 1, end: 3, mute: false, fadeIn: 0.5, fadeOut: 0.5 };
  expect(validTrim(edit, 4)).toBe(true);
  expect(validTrim({ ...edit, fadeIn: 1.5 }, 4)).toBe(true);
  for (const patch of [{ start: NaN }, { end: 5 }, { start: -1 }, { end: 1 }, { fadeIn: 1.6 }])
    expect(validTrim({ ...edit, ...patch }, 4)).toBe(false);
  const fadeIn = updateAudioVideoEdits(edit, { fadeIn: 2 });
  expect(fadeIn).toMatchObject({ fadeIn: 2, fadeOut: 0 });
  expect(updateAudioVideoEdits(fadeIn, { fadeOut: 1.5 })).toMatchObject({
    fadeIn: 0.5,
    fadeOut: 1.5,
  });
  expect(updateAudioVideoEdits({ ...edit, fadeIn: 1.5 }, { end: 2 })).toMatchObject({
    fadeIn: 0.75,
    fadeOut: 0.25,
  });
  expect(fadeGain(1, 2, 2, 0)).toBe(0.5);
});

it("formats timecodes without overflow and rejects ambiguous raw seconds", () => {
  expect(formatTime(59.999)).toBe("1:00.00");
  expect(formatTime(1407.5)).toBe("23:27.50");
  expect(parseTime("23:27.50")).toBe(1407.5);
  expect(parseTime("23:27,5")).toBe(1407.5);
  for (const value of ["", "1407.5", "0:60", "-1:00", "foo"]) expect(parseTime(value)).toBeNaN();
});

it("cuts at the playhead without allowing empty/reversed intervals or losing the fade budget", () => {
  const edit = { kind: "audio" as const, start: 1, end: 4, mute: false, fadeIn: 2, fadeOut: 1 };
  const trimmed = trimAtPlayhead(edit, "start", 2, 5)!;
  expect(trimmed).toMatchObject({ start: 2, end: 4 });
  expect(trimmed.fadeIn).toBeCloseTo(4 / 3);
  expect(trimmed.fadeOut).toBeCloseTo(2 / 3);
  expect(trimAtPlayhead(edit, "end", 2, 5)).toMatchObject({ start: 1, end: 2 });
  expect(trimAtPlayhead(edit, "start", 0, 5)?.start).toBe(0);
  expect(trimAtPlayhead(edit, "end", 5, 5)?.end).toBe(5);
  for (const position of [1, 4, 5, NaN, -1])
    expect(trimAtPlayhead(edit, "start", position, 5)).toBeNull();
  for (const position of [0, 1, 4, 6, NaN])
    expect(trimAtPlayhead(edit, "end", position, 5)).toBeNull();
});

it("maps rotated pointer coordinates and fits the rotated composition without upscaling", () => {
  expect(unrotate({ x: 0.2, y: 0.7 }, 90)).toEqual({ x: 0.7, y: 0.8 });
  expect(imageSize(1600, 800, 90)).toEqual({ width: 360, height: 720 });
  expect(imageSize(100, 50, 0)).toEqual({ width: 100, height: 50 });
  expect(imageSize(200, 120, 45)).toEqual({ width: 226, height: 226 });
  expect(imageSize(1600, 800, -45)).toEqual({ width: 720, height: 720 });
  const point = unrotate({ x: 0.75, y: 0.5 }, 45, 200, 120);
  expect(point.x).toBeCloseTo(0.7);
  expect(point.y).toBeCloseTo(1 / 6);
  expect(imageChanged({ ...initialImageEdits(), rotation: 360 })).toBe(false);
  expect(imageSize(400, 240, 90, { x: 0.1, y: 0.2, width: 0.6, height: 0.6 })).toEqual({
    width: 144,
    height: 240,
  });
});

it("recognizes hash-only image sources and refuses animation/SVG flattening", () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(detectMediaMime(bytes, "image", "a".repeat(32))).toBe("image/png");
  for (const [mime, text] of [
    ["image/png", "PNG acTL"],
    ["image/webp", "RIFFWEBP ANIM"],
    ["image/gif", "GIF89a"],
    ["image/svg+xml", "<svg/>"],
  ])
    expect(isStillImage(new TextEncoder().encode(text), mime!)).toBe(false);
});

it("keeps accepted bytes and hashes unchanged when package compression is enabled", async () => {
  const file: MediaFile = {
    md5: "a".repeat(32),
    type: "image",
    name: "picture.png",
    bytes: new Uint8Array(10_000),
    preserveEncoding: true,
  };
  const parsed = {
    format: "oq" as const,
    content: toUpload({ ...emptyPackage("Edited"), logo: { md5: file.md5, type: "image" } }),
    files: new Map([[file.md5, file]]),
    warnings: [],
  };
  const result = await optimizePackage(parsed, vi.fn());
  expect(result.parsed).toBe(parsed);
  expect(result.parsed.files.get(file.md5)).toBe(file);
});

it("replaces one occurrence, collects the old durable copy, and restores it from session Undo", async () => {
  const old: MediaFile = {
    md5: "b".repeat(32),
    type: "image",
    name: "old.png",
    bytes: new Uint8Array([1]),
  };
  const next: MediaFile = {
    ...old,
    md5: "c".repeat(32),
    name: "new.webp",
    bytes: new Uint8Array([2]),
    preserveEncoding: true,
  };
  const q = newQuestion(100, {
    questionFiles: [
      { md5: old.md5, type: "image", displayTime: 1234, placement: "screen", waitForFinish: false },
    ],
  });
  const pkg = {
    ...emptyPackage("Media"),
    rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [q])] }],
  };
  const store = createPackageEditorStore({
    draftId: "media-edit-test",
    pkg,
    savedAt: null,
    media: new Map([[old.md5, old]]),
  });
  await saveDraft({ id: "media-edit-test", pkg, updatedAt: 1 }, [old]);
  store.getState().apply(
    (p) =>
      updateQuestion(p, q.id, {
        ...q,
        questionFiles: [{ ...q.questionFiles[0]!, md5: next.md5 }],
      }),
    { key: "questionSaved" },
    [next],
  );
  const saved = store.getState();
  await saveDraft({ id: "media-edit-test", pkg: saved.pkg, updatedAt: 2 }, saved.media.values());
  expect((await loadMedia([old.md5])).has(old.md5)).toBe(false);
  expect(saved.media.get(old.md5)).toBe(old);
  expect(saved.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles[0]).toMatchObject({
    displayTime: 1234,
    waitForFinish: false,
  });
  store.getState().undo();
  await saveDraft(
    { id: "media-edit-test", pkg: store.getState().pkg, updatedAt: 3 },
    store.getState().media.values(),
  );
  await collectMedia();
  expect((await loadMedia([old.md5])).get(old.md5)?.bytes).toEqual(old.bytes);
  store.getState().redo();
  expect(store.getState().media.get(next.md5)?.preserveEncoding).toBe(true);
});
