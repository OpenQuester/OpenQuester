import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { boardQuestionMeta, findPlayer, myRole, seatedPlayers, stakeInfo } from "@/game/selectors";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";

import { useGame, useSession } from "../GameContext";
import { useSecretTarget } from "./useSecretTarget";
import { stageStyles } from "./stages/stageStyles";
import type { SecretQuestionData } from "@/game/protocol";

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
        {isPicker
          ? t("secret.youPicked")
          : t("secret.picked", { name: picker?.meta.username ?? "" })}
      </h2>
      <p className="m-0 text-soft">
        {secret?.transferType === "exceptCurrent" ? t("secret.ruleExcept") : t("secret.ruleAny")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("secret.giveTo")}
        className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
      >
        {options.map((p) => (
          <button
            key={p.meta.id}
            type="button"
            role="radio"
            aria-checked={selectedTarget === p.meta.id}
            tabIndex={
              selectedTarget === p.meta.id || (selectedTarget === null && p === options[0]) ? 0 : -1
            }
            onKeyDown={onChoiceKeyDown}
            disabled={!canChoose}
            onClick={() => setTarget(p.meta.id)}
            className={cn(
              stageStyles.secretRecipient,
              selectedTarget === p.meta.id
                ? "border-2 border-accent bg-accent-surface"
                : "border-line-strong bg-surface",
              !canChoose && "cursor-default",
            )}
          >
            <Avatar name={p.meta.username} size={36} />
            <span className="flex-1 font-semibold">
              {p.meta.username}
              {p.meta.id === myId && (
                <span className="font-normal text-muted"> ({t("common.you")})</span>
              )}
            </span>
            <span className="font-mono text-muted">{formatScore(p.score)}</span>
          </button>
        ))}
      </div>
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
          const passed = info.stake.passedPlayers.includes(id);
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
                {p?.meta.username}
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

  const chooser = findPlayer(session, selection.playerId);
  return (
    <section className={stageStyles.secretLayout} aria-labelledby="secret-h">
      <span className="text-sm font-semibold text-muted">
        {t("questionTypes.secret")}
        {meta && ` · ${meta.theme.name}`}
      </span>
      <h2 id="secret-h" className={stageStyles.secretHeading}>
        {selection.playerId === myId
          ? t("secret.pickPriceYou")
          : t("secret.pickPrice", { name: chooser?.meta.username ?? "" })}
      </h2>
      <ul className={stageStyles.stakeBids} aria-label={t("secret.prices")}>
        {selection.allowedPrices.map((p) => (
          <li key={p} className={stageStyles.stakeBid}>
            {formatScore(p)}
          </li>
        ))}
      </ul>
    </section>
  );
}
