import { detectMediaMime } from "@/features/upload/archive";
import type { MediaFile } from "@/features/upload/types";
import type { GameJoinData, Player, Question, QuestionFile, Round } from "@/game/protocol";
import { sessionFromSnapshot } from "@/game/reducer";
import { serverNow } from "@/lib/clock";
import { toUploadQuestion, type DraftQuestion } from "../packageDraft";

export const PREVIEW_SHOWMAN = 1;
export const PREVIEW_PLAYERS = [2, 3, 4] as const;
export const PREVIEW_SPECTATORS = [5, 6] as const;
export const PREVIEW_QUESTION = 100;
export const PREVIEW_FINAL_THEME = 12;

/** Server score limits, applied only to local simulated results. */
export const clampPreviewScore = (value: number) =>
  Math.max(-2_100_000_000, Math.min(2_100_000_000, value));

/** URLs belong only to this launch and never enter editor storage. */
export function previewMedia(files: Map<string, MediaFile>) {
  const owned: string[] = [];
  const links = new Map<string, string>();
  for (const [key, file] of files) {
    if (file.bytes.byteLength) {
      const url = URL.createObjectURL(
        new Blob([file.bytes as BlobPart], {
          type: detectMediaMime(file.bytes, file.type, file.name),
        }),
      );
      owned.push(url);
      links.set(key, url);
    } else if (file.url) links.set(key, file.url);
  }
  return { links, dispose: () => owned.forEach((url) => URL.revokeObjectURL(url)) };
}

/** Uses the same serialization as publishing, with local links in place of CDN links. */
export function previewQuestion(
  draft: DraftQuestion,
  final: boolean,
  links: Map<string, string>,
): Question {
  const q = toUploadQuestion(draft, 0, final);
  const file = (f: { md5: string; type: "image" | "audio" | "video" }) => ({
    ...f,
    link: links.get(f.md5) ?? null,
  });
  const files = (items: typeof q.questionFiles): QuestionFile[] | null =>
    items?.map((item) => ({ ...item, file: file(item.file) })) ?? null;
  return {
    ...q,
    id: PREVIEW_QUESTION,
    isHidden: q.isHidden ?? false,
    answerDelay: q.answerDelay ?? 0,
    questionFiles: files(q.questionFiles),
    answerFiles: files(q.answerFiles),
    answers: q.answers?.map((answer) => ({
      ...answer,
      file: answer.file ? file(answer.file) : null,
    })),
  };
}

function person(id: number, role: Player["role"], name: string, score = 1000): Player {
  return {
    meta: { id, username: name, avatar: null },
    role,
    slot: role === "player" ? id - 2 : null,
    status: "in-game",
    score,
    restrictionData: { muted: false, restricted: false, banned: false },
  };
}

/** Position is chosen once when constructing the launch, never on rerender. */
export interface PreviewNames {
  showman: string;
  players: [string, string, string];
  spectator: string;
  round: string;
  final: string;
  theme: string;
}

export function initialPreview(
  final: boolean,
  themeName: string,
  question: Pick<Question, "price" | "isHidden">,
  names: PreviewNames,
  random = Math.random,
) {
  const target = final ? 6 : Math.min(8, Math.floor(random() * 9));
  const round: Round = {
    id: 1,
    order: 0,
    name: final ? names.final : names.round,
    type: final ? "final" : "simple",
    themes: Array.from({ length: 3 }, (_, row) => ({
      id: 10 + row,
      order: row,
      name: row === (final ? 2 : Math.floor(target / 3)) ? themeName : `${names.theme} ${row + 1}`,
      questions: Array.from({ length: 3 }, (_, column) => ({
        id: row * 3 + column === target ? PREVIEW_QUESTION : 200 + row * 3 + column,
        order: column,
        price:
          row * 3 + column === target
            ? question.isHidden
              ? null
              : question.price
            : (column + 1) * 100,
        isPlayed: row * 3 + column !== target,
      })),
    })),
  };
  const data: GameJoinData = {
    meta: {
      title: names.round,
      settings: {
        falseStart: true,
        buttonPressMode: "random_within_window",
        wrongAnswerPenalty: "subtract",
        timers: {
          roundMs: 0,
          answerMs: 20_500,
          answerSubmitMs: 60_000,
          allPlayAnswerMs: 45_000,
          finalAnswerMs: 75_000,
          stakeMs: 30_000,
          secretTransferMs: 30_000,
        },
      },
    },
    players: [
      person(PREVIEW_SHOWMAN, "showman", names.showman),
      ...PREVIEW_PLAYERS.map((id, i) =>
        person(id, "player", names.players[i]!, Math.max(1000, (question.price ?? 0) + 100)),
      ),
      ...PREVIEW_SPECTATORS.map((id) => person(id, "spectator", names.spectator + ` ${id - 4}`)),
    ],
    chatMessages: [],
    gameState: {
      isPaused: false,
      currentRound: round,
      currentQuestion: null,
      answeringPlayer: null,
      answeredPlayers: null,
      readyPlayers: null,
      timer: final
        ? {
            startedAt: new Date(serverNow()).toISOString(),
            durationMs: 30_000,
            elapsedMs: 0,
            resumedAt: null,
          }
        : null,
      skippedPlayers: null,
      currentTurnPlayerId: PREVIEW_PLAYERS[0],
      questionState: final ? "theme_elimination" : "choosing",
      finalRoundData: final
        ? {
            phase: "theme_elimination",
            turnOrder: [...PREVIEW_PLAYERS],
            bids: {},
            answers: [],
            eliminatedThemes: [],
          }
        : null,
    },
  };
  return sessionFromSnapshot("local-preview", data);
}

/** Server's simple-question projection: answers and answer files never reach the player before reveal. */
export function publicQuestion(q: Question): Question {
  return {
    id: q.id,
    type: q.type,
    order: q.order,
    price: q.price,
    isHidden: q.isHidden,
    text: q.text,
    textOrder: q.textOrder,
    answerType: q.answerType,
    answerDelay: q.answerDelay,
    questionComment: q.questionComment,
    questionFiles: q.questionFiles,
    subType: q.subType,
    showAnswerDuration: q.showAnswerDuration,
    maxPrice: q.maxPrice,
    allowedPrices: q.allowedPrices,
    transferType: q.transferType,
    priceMultiplier: q.priceMultiplier,
    showDelay: q.showDelay,
    answers: q.answers,
  };
}
