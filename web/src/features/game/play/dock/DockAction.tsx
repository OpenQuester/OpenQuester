import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { formatScore, formatSigned } from "@/lib/format";
import { Button } from "@/ui/Button";
import { useGame } from "../../GameContext";
import { useSecretTarget } from "../useSecretTarget";
import { SkipRoundButton } from "../SkipRoundButton";
import type { DockAction as DockActionDescriptor } from "./actionDockModel";
import { actionDockStyles, actionStack, centeredActions } from "./actionDockStyles";
import { AnswerBox } from "./AnswerBox";
import { BidControls } from "./BidControls";
import { FinalAnswerBox } from "./FinalAnswerBox";
import { JudgeExtras } from "./JudgeExtras";

export function DockInfo({ children }: { children: ReactNode }) {
  return (
    <div className={actionDockStyles.notice} data-testid="dock-info">
      {children}
    </div>
  );
}

/** Render the selected action without re-evaluating role, score or phase rules. */
export function DockAction({ action }: { action: DockActionDescriptor | null }) {
  const { t } = useTranslation();
  const { connection, store } = useGame();
  const [, setSecretTarget] = useSecretTarget();
  if (!action) return null;
  switch (action.kind) {
    case "info":
      if (!action.unpass && !action.nextRound) return <DockInfo>{action.text}</DockInfo>;
      return (
        <div className={action.nextRound ? centeredActions : actionStack}>
          <DockInfo>{action.text}</DockInfo>
          {action.unpass && (
            <Button size="sm" variant="ghost" onClick={() => connection.emit("question-unskip")}>
              {t("dock.showing.unpass")}
            </Button>
          )}
          {action.nextRound && !store && (
            <SkipRoundButton size="sm" variant="ghost" label={t("dock.choosing.nextRound")} />
          )}
        </div>
      );
    case "show-question":
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {action.early && (
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => connection.emit("buzzer-open")}
              disabled={action.opening}
              data-testid="open-buzzer"
            >
              {t("dock.showing.openBuzzer")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => connection.emit("skip-question-force")}
            disabled={action.revealing}
          >
            {t("dock.showing.revealAnswer")}
          </Button>
        </div>
      );
    case "buzz":
      return (
        <div className={actionStack}>
          <div className={actionDockStyles.answerActions}>
            <Button
              variant={action.early ? "secondary" : "accent"}
              size="xl"
              className={cn("flex-1", !action.early && "oq-pulse")}
              onClick={() => connection.emit("question-answer")}
              disabled={action.answering}
              aria-describedby={action.early ? "buzz-early-hint" : undefined}
              data-testid="buzz"
              data-early={action.early || undefined}
            >
              {action.answering
                ? action.inDraw
                  ? t("dock.showing.inDraw")
                  : t("dock.sending")
                : action.early
                  ? t("dock.showing.waitButton")
                  : t("dock.showing.buzz")}
              {!action.early && !action.answering && (
                <kbd className="hidden font-mono text-sm md:inline">{t("keys.space")}</kbd>
              )}
            </Button>
            {action.canPass && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => connection.emit("question-skip")}
                disabled={action.passing}
              >
                {t("dock.showing.pass")}
              </Button>
            )}
          </div>
          {action.early && (
            <p id="buzz-early-hint" className="m-0 text-center text-sm text-soft">
              {t("dock.showing.earlyHint")}
            </p>
          )}
        </div>
      );
    case "judge-wait":
      return (
        <div className={actionStack}>
          <DockInfo>{action.message}</DockInfo>
          <Button
            size="sm"
            variant="ghost"
            disabled={action.pending}
            onClick={() => connection.emit("answer-result", { answerType: "skip", scoreResult: 0 })}
            data-testid="judge-skip"
          >
            {t("judge.skipZero")}
          </Button>
        </div>
      );
    case "judge":
      return (
        <div className={actionStack}>
          <div className="flex w-full gap-2">
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              data-testid="judge-correct"
              disabled={action.pending}
              onClick={() =>
                connection.emit("answer-result", {
                  scoreResult: action.value,
                  answerType: "correct",
                })
              }
            >
              {t("judge.correct")} {formatSigned(action.value)}{" "}
              <kbd className="hidden text-xs opacity-70 md:inline">C</kbd>
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              data-testid="judge-wrong"
              disabled={action.pending}
              onClick={() =>
                connection.emit("answer-result", {
                  scoreResult: action.wrong === 0 ? -action.value : action.wrong,
                  answerType: "wrong",
                })
              }
            >
              {t("judge.wrong")} {action.wrong === 0 ? "±0" : formatSigned(action.wrong)}{" "}
              <kbd className="hidden text-xs opacity-70 md:inline">W</kbd>
            </Button>
          </div>
          <JudgeExtras value={action.value} wrongCosts={action.wrong !== 0} />
        </div>
      );
    case "answer":
      return (
        <div className={actionStack}>
          {action.mode === "choice" ? (
            <DockInfo>{t("dock.answering.pickOption")}</DockInfo>
          ) : action.mode === "point" ? (
            <DockInfo>{t("point.prompt")}</DockInfo>
          ) : (
            <AnswerBox numeric={action.mode === "number"} />
          )}
          {action.canGiveUp && (
            <Button
              size="sm"
              variant="ghost"
              disabled={action.pending}
              onClick={() => connection.emit("question-skip")}
            >
              {t("dock.answering.giveUp")}
            </Button>
          )}
        </div>
      );
    case "continue":
      return (
        <Button
          variant="accent"
          size="lg"
          fullWidth
          onClick={() => connection.emit("skip-show-answer")}
          disabled={action.pending}
          data-testid="continue"
        >
          {t("dock.reveal.continue")}
        </Button>
      );
    case "home":
      if (store) return <DockInfo>{t("editor.playtest.finished")}</DockInfo>;
      return (
        <Link to="/" className={actionDockStyles.backHome} data-testid="back-to-games">
          {t("dock.finished.back")}
        </Link>
      );
    case "secret-price":
      return (
        <div className="flex w-full flex-wrap gap-2" role="group" aria-label={t("secret.prices")}>
          {action.prices.map((price) => (
            <Button
              key={price}
              variant="accent"
              size="lg"
              className="flex-1"
              onClick={() => connection.emit("secret-question-price", { price })}
              data-testid="secret-price"
            >
              {formatScore(price)}
            </Button>
          ))}
        </div>
      );
    case "secret-transfer":
      return (
        <Button
          variant="accent"
          size="lg"
          fullWidth
          inactive={!action.target}
          data-testid="secret-give"
          onClick={() => {
            if (!action.target) return;
            connection.emit("secret-question-transfer", { targetPlayerId: action.target.id });
            setSecretTarget(null);
          }}
        >
          {action.target
            ? t("dock.secret.give", { name: action.target.name })
            : t("dock.secret.pickFirst")}
        </Button>
      );
    case "bid":
      return (
        <BidControls
          range={action.range}
          allIn={action.allIn}
          pending={action.pending}
          unavailable={action.unavailable}
          onBid={(amount) => {
            switch (action.event) {
              case "stake-bid-submit":
                connection.emit(action.event, { bidType: "normal", bidAmount: amount });
                break;
              case "final-bid-submit":
                connection.emit(action.event, { bid: amount });
                break;
              case "all-play-stake":
                connection.emit(action.event, { amount });
                break;
            }
          }}
          onAllIn={
            action.event === "stake-bid-submit" && action.allIn != null
              ? () => connection.emit("stake-bid-submit", { bidType: "all-in", bidAmount: null })
              : undefined
          }
          onPass={
            action.event === "stake-bid-submit" && action.pass
              ? () => connection.emit("stake-bid-submit", { bidType: "pass", bidAmount: null })
              : undefined
          }
          cta={action.event === "stake-bid-submit" ? undefined : t("dock.final.placeBid")}
        />
      );
    case "timed-answer":
      return <FinalAnswerBox event={action.event} numeric={action.numeric} />;
  }
}
