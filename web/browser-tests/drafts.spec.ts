import { expect, test, type Page } from "@playwright/test";
import type * as Drafts from "../src/features/package-editor/draftStorage";
import type * as CreateDraft from "../src/features/package-editor/createDraft";
import type * as Model from "../src/features/package-editor/packageDraft";

declare global {
  interface Window {
    storageGate?: { reached: boolean; release?: () => void };
    storageTask?: Promise<string | void>;
  }
}

const md5 = "5289df737df57326fcdd22597afb1fac";

/** Pause app continuation after a real transaction commits, never its DB lock. */
async function gateCompletion(page: Page, scope: "media" | "drafts") {
  await page.evaluate((scope) => {
    const original = IDBDatabase.prototype.transaction;
    window.storageGate = { reached: false };
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const tx = original.call(
        this,
        typeof stores === "string" ? stores : [...stores],
        mode,
        options,
      );
      if (tx.objectStoreNames.contains(scope) && (scope !== "media" || tx.mode === "readwrite")) {
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => {
          const complete = tx.oncomplete;
          tx.oncomplete = (event) => {
            window.storageGate!.reached = true;
            window.storageGate!.release = () => complete?.call(tx, event);
          };
        });
      }
      return tx;
    };
  }, scope);
}

async function startImport(page: Page) {
  await page.evaluate(async (md5) => {
    const path = "/src/features/package-editor/createDraft.ts";
    const { draftFromParsed } = (await import(path)) as typeof CreateDraft;
    window.storageTask = draftFromParsed({
      format: "oq",
      content: {
        title: "Atomic draft",
        ageRestriction: "NONE",
        tags: [],
        rounds: [],
        logo: { file: { md5, type: "image" } },
      },
      files: new Map([
        [md5, { md5, type: "image", name: "picture.png", bytes: new Uint8Array([1, 2, 3]) }],
      ]),
      warnings: [],
    });
  }, md5);
}

async function startCleanup(page: Page) {
  await page.evaluate(async () => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { collectMedia } = (await import(path)) as typeof Drafts;
    window.storageTask = collectMedia();
  });
}

test.beforeEach(async ({ context }) => {
  // The app shell's auth request is unrelated to these local storage tests.
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
});

test("cleanup in another tab cannot delete media while import completes", async ({
  page,
  context,
}) => {
  const cleanup = await context.newPage();
  await Promise.all([page.goto("/"), cleanup.goto("/")]);
  await gateCompletion(page, "media");
  await startImport(page);
  await expect.poll(() => page.evaluate(() => window.storageGate?.reached)).toBe(true);
  await startCleanup(cleanup);
  await cleanup.evaluate(() => window.storageTask);
  const id = await page.evaluate(async () => {
    window.storageGate!.release!();
    return window.storageTask;
  });
  const saved = await cleanup.evaluate(
    async ({ id, md5 }) => {
      const path = "/src/features/package-editor/draftStorage.ts";
      const { loadDraft, loadMedia } = (await import(path)) as typeof Drafts;
      return {
        draft: await loadDraft(id as string),
        bytes: [...((await loadMedia([md5])).get(md5)?.bytes ?? [])],
      };
    },
    { id, md5 },
  );
  expect(saved.draft?.pkg.logo?.md5).toBe(md5);
  expect(saved.bytes).toEqual([1, 2, 3]);
});

test("cleanup cannot use an old draft snapshot to delete a newly saved file", async ({
  page,
  context,
}) => {
  const cleanup = await context.newPage();
  await Promise.all([page.goto("/"), cleanup.goto("/")]);
  await gateCompletion(cleanup, "drafts");
  await startCleanup(cleanup);
  await expect.poll(() => cleanup.evaluate(() => window.storageGate?.reached)).toBe(true);
  await startImport(page);
  await page.evaluate(() => window.storageTask);
  await cleanup.evaluate(async () => {
    window.storageGate!.release!();
    await window.storageTask;
  });
  const bytes = await page.evaluate(async (md5) => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { loadMedia } = (await import(path)) as typeof Drafts;
    return [...((await loadMedia([md5])).get(md5)?.bytes ?? [])];
  }, md5);
  expect(bytes).toEqual([1, 2, 3]);
});

test("a failed media write rolls back the draft and earlier queued media", async ({ page }) => {
  await page.goto("/");
  await startImport(page);
  const result = await page.evaluate(async (md5) => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { loadDraft, loadMedia, saveDraft } = (await import(path)) as typeof Drafts;
    const modelPath = "/src/features/package-editor/packageDraft.ts";
    const { newQuestion } = (await import(modelPath)) as typeof Model;
    const id = (await window.storageTask) as string;
    const original = (await loadDraft(id))!;
    const badHash = "bad-file";
    const updated = {
      ...original,
      pkg: {
        ...original.pkg,
        title: "Must not commit",
        rounds: [
          {
            id: "round",
            name: "Round",
            description: "",
            type: "simple" as const,
            themes: [
              {
                id: "theme",
                name: "Theme",
                description: "",
                questions: [
                  newQuestion(100, {
                    questionFiles: [{ md5, type: "image", displayTime: null }],
                  }),
                ],
              },
            ],
          },
        ],
        logo: { md5: badHash, type: "image" as const },
      },
    };
    // Queue a valid draft and media overwrite before put() throws DataCloneError.
    const badFile = {
      md5: badHash,
      type: "image" as const,
      name: "bad.png",
      bytes: new Uint8Array([9]),
      cannotClone: () => {},
    };
    let failure = "";
    try {
      await saveDraft(updated, [
        { md5, type: "image", name: "picture.png", bytes: new Uint8Array([8]) },
        badFile,
      ]);
    } catch (error) {
      failure = (error as Error).name;
    }
    return {
      failure,
      draft: await loadDraft(id),
      original,
      oldBytes: [...(await loadMedia([md5])).get(md5)!.bytes],
      partialMedia: (await loadMedia([badHash])).size,
    };
  }, md5);
  expect(result.failure).toBe("DataCloneError");
  expect(result.draft).toEqual(result.original);
  expect(result.oldBytes).toEqual([1, 2, 3]);
  expect(result.partialMedia).toBe(0);
});

test("collection preserves shared files and a later save restores collected undo media", async ({
  page,
}) => {
  await page.goto("/");
  await startImport(page);
  const result = await page.evaluate(async (md5) => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { loadDraft, loadMedia, saveDraft, deleteDraft, collectMedia } = (await import(
      path
    )) as typeof Drafts;
    const first = (await window.storageTask) as string;
    const original = (await loadDraft(first))!;
    const file = (await loadMedia([md5])).get(md5)!;
    const second = { ...original, id: "second" };
    await saveDraft(second, [file]);
    await deleteDraft(first);
    const sharedBytes = [...(await loadMedia([md5])).get(md5)!.bytes];
    await saveDraft({ ...second, pkg: { ...second.pkg, logo: null } });
    await collectMedia();
    const afterRemoval = (await loadMedia([md5])).size;
    // Undo restores an existing in-memory file after its last saved reference vanished.
    await saveDraft(second, [file]);
    const restoredBytes = [...(await loadMedia([md5])).get(md5)!.bytes];
    await deleteDraft(second.id);
    return { sharedBytes, afterRemoval, restoredBytes, afterDelete: (await loadMedia([md5])).size };
  }, md5);
  expect(result.sharedBytes).toEqual([1, 2, 3]);
  expect(result.afterRemoval).toBe(0);
  expect(result.restoredBytes).toEqual([1, 2, 3]);
  expect(result.afterDelete).toBe(0);
});
