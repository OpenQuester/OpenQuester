import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  Download,
  Eye,
  FileUp,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../shared/api/client";
import { SelectField } from "../../shared/ui/SelectField";
import ui from "../../shared/ui/ui.module.css";
import styles from "./editor.module.css";
import {
  type EditorMedia,
  type EditorPackage,
  type EditorQuestion,
  type EditorRound,
  type EditorTheme,
  useEditorStore,
} from "./editorStore";

export function EditorPage() {
  const { packageId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useEditorStore();
  const replaceDocument = useEditorStore((state) => state.replace);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const packageQuery = useQuery({
    queryKey: ["package", packageId, "editor"],
    queryFn: () => api.package<EditorPackage>(packageId!),
    enabled: Boolean(packageId),
    retry: false,
  });
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      store.setSaving(true, 15);
      const content = { ...toApiDocument(store.document), status: "draft" };
      const response = packageId
        ? await api.updatePackage<{
            id?: number;
            uploadLinks?: Record<string, string>;
          }>(packageId, { content })
        : await api.createPackage<{
            id?: number;
            uploadLinks?: Record<string, string>;
          }>({ content });
      store.setSaving(true, 85);
      await uploadReferencedMedia(
        store.document,
        response.uploadLinks ?? {},
        (progress) => store.setSaving(true, 85 + progress * 0.14),
      );
      if (publish && (response as { id?: number }).id)
        await api.publishPackage((response as { id: number }).id);
      return response;
    },
    onSuccess: (response, publish) => {
      store.markSaved(publish ? "published" : "draft");
      const id = (response as { id?: number }).id;
      if (!packageId && id) void navigate(`/editor/${id}`, { replace: true });
    },
    onError: () => store.setSaving(false),
  });
  useEffect(() => {
    if (packageQuery.data)
      replaceDocument(normalizeDocument(packageQuery.data));
  }, [packageQuery.data, replaceDocument]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (store.dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [store.dirty]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save.mutate(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, store]);
  const critical = store.issues.filter(
    (issue) => issue.severity === "critical",
  );
  const currentRound =
    store.document.rounds.find((item) => item.id === store.selection.roundId) ??
    store.document.rounds[0];
  const onDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : "";
    if (active.startsWith("theme:") && over.startsWith("round:"))
      store.moveTheme(active.slice(6), over.slice(6));
    if (active.startsWith("question:")) {
      const questionId = active.slice(9);
      if (over.startsWith("round:"))
        store.moveQuestion(questionId, over.slice(6));
      if (over.startsWith("theme-target:")) {
        const [, roundId, themeId] = over.split(":");
        if (roundId && themeId)
          store.moveQuestion(questionId, roundId, themeId);
      }
      if (over.startsWith("question-target:")) {
        const [, roundId, themeId, beforeQuestionId] = over.split(":");
        if (roundId && themeId && beforeQuestionId)
          store.moveQuestion(questionId, roundId, themeId, beforeQuestionId);
      }
    }
  };
  const exportArchive = async () => {
    setArchiveError(null);
    store.setSaving(true, 5);
    let exportDocument: EditorPackage;
    try {
      exportDocument = await hydrateExportMedia(store.document, (progress) =>
        store.setSaving(true, 5 + progress * 0.35),
      );
    } catch {
      store.setSaving(false);
      setArchiveError(t("editor.exportMediaFailed"));
      return;
    }
    runWorker({ type: "export", document: exportDocument }, (message) => {
      if (message.type === "progress")
        store.setSaving(true, 40 + Number(message.progress) * 0.6);
      if (message.type === "exported") {
        const url = URL.createObjectURL(
          new Blob([message.buffer as ArrayBuffer], {
            type: "application/zip",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${store.document.title || "package"}.oq`;
        link.click();
        URL.revokeObjectURL(url);
        store.setSaving(false);
      }
      if (message.type === "error") setArchiveError(String(message.message));
    });
  };
  const importArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    runWorker(
      { type: "import", buffer: await file.arrayBuffer(), filename: file.name },
      (message) => {
        if (message.type === "imported") {
          store.replace(normalizeDocument(message.document as EditorPackage));
          if (Array.isArray(message.warnings) && message.warnings.length)
            setArchiveError(message.warnings.join("\n"));
        }
        if (message.type === "error") setArchiveError(String(message.message));
      },
    );
    event.target.value = "";
  };
  return (
    <div className={styles.editor}>
      {store.progress !== null ? (
        <div className={styles.progress}>
          <span
            style={
              { "--progress": `${store.progress}%` } as React.CSSProperties
            }
          />
        </div>
      ) : null}
      <header className={styles.topbar}>
        <button
          className={ui.iconButton}
          onClick={() => void navigate("/packages")}
          aria-label={t("nav.back")}
        >
          ←
        </button>
        <input
          className={styles.titleInput}
          value={store.document.title}
          onChange={(e) => store.updatePackage({ title: e.target.value })}
          placeholder={t("editor.untitled")}
        />
        <span className={styles.saveState}>
          {store.dirty ? t("editor.unsaved") : t("editor.saved")}
        </span>
        <div className={styles.topActions}>
          <button
            className={ui.iconButton}
            onClick={store.undo}
            disabled={!store.undoStack.length}
            title={t("editor.undo")}
          >
            <Undo2 size={15} />
          </button>
          <button
            className={ui.iconButton}
            onClick={store.redo}
            disabled={!store.redoStack.length}
            title={t("editor.redo")}
          >
            <Redo2 size={15} />
          </button>
          <button
            className={ui.secondaryButton}
            onClick={() => importRef.current?.click()}
          >
            <FileUp size={15} />
            <span>{t("editor.import")}</span>
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".oq,.siq"
            hidden
            onChange={(event) => void importArchive(event)}
          />
          <button
            className={ui.secondaryButton}
            onClick={() => void exportArchive()}
          >
            <Download size={15} />
            <span>{t("editor.export")}</span>
          </button>
          <button
            className={ui.secondaryButton}
            onClick={() => save.mutate(false)}
            disabled={save.isPending}
          >
            <Save size={15} />
            <span>{t("editor.saveDraft")}</span>
          </button>
          <button
            className={ui.primaryButton}
            onClick={() => save.mutate(true)}
            disabled={Boolean(critical.length) || save.isPending}
          >
            <Upload size={15} />
            <span>{t("editor.publish")}</span>
          </button>
        </div>
      </header>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className={styles.body}>
          <PackageTree />
          <main className={styles.workspace}>
            <div className={styles.roundTabs}>
              {store.document.rounds.map((round) => (
                <DroppableRoundTab
                  active={round.id === currentRound?.id}
                  key={round.id}
                  round={round}
                />
              ))}
              <button className={styles.roundTab} onClick={store.addRound}>
                <Plus size={14} /> {t("editor.addRound")}
              </button>
            </div>
            {currentRound ? (
              <RoundBoard round={currentRound} />
            ) : (
              <div className={ui.empty}>{t("editor.addRound")}</div>
            )}
          </main>
          <Inspector archiveError={archiveError} />
        </div>
      </DndContext>
    </div>
  );
}

function PackageTree() {
  const { t } = useTranslation();
  const store = useEditorStore();
  const [search, setSearch] = useState("");
  return (
    <aside className={styles.tree}>
      <div className={styles.treeHeader}>
        <strong>{t("editor.package")}</strong>
        <button className={ui.iconButton} onClick={store.addRound}>
          <Plus size={13} />
        </button>
      </div>
      <input
        className={ui.field}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("editor.search")}
      />
      {store.document.rounds.map((round) => (
        <div key={round.id}>
          <button
            className={styles.treeItem}
            data-active={
              store.selection.roundId === round.id && !store.selection.themeId
            }
            onClick={() => store.select({ roundId: round.id })}
          >
            {round.name}
          </button>
          {round.themes
            .filter((item) =>
              item.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((theme) => (
              <div key={theme.id}>
                <DraggableTheme round={round} theme={theme} />
                {theme.questions.map((question) => (
                  <button
                    className={styles.treeItem}
                    data-depth="2"
                    data-active={store.selection.questionId === question.id}
                    key={question.id}
                    onClick={(event) =>
                      store.select(
                        {
                          roundId: round.id,
                          themeId: theme.id,
                          questionId: question.id,
                        },
                        event.shiftKey,
                      )
                    }
                  >
                    {question.price ?? "?"} ·{" "}
                    {question.text || t("editor.question")}
                  </button>
                ))}
              </div>
            ))}
        </div>
      ))}
    </aside>
  );
}

function DroppableRoundTab({
  round,
  active,
}: {
  round: EditorRound;
  active: boolean;
}) {
  const store = useEditorStore();
  const { setNodeRef, isOver } = useDroppable({ id: `round:${round.id}` });
  return (
    <button
      ref={setNodeRef}
      className={styles.roundTab}
      data-active={active}
      data-drop-target={isOver}
      onClick={() => store.select({ roundId: round.id })}
    >
      {round.name}
    </button>
  );
}

function DraggableTheme({
  round,
  theme,
}: {
  round: EditorRound;
  theme: EditorTheme;
}) {
  const store = useEditorStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `theme:${theme.id}` });
  return (
    <button
      ref={setNodeRef}
      className={styles.treeItem}
      data-depth="1"
      data-active={
        store.selection.themeId === theme.id && !store.selection.questionId
      }
      data-dragging={isDragging}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            }
          : undefined
      }
      onClick={() => store.select({ roundId: round.id, themeId: theme.id })}
      {...listeners}
      {...attributes}
    >
      {theme.name}
    </button>
  );
}

function RoundBoard({ round }: { round: EditorRound }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  return (
    <div className={styles.canvas}>
      <div className={styles.canvasHeader}>
        <h2>{round.name}</h2>
        <button
          className={ui.secondaryButton}
          onClick={() => store.addTheme(round.id)}
        >
          <Plus size={15} />
          {t("editor.addTheme")}
        </button>
      </div>
      <div className={styles.board}>
        {round.themes.map((theme) => (
          <DroppableThemeRow key={theme.id} round={round} theme={theme} />
        ))}
      </div>
    </div>
  );
}

function DroppableThemeRow({
  round,
  theme,
}: {
  round: EditorRound;
  theme: EditorTheme;
}) {
  const store = useEditorStore();
  const { setNodeRef, isOver } = useDroppable({
    id: `theme-target:${round.id}:${theme.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.row}
      data-drop-target={isOver}
      style={{ "--count": theme.questions.length } as React.CSSProperties}
    >
      <button
        className={styles.themeName}
        data-active={
          store.selection.themeId === theme.id && !store.selection.questionId
        }
        onClick={() => store.select({ roundId: round.id, themeId: theme.id })}
      >
        {theme.name}
      </button>
      {theme.questions.map((question) => (
        <DraggableQuestionCell
          key={question.id}
          question={question}
          round={round}
          theme={theme}
        />
      ))}
    </div>
  );
}

function DraggableQuestionCell({
  round,
  theme,
  question,
}: {
  round: EditorRound;
  theme: EditorTheme;
  question: EditorQuestion;
}) {
  const store = useEditorStore();
  const { t } = useTranslation();
  const draggable = useDraggable({ id: `question:${question.id}` });
  const droppable = useDroppable({
    id: `question-target:${round.id}:${theme.id}:${question.id}`,
  });
  return (
    <button
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      className={styles.questionCell}
      data-active={store.selection.questionId === question.id}
      data-dragging={draggable.isDragging}
      data-drop-target={droppable.isOver}
      style={
        draggable.transform
          ? {
              transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`,
            }
          : undefined
      }
      onClick={(event) =>
        store.select(
          {
            roundId: round.id,
            themeId: theme.id,
            questionId: question.id,
          },
          event.shiftKey,
        )
      }
      {...draggable.listeners}
      {...draggable.attributes}
    >
      <span>{question.price ?? "?"}</span>
      <small>{t(questionTypeKey(question.type))}</small>
    </button>
  );
}

function questionTypeKey(type: EditorQuestion["type"]): string {
  return {
    simple: "editor.simple",
    choice: "editor.choice",
    "no-risk": "editor.noRisk",
    stake: "editor.stake",
    secret: "editor.secret",
    hidden: "editor.hidden",
  }[type];
}

function Inspector({ archiveError }: { archiveError: string | null }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const round = store.document.rounds.find(
    (r) => r.id === store.selection.roundId,
  );
  const theme = round?.themes.find(
    (item) => item.id === store.selection.themeId,
  );
  const question = theme?.questions.find(
    (item) => item.id === store.selection.questionId,
  );
  return (
    <aside className={styles.inspector}>
      {question && round && theme ? (
        <QuestionInspector round={round} theme={theme} question={question} />
      ) : theme && round ? (
        <ThemeInspector round={round} theme={theme} />
      ) : round ? (
        <RoundInspector round={round} />
      ) : (
        <PackageInspector />
      )}
      <div className={styles.health}>
        <div className={styles.healthHeader}>
          <h3>
            <AlertTriangle size={14} /> {t("editor.health")}
          </h3>
          <span className={ui.badge}>{store.issues.length}</span>
        </div>
        {store.issues.slice(0, 8).map((issue) => (
          <button
            className={styles.issue}
            data-severity={issue.severity}
            key={issue.id}
            onClick={() => issue.selection && store.select(issue.selection)}
          >
            <span className={styles.issueDot} />
            <span>{t(issue.messageKey)}</span>
          </button>
        ))}
        {store.issues.length ? (
          <button
            className={ui.secondaryButton}
            onClick={() => {
              const currentIndex = store.issues.findIndex(
                (issue) =>
                  issue.selection?.roundId === store.selection.roundId &&
                  issue.selection?.themeId === store.selection.themeId &&
                  issue.selection?.questionId === store.selection.questionId,
              );
              const next =
                store.issues[(currentIndex + 1) % store.issues.length];
              if (next?.selection) store.select(next.selection);
            }}
          >
            {t("editor.nextProblem")}
          </button>
        ) : null}
        {archiveError ? <p className={ui.errorText}>{archiveError}</p> : null}
        {store.issues.some((i) => i.severity === "critical") ? (
          <p className={ui.errorText}>{t("editor.publishBlocked")}</p>
        ) : null}
      </div>
    </aside>
  );
}

function PackageInspector() {
  const { t } = useTranslation();
  const store = useEditorStore();
  return (
    <div>
      <h2>{t("editor.package")}</h2>
      <div className={ui.stack}>
        <label>
          <span>{t("game.title")}</span>
          <input
            value={store.document.title}
            onChange={(e) => store.updatePackage({ title: e.target.value })}
          />
        </label>
        <label>
          <span>{t("common.description")}</span>
          <textarea
            value={store.document.description}
            onChange={(e) =>
              store.updatePackage({ description: e.target.value })
            }
          />
        </label>
        <label>
          <span>{t("settings.language")}</span>
          <SelectField
            value={store.document.language}
            ariaLabel={t("settings.language")}
            onValueChange={(value) => store.updatePackage({ language: value })}
            options={[
              { value: "en", label: t("language.en") },
              { value: "uk", label: t("language.uk") },
              { value: "ru", label: t("language.ru") },
            ]}
          />
        </label>
      </div>
    </div>
  );
}
function RoundInspector({ round }: { round: EditorRound }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  return (
    <div>
      <h2>{t("editor.round")}</h2>
      <div className={ui.stack}>
        <label>
          <span>{t("game.title")}</span>
          <input
            value={round.name}
            onChange={(e) =>
              store.updateRound(round.id, { name: e.target.value })
            }
          />
        </label>
        <label>
          <span>{t("editor.type")}</span>
          <SelectField
            value={round.type}
            ariaLabel={t("editor.type")}
            onValueChange={(value) =>
              store.updateRound(round.id, {
                type: value as EditorRound["type"],
              })
            }
            options={[
              { value: "standard", label: t("common.standard") },
              { value: "final", label: t("common.final") },
            ]}
          />
        </label>
        <InspectorActions />
      </div>
    </div>
  );
}
function ThemeInspector({
  round,
  theme,
}: {
  round: EditorRound;
  theme: EditorTheme;
}) {
  const { t } = useTranslation();
  const store = useEditorStore();
  return (
    <div>
      <h2>{t("editor.theme")}</h2>
      <div className={ui.stack}>
        <label>
          <span>{t("game.title")}</span>
          <input
            value={theme.name}
            onChange={(e) =>
              store.updateTheme(round.id, theme.id, { name: e.target.value })
            }
          />
        </label>
        <label>
          <span>{t("common.description")}</span>
          <textarea
            value={theme.description}
            onChange={(e) =>
              store.updateTheme(round.id, theme.id, {
                description: e.target.value,
              })
            }
          />
        </label>
        <button
          className={ui.secondaryButton}
          onClick={() => store.addQuestion(round.id, theme.id)}
        >
          <Plus size={14} />
          {t("editor.addQuestion")}
        </button>
        <InspectorActions />
      </div>
    </div>
  );
}
function QuestionInspector({
  round,
  theme,
  question,
}: {
  round: EditorRound;
  theme: EditorTheme;
  question: EditorQuestion;
}) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const addMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const media = await Promise.all(
      files.map(async (file): Promise<EditorMedia> => {
        const id = crypto.randomUUID();
        const buffer = await file.arrayBuffer();
        const hash = await hashBuffer(id, buffer);
        return {
          id,
          hash,
          name: file.name,
          size: file.size,
          type: file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("audio/")
              ? "audio"
              : "video",
          url: URL.createObjectURL(file),
          file,
        };
      }),
    );
    store.updateQuestion(round.id, theme.id, question.id, {
      media: [...question.media, ...media],
    });
  };
  return (
    <div>
      <h2>{t("editor.question")}</h2>
      <div className={ui.stack}>
        <label>
          <span>{t("editor.type")}</span>
          <SelectField
            value={question.type}
            ariaLabel={t("editor.type")}
            onValueChange={(value) =>
              store.updateQuestion(round.id, theme.id, question.id, {
                type: value as EditorQuestion["type"],
              })
            }
            options={[
              { value: "simple", label: t("editor.simple") },
              { value: "choice", label: t("editor.choice") },
              { value: "no-risk", label: t("editor.noRisk") },
              { value: "stake", label: t("editor.stake") },
              { value: "secret", label: t("editor.secret") },
              { value: "hidden", label: t("editor.hidden") },
            ]}
          />
        </label>
        <label>
          <span>{t("editor.price")}</span>
          <input
            type="number"
            value={question.price ?? ""}
            onChange={(e) =>
              store.updateQuestion(round.id, theme.id, question.id, {
                price: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label>
          <span>{t("editor.content")}</span>
          <textarea
            value={question.text}
            onChange={(e) =>
              store.updateQuestion(round.id, theme.id, question.id, {
                text: e.target.value,
              })
            }
          />
        </label>
        <label>
          <span>{t("editor.answer")}</span>
          <input
            value={question.answer}
            onChange={(e) =>
              store.updateQuestion(round.id, theme.id, question.id, {
                answer: e.target.value,
              })
            }
          />
        </label>
        {question.type === "choice" ? (
          <div className={styles.choiceList}>
            <span>{t("editor.choices")}</span>
            {question.choices.map((choice, index) => (
              <div key={index}>
                <input
                  value={choice}
                  aria-label={t("editor.choiceNumber", { count: index + 1 })}
                  onChange={(event) => {
                    const choices = [...question.choices];
                    choices[index] = event.target.value;
                    store.updateQuestion(round.id, theme.id, question.id, {
                      choices,
                    });
                  }}
                />
                <button
                  className={ui.iconButton}
                  aria-label={t("common.remove")}
                  onClick={() =>
                    store.updateQuestion(round.id, theme.id, question.id, {
                      choices: question.choices.filter(
                        (_, item) => item !== index,
                      ),
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              className={ui.secondaryButton}
              disabled={question.choices.length >= 8}
              onClick={() =>
                store.updateQuestion(round.id, theme.id, question.id, {
                  choices: [...question.choices, ""],
                })
              }
            >
              <Plus size={13} /> {t("editor.addChoice")}
            </button>
          </div>
        ) : null}
        <button
          className={styles.mediaDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Eye size={18} />
          {t("editor.addMedia")}
          <input
            ref={inputRef}
            hidden
            type="file"
            accept="image/*,audio/*,video/*"
            multiple
            onChange={(event) => void addMedia(event)}
          />
        </button>
        <div className={styles.mediaList}>
          {question.media.map((item) => (
            <div className={styles.mediaItem} key={item.id}>
              {item.url && item.type === "image" ? (
                <img src={item.url} alt="" />
              ) : null}
              {item.url && item.type === "audio" ? (
                <audio src={item.url} controls preload="metadata" />
              ) : null}
              {item.url && item.type === "video" ? (
                <video src={item.url} controls preload="metadata" />
              ) : null}
              <span>{item.name}</span>
              <span>{Math.ceil(item.size / 1024)} KB</span>
              <button
                className={ui.iconButton}
                aria-label={t("editor.removeMedia")}
                onClick={() => {
                  if (item.url) URL.revokeObjectURL(item.url);
                  store.updateQuestion(round.id, theme.id, question.id, {
                    media: question.media.filter(
                      (media) => media.id !== item.id,
                    ),
                  });
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <InspectorActions />
      </div>
    </div>
  );
}
function InspectorActions() {
  const store = useEditorStore();
  return (
    <div className={ui.toolbar}>
      <button className={ui.secondaryButton} onClick={store.duplicateSelection}>
        <Copy size={14} />
      </button>
      <button className={ui.dangerButton} onClick={store.removeSelection}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function runWorker(
  data: Record<string, unknown>,
  onMessage: (message: Record<string, unknown>) => void,
) {
  const worker = new Worker(new URL("./archive.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
    onMessage(event.data);
    if (
      ["exported", "imported", "hashed", "error"].includes(
        String(event.data.type),
      )
    )
      worker.terminate();
  };
  if (data.buffer instanceof ArrayBuffer)
    worker.postMessage(data, [data.buffer]);
  else worker.postMessage(data);
}
function normalizeDocument(document: EditorPackage): EditorPackage {
  return {
    ...document,
    status: document.status ?? "draft",
    ageRestriction: document.ageRestriction ?? "NONE",
    rounds: (document.rounds ?? []).map((r, ri) => ({
      ...r,
      id: String(r.id || crypto.randomUUID()),
      order: ri,
      type: r.type === "final" ? "final" : "standard",
      themes: (r.themes ?? []).map((t, ti) => ({
        ...t,
        id: String(t.id || crypto.randomUUID()),
        order: ti,
        questions: (t.questions ?? []).map((q, qi) => {
          const apiQuestion = q as EditorQuestion & {
            isHidden?: boolean;
            answers?: Array<{ text?: string | null }>;
            questionFiles?: Array<{
              id?: number | null;
              file: {
                md5: string;
                type: EditorMedia["type"];
                link?: string | null;
              };
            }> | null;
          };
          const sourceMedia =
            q.media ??
            apiQuestion.questionFiles?.map((item) => ({
              id: String(item.id ?? crypto.randomUUID()),
              hash: item.file.md5,
              type: item.file.type,
              name: item.file.md5,
              size: 0,
              url: item.file.link ?? undefined,
            })) ??
            [];
          return {
            ...q,
            id: String(q.id || crypto.randomUUID()),
            order: qi,
            type: apiQuestion.isHidden
              ? "hidden"
              : (q.type as string) === "noRisk"
                ? "no-risk"
                : q.type,
            choices:
              q.choices ??
              apiQuestion.answers?.map((item) => item.text ?? "") ??
              [],
            media: sourceMedia.map((media) => {
              const data = media.data;
              const mime =
                media.type === "image"
                  ? "image/*"
                  : media.type === "audio"
                    ? "audio/*"
                    : "video/*";
              const blob = data ? new Blob([data], { type: mime }) : undefined;
              return {
                ...media,
                file:
                  media.file ??
                  (blob
                    ? new File([blob], media.name || media.hash || "media", {
                        type: mime,
                      })
                    : undefined),
                url:
                  media.url ?? (blob ? URL.createObjectURL(blob) : undefined),
              };
            }),
            text: q.text ?? "",
            answer:
              q.answer ??
              (q as EditorQuestion & { answerText?: string }).answerText ??
              "",
          };
        }),
      })),
    })),
  };
}

function toApiDocument(document: EditorPackage) {
  return {
    title: document.title,
    description: document.description || null,
    language: document.language,
    ageRestriction: document.ageRestriction,
    status: document.status,
    logo: null,
    tags: [],
    rounds: document.rounds.map((round) => ({
      name: round.name,
      description: round.description || null,
      order: round.order,
      type: round.type === "final" ? "final" : "simple",
      themes: round.themes.map((theme) => ({
        name: theme.name,
        description: theme.description || null,
        order: theme.order,
        questions: theme.questions.map((question) => ({
          price: round.type === "final" ? null : question.price,
          order: question.order,
          type: question.type === "no-risk" ? "noRisk" : question.type,
          isHidden: question.type === "hidden",
          text: question.text || null,
          answerText: question.answer || null,
          answerHint: null,
          answerDelay: 5000,
          showAnswerDuration: 5000,
          questionComment: null,
          questionFiles: question.media
            .filter((media) => media.hash)
            .map((media, order) => ({
              file: { md5: media.hash, type: media.type },
              displayTime: media.type === "video" ? 20000 : 15000,
              order,
            })),
          answerFiles: null,
          ...(question.type === "stake"
            ? { subType: "simple", maxPrice: null }
            : {}),
          ...(question.type === "secret"
            ? { subType: "simple", transferType: "any", allowedPrices: null }
            : {}),
          ...(question.type === "no-risk"
            ? { subType: "simple", priceMultiplier: 2 }
            : {}),
          ...(question.type === "choice"
            ? {
                subType: "simple",
                showDelay: 3000,
                answers: (question.choices.length
                  ? question.choices
                  : [question.answer, question.answer]
                ).map((text, order) => ({ text, order, file: null })),
              }
            : {}),
        })),
      })),
    })),
  };
}

function hashBuffer(id: string, buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    runWorker({ type: "hash", id, buffer }, (message) => {
      if (message.type === "hashed") resolve(String(message.hash));
      if (message.type === "error") reject(new Error(String(message.message)));
    });
  });
}

async function uploadReferencedMedia(
  document: EditorPackage,
  links: Record<string, string>,
  onProgress: (progress: number) => void,
) {
  const media = document.rounds
    .flatMap((round) =>
      round.themes.flatMap((theme) =>
        theme.questions.flatMap((question) => question.media),
      ),
    )
    .filter((item) => item.hash && item.file && links[item.hash]);
  let complete = 0;
  for (const item of media) {
    await uploadWithRetry(links[item.hash!]!, item.file!, (fraction) =>
      onProgress((complete + fraction) / media.length),
    );
    complete += 1;
  }
  onProgress(1);
}

async function hydrateExportMedia(
  document: EditorPackage,
  onProgress: (progress: number) => void,
): Promise<EditorPackage> {
  const copy = structuredClone(document);
  const media = copy.rounds.flatMap((round) =>
    round.themes.flatMap((theme) =>
      theme.questions.flatMap((question) => question.media),
    ),
  );
  for (const [index, item] of media.entries()) {
    if (!item.file && !item.data && item.url) {
      const response = await fetch(item.url, { credentials: "include" });
      if (!response.ok) throw new Error("media_fetch_failed");
      item.data = await response.arrayBuffer();
      item.size = item.data.byteLength;
    }
    onProgress((index + 1) / Math.max(media.length, 1));
  }
  if (media.length === 0) onProgress(1);
  return copy;
}

async function uploadWithRetry(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url);
        request.upload.onprogress = (event) =>
          event.lengthComputable && onProgress(event.loaded / event.total);
        request.onload = () =>
          request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${request.status})`));
        request.onerror = () => reject(new Error("Upload connection failed"));
        request.send(file);
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upload failed");
    }
  }
  throw lastError ?? new Error("Upload failed");
}
