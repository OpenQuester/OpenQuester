import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { PackageRound } from "@/api/types";
import type { Round } from "@/game/protocol";
import { usePackage } from "@/features/packages/usePackages";
import { CheckIcon, TrophyIcon } from "@/ui/icons";
import { useGamePreview } from "../../useGamePreview";
import { gameScreenStyles } from "./gameScreenStyles";
import { useRoundPopover } from "./useRoundPopover";
import "./RoundIndicator.css";

/** Package metadata supplies the itinerary; the live snapshot owns the current round. */
export function RoundIndicator({ gameId, round }: { gameId: string; round: Round }) {
  const { t } = useTranslation();
  const game = useGamePreview(gameId);
  const pkg = usePackage(game.data?.package?.id);
  const rounds = [...(pkg.data?.rounds ?? [])].sort((a, b) => a.order - b.order);
  const current = rounds.findIndex((item) =>
    item.id != null && round.id != null ? item.id === round.id : item.order === round.order,
  );
  if (current < 0) {
    // Keep the server's current round visible when metadata is loading or unavailable.
    return (
      <span className={gameScreenStyles.roundName} title={round.name} data-testid="round-name">
        {round.type === "final"
          ? t("game.finalRound")
          : t("game.roundLabel", { n: round.order + 1, name: round.name })}
      </span>
    );
  }
  return (
    <RoundList
      key={`${gameId}:${round.id ?? round.order}`}
      rounds={rounds}
      current={current}
      name={round.type === "final" ? t("game.finalRound") : round.name}
    />
  );
}

function RoundList({
  rounds,
  current,
  name,
}: {
  rounds: PackageRound[];
  current: number;
  name: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { trigger, panel, open, enter, leave, focus, click, blur, toggle, keyDown, keepOpen } =
    useRoundPopover();
  const position = t("game.rounds.position", { current: current + 1, total: rounds.length });
  return (
    <div className="round-indicator" data-no-shortcuts onBlur={blur} onKeyDown={keyDown}>
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        className="round-indicator-trigger"
        data-testid="round-name"
        aria-label={t("game.rounds.open", { position, name })}
        aria-expanded={open}
        aria-controls={id}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={focus}
        onClick={click}
      >
        <span className="round-indicator-count" aria-hidden="true">
          <b>{current + 1}</b>
          <span>/</span>
          <small>{rounds.length}</small>
        </span>
        <span className="round-indicator-name">{name}</span>
        <svg className="round-indicator-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="m4 6 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <section
        ref={panel}
        id={id}
        popover="auto"
        className="round-indicator-panel"
        aria-labelledby={`${id}-title`}
        onToggle={toggle}
        onPointerEnter={keepOpen}
        onPointerLeave={leave}
      >
        <div className="round-indicator-heading">
          <span id={`${id}-title`}>{t("game.rounds.title")}</span>
          <span>{position}</span>
        </div>
        <ol tabIndex={0} aria-label={t("game.rounds.title")}>
          {rounds.map((item, index) => {
            const status =
              index < current
                ? "done"
                : index === current
                  ? "current"
                  : index === current + 1
                    ? "next"
                    : "later";
            return (
              <li
                key={item.id}
                data-state={status}
                data-final={item.type === "final"}
                aria-current={index === current ? "step" : undefined}
              >
                <span className="round-indicator-step" aria-hidden="true">
                  {item.type === "final" ? (
                    <TrophyIcon size={17} />
                  ) : index < current ? (
                    <CheckIcon size={16} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="round-indicator-title">{item.name}</span>
                <span className="round-indicator-status">
                  {status !== "later"
                    ? t(`game.rounds.${status}`)
                    : item.type === "final"
                      ? t("game.finalRound")
                      : null}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
