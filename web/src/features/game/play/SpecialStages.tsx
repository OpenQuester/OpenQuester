import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { boardQuestionMeta, findPlayer, myRole, seatedPlayers, stakeInfo } from "@/game/selectors";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";

import { useGame, useGameState, useSession } from "../GameContext";
import { useSecretTarget } from "./useSecretTarget";
import { stageStyles } from "./stages/stageStyles";
import { PlayerMessage, PlayerName } from "./PlayerName";
import type { SecretQuestionData } from "@/game/protocol";
import { StagePages } from "./stages/StagePages";

/** Secret question: the picker hands it to another player. */
export function SecretStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const secret = session.state.secretQuestionData;
  const meta = boardQuestionMeta(session, secret?.questionId);
  const picker = findPlayer(session, secret?.pickerPlayerId);
  const role = myRole(session, myId);
  const isPicker = secret?.pickerPlayerId === myId;
  const canChoose = isPicker || role === "showman";
  const [target, setTarget] = useSecretTarget();
  const selection = secret?.priceSelection;
  if (selection) return <SecretPriceStage selection={selection} />;
  const options = seatedPlayers(session).filter(
    (p) =>
      p.status === "in-game" &&
      !(secret?.transferType === "exceptCurrent" && p.meta.id === secret.pickerPlayerId),
  );
  const selectedTarget = options.some((p) => p.meta.id === target) ? target : null;

  return (
    <section className={stageStyles.secretLayout} aria-labelledby="secret-h">
      <span className="text-sm font-semibold text-muted">
        {t("questionTypes.secret")}
        {meta && ` · ${meta.theme.name} · ${meta.question.price ?? "?"}`}
      </span>
      <h2 id="secret-h" className={stageStyles.secretHeading}>
        {isPicker ? (
          t("secret.youPicked")
        ) : (
          <PlayerMessage i18nKey="secret.picked" name={picker?.meta.username ?? ""} />
        )}
      </h2>
      <p className="m-0 text-soft">
        {secret?.transferType === "exceptCurrent" ? t("secret.ruleExcept") : t("secret.ruleAny")}
      </p>
      <StagePages role="radiogroup" label={t("secret.giveTo")} itemWidth={270}>
        {options.map((p) => (
          <button
            key={p.meta.id}
            type="button"
            role="radio"
            aria-checked={selectedTarget === p.meta.id}
            onKeyDown={onChoiceKeyDown}
            disabled={!canChoose}
            onClick={() => setTarget(p.meta.id)}
            className={cn(
              stageStyles.secretRecipient,
              selectedTarget === p.meta.id
                ? "border-2 border-accent bg-accent-surface"
                : "border-line-strong bg-surface",
              !canChoose && "cursor-default",
              p.meta.id === myId && "player-card-own",
            )}
          >
            <Avatar name={p.meta.username} src={p.meta.avatar} size={32} />
            <span className="min-w-0 flex-1 font-semibold">
              <span className="block truncate text-warning" title={p.meta.username}>
                {p.meta.username}
              </span>
              {p.meta.id === myId && (
                <span className="font-normal text-muted"> ({t("common.you")})</span>
              )}
            </span>
            <span className="shrink-0 font-mono whitespace-nowrap text-muted">
              {formatScore(p.score)}
            </span>
          </button>
        ))}
      </StagePages>
    </section>
  );
}

/** Stake question auction: bids in turn order. Controls live in the dock. */
export function StakeStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const info = stakeInfo(session);
  if (!info) return null;
  const meta = boardQuestionMeta(session, info.stake.questionId);
  const passedPlayers = new Set(info.stake.passedPlayers);
  return (
    <section className={stageStyles.secretPrice}>
      <div className={stageStyles.questionColumn}>
        <span className="text-sm font-semibold text-muted">{t("stake.kicker")}</span>
        <h2 className={stageStyles.secretTitle}>{meta?.theme.name ?? t("questionTypes.stake")}</h2>
        <p className="m-0 text-soft">
          {t("stake.rules", {
            start: formatScore(info.price ?? 0),
            max:
              info.stake.maxPrice != null ? formatScore(info.stake.maxPrice) : t("stake.noLimit"),
          })}
        </p>
      </div>
      <div className={stageStyles.secretRecipientColumn} aria-label={t("stake.bids")}>
        <span className="text-sm text-muted">{t("stake.bids")}</span>
        {info.stake.biddingOrder.map((id) => {
          const p = findPlayer(session, id);
          const passed = passedPlayers.has(id);
          const bid = info.stake.bids[String(id)];
          const turn = info.bidderId === id && info.stake.biddingPhase;
          return (
            <div
              key={id}
              className={cn(
                stageStyles.selectedRecipient,
                turn ? "border-accent-line bg-accent-surface" : "border-line",
                passed && "opacity-60",
              )}
            >
              <span className="flex-1 font-semibold">
                <PlayerName>{p?.meta.username}</PlayerName>
                {id === myId && (
                  <span className="font-normal text-muted"> ({t("common.you")})</span>
                )}
              </span>
              <span className={cn("text-sm", turn ? "text-accent-strong" : "text-muted")}>
                {passed
                  ? t("stake.passed")
                  : turn
                    ? t("stake.theirTurn")
                    : bid != null
                      ? t("stake.bid")
                      : t("stake.waiting")}
              </span>
              <b className="w-20 text-right font-mono">
                {bid != null && !passed ? formatScore(bid) : "—"}
              </b>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SecretPriceStage({
  selection,
}: {
  selection: NonNullable<SecretQuestionData["priceSelection"]>;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const meta = boardQuestionMeta(session, session.state.secretQuestionData?.questionId);
  const { connection } = useGame();
  const pending = useGameState((state) => state.pending);
  const connected = useGameState((state) => state.connection === "connected");
  const mine = selection.playerId === myId;
  const disabled =
    !!pending || !connected || !connection.connected || session.state.isPaused || session.finished;
  const chooser = findPlayer(session, selection.playerId);
  return (
    <section
      className={cn(
        stageStyles.secretLayout,
        "items-center justify-center overflow-y-auto text-center",
      )}
      aria-labelledby="secret-h"
    >
      <span className="text-sm font-semibold text-muted">
        {t("questionTypes.secret")}
        {meta && ` · ${meta.theme.name}`}
      </span>
      <h2 id="secret-h" className={stageStyles.secretHeading}>
        {selection.playerId === myId ? (
          t("secret.pickPriceYou")
        ) : (
          <PlayerMessage i18nKey="secret.pickPrice" name={chooser?.meta.username ?? ""} />
        )}
      </h2>
      <ul
        className={cn(
          "m-0 w-full max-w-[720px] list-none p-0",
          mine
            ? "grid grid-cols-[repeat(auto-fit,minmax(min(120px,100%),1fr))] gap-3"
            : "flex flex-wrap justify-center gap-3",
        )}
        aria-label={t("secret.prices")}
      >
        {selection.allowedPrices.map((p) => (
          <li key={p}>
            {mine ? (
              <Button
                variant="accent"
                size="lg"
                fullWidth
                disabled={disabled}
                data-testid="secret-price"
                onClick={() => connection.emit("secret-question-price", { price: p })}
              >
                {formatScore(p)}
              </Button>
            ) : (
              <span className="block rounded-md border border-line bg-surface px-5 py-3 font-mono text-2xl font-semibold text-soft">
                {formatScore(p)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
