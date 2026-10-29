import { type GameSession } from "@/game/reducer";
import { type PlayerRole } from "@/game/protocol";
import { type BuzzerTiming } from "../useBuzzer";
import { type DisabledReason } from "@/game/selectors";

export interface ActionDockModel {
  status: string;
  action: DockAction | null;
  next: string;
  ringLabel?: string;
}

/** Role/phase decisions are data; DockAction owns markup and command dispatch. */
export type DockAction =
  | { kind: "info"; text: string; unpass?: boolean; nextRound?: boolean }
  | { kind: "show-question"; early: boolean; opening: boolean; revealing: boolean }
  | { kind: "buzz"; early: boolean; answering: boolean; passing: boolean; canPass: boolean }
  | { kind: "judge"; value: number; wrong: number; pending: boolean }
  | { kind: "judge-wait"; pending: boolean; message: string }
  | {
      kind: "answer";
      mode: "choice" | "point" | "number" | "text";
      canGiveUp: boolean;
      pending: boolean;
    }
  | { kind: "continue"; pending: boolean }
  | { kind: "home" }
  | { kind: "secret-price"; prices: number[] }
  | { kind: "secret-transfer"; target: { id: number; name: string } | null }
  | {
      kind: "bid";
      event: "stake-bid-submit" | "final-bid-submit" | "all-play-stake";
      range: { min: number; max: number } | null;
      allIn: number | null;
      pass?: boolean;
      pending: boolean;
      unavailable?: string;
    }
  | { kind: "timed-answer"; event?: "all-play-answer"; numeric?: boolean };

export type TranslateAction = (key: string, options?: Record<string, unknown>) => string;

export interface ActionDockContext {
  t: TranslateAction;
  session: GameSession;
  myId: number;
  role: PlayerRole;
  value: number;
  name: (id: number | null | undefined) => string;
  sending: (action: string) => boolean;
  reason: (reason: DisabledReason) => string;
  buzzer: BuzzerTiming;
  secretTarget: number | null;
  finalContentPlaying?: boolean;
  pointImageReady?: boolean;
}
