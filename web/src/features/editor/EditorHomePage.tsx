import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { ACCEPT, readPackageFile } from "@/features/upload/upload";
import type { ParsedPackage } from "@/features/upload/types";
import { timeAgo } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { BackIcon, PlusIcon, TrashIcon, UploadIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import { deleteDraft, listDrafts, putMedia, saveDraft, type DraftSummary } from "./drafts";
import { emptyPackage, fromUpload, newId, newRound, starterTheme } from "./model";

/** Turns an imported file into a draft and returns its id. */
export async function draftFromParsed(parsed: ParsedPackage): Promise<string> {
  const id = newId();
  await putMedia(parsed.files.values());
  await saveDraft({ id, pkg: fromUpload(parsed.content), updatedAt: Date.now() });
  return id;
}

export async function newDraft(
  title: string,
  roundName: string,
  themeName: string,
): Promise<string> {
  const id = newId();
  const pkg = emptyPackage(title);
  const round = newRound(roundName);
  round.themes = [starterTheme(themeName, 0)];
  pkg.rounds = [round];
  await saveDraft({ id, pkg, updatedAt: Date.now() });
  return id;
}

export function EditorHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listDrafts().then(setDrafts);
  }, []);

  const open = (draftId: string) =>
    void navigate({ to: "/packages/editor/$draftId", params: { draftId } });

  const create = async () => {
    setBusy("new");
    open(
      await newDraft(
        t("editor.defaults.title"),
        t("editor.defaults.round", { n: 1 }),
        t("editor.defaults.theme"),
      ),
    );
  };

  const importFile = async (file: File) => {
    setError(null);
    setBusy(file.name);
    try {
      open(await draftFromParsed(await readPackageFile(file)));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(t(`upload.readErrors.${code}`, { defaultValue: t("upload.readErrors.generic") }));
      setBusy(null);
    }
  };

  return (
    <PageContainer width={960}>
      <div className="flex flex-col gap-6">
        <Link
          to="/packages"
          className="inline-flex items-center gap-1.5 self-start text-muted no-underline hover:text-text"
        >
          <BackIcon size={18} />
          {t("upload.back")}
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("editor.home.title")}
          </h1>
          <p className="m-0 text-soft">{t("editor.home.lead")}</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="flex h-full flex-col gap-3">
              <p className="m-0 font-semibold">{t("editor.home.newTitle")}</p>
              <p className="m-0 flex-1 text-sm text-muted">{t("editor.home.newHelp")}</p>
              <Button
                variant="accent"
                size="lg"
                icon={<PlusIcon size={20} />}
                onClick={() => void create()}
                disabled={busy != null}
                data-testid="new-package"
              >
                {t("editor.home.new")}
              </Button>
            </div>
          </Card>
          <Card>
            <div className="flex h-full flex-col gap-3">
              <p className="m-0 font-semibold">{t("editor.home.importTitle")}</p>
              <p className="m-0 flex-1 text-sm text-muted">{t("editor.home.importHelp")}</p>
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                data-testid="import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importFile(f);
                }}
              />
              <Button
                size="lg"
                icon={<UploadIcon size={20} />}
                onClick={() => input.current?.click()}
                disabled={busy != null}
              >
                {t("editor.home.import")}
              </Button>
            </div>
          </Card>
        </div>
        {busy && busy !== "new" && <Spinner label={t("upload.reading", { name: busy })} />}
        {error && (
          <p role="alert" className="m-0 text-danger">
            {error}
          </p>
        )}

        <section className="flex flex-col gap-3" aria-labelledby="drafts-title">
          <h2 id="drafts-title" className="m-0 font-display text-2xl font-extrabold">
            {t("editor.home.drafts")}
          </h2>
          <p className="m-0 text-sm text-muted">{t("editor.home.draftsHelp")}</p>
          {drafts == null ? (
            <Spinner label={t("common.loading")} />
          ) : drafts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
              {t("editor.home.noDrafts")}
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="drafts">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border border-line bg-surface p-2 pl-4"
                >
                  <Link
                    to="/packages/editor/$draftId"
                    params={{ draftId: d.id }}
                    className="flex min-h-12 min-w-0 flex-1 flex-col justify-center text-text no-underline hover:text-text"
                  >
                    <span className="truncate font-semibold">
                      {d.title || t("editor.outline.untitled")}
                    </span>
                    <span className="text-sm text-muted">
                      {t("editor.home.draftMeta", {
                        rounds: d.rounds,
                        questions: d.questions,
                        when: timeAgo(new Date(d.updatedAt).toISOString()),
                      })}
                      {d.publishedId != null && ` · ${t("editor.home.published")}`}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={t("editor.home.deleteDraft", { title: d.title })}
                    onClick={() => {
                      if (!window.confirm(t("editor.home.deleteConfirm", { title: d.title })))
                        return;
                      void deleteDraft(d.id).then(() => listDrafts().then(setDrafts));
                    }}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-danger-surface hover:text-danger"
                  >
                    <TrashIcon size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
