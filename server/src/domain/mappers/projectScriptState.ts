import type { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { projectSecretQuestion } from "domain/logic/question/secretQuestionRules";
import { projectAnswerReveal } from "domain/mappers/projectAnswerReveal";
import { projectFinalRoundData } from "domain/mappers/projectFinalRoundData";
import type { ScriptScoreEstimate } from "domain/types/dto/package/QuestionScriptDTO";
import { QuestionScriptLogic } from "domain/logic/question/QuestionScriptLogic";
import type { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

/** An ordinary ask opens the authored fixed price after its preamble. */
function revealsScriptPrice(state: GameStateDTO, question: PackageQuestionDTO): boolean {
  const progress = state.scriptProgress;
  return (
    !!progress &&
    (progress.priceRevealed ||
      (progress.waitingFor === "answer" &&
        !question.isHidden &&
        question.type !== PackageQuestionType.SECRET &&
        !Object.keys(progress.finalBids).length &&
        !Object.keys(progress.stakes).length &&
        state.stakeQuestionData?.highestBid == null))
  );
}

/** Apply this to every snapshot path, including room fallbacks after recipient lookup fails. */
export function projectScriptState(game: Game, viewerId?: number, host = false): GameStateDTO {
  const state = game.gameState;
  const { scriptProgress, ...visible } = state;
  if (state.secretQuestionData) {
    visible.secretQuestionData = projectSecretQuestion(state.secretQuestionData);
  }
  if (state.answerShowData) {
    visible.answerShowData = projectAnswerReveal(state.answerShowData, host);
  }
  visible.finalRoundData = projectFinalRoundData(state.finalRoundData, viewerId);
  if (!host && state.currentRound?.type === "final") {
    visible.currentRound = {
      ...state.currentRound,
      themes: state.currentRound.themes.map((theme) => ({ ...theme, questions: [] }))
    };
  }
  if (!scriptProgress) {
    if (!host && state.allPlay) {
      visible.allPlay = AllPlayLogic.hideFromPlayers(state.allPlay, state.questionState);
    }
    return visible;
  }
  visible.currentQuestion = state.currentQuestion
    ? projectScriptQuestion(state, state.currentQuestion, host)
    : null;
  if (scriptProgress.waitingFor === "price" && (host || viewerId === scriptProgress.actorId)) {
    visible.scriptView = { ...state.scriptView!, priceRange: scriptProgress.priceRange };
  }
  if (!host && state.answeringPlayer !== viewerId) {
    visible.submittedAnswer = null;
    visible.submittedChoiceOrder = null;
  }
  if (visible.allPlay) {
    const original = visible.allPlay;
    const projected = AllPlayLogic.hideFromPlayers(original, state.questionState);
    visible.allPlay = {
      ...projected,
      entries: projected.entries.map((entry) =>
        entry.playerId === viewerId
          ? (original.entries.find((item) => item.playerId === viewerId) ?? entry)
          : entry
      )
    };
  }
  const reveal =
    state.questionState === QuestionState.REVIEWING ||
    state.questionState === QuestionState.SHOWING_ANSWER ||
    (!state.allPlay && scriptProgress.submissions.some((entry) => entry.correct === null));
  if (scriptProgress.final) {
    visible.scriptFinalBids = Object.fromEntries(
      Object.entries(scriptProgress.finalBids).filter(([id]) => reveal || Number(id) === viewerId)
    );
  }
  if (visible.scriptView && scriptProgress.waitingFor === "answer" && state.currentQuestion) {
    const current = state.currentQuestion;
    const baseVisible =
      host ||
      revealsScriptPrice(state, current) ||
      (!current.isHidden && current.realPrice == null);
    const estimate = (id?: number): ScriptScoreEstimate | undefined => {
      const { win, lose, source, known } = QuestionScriptLogic.answerPrice(game, id);
      if (!known) {
        return;
      }
      if (source === "personal" && id !== viewerId && !reveal) {
        return;
      }
      if (source === "winning" && state.stakeQuestionData?.biddingPhase !== false) {
        return;
      }
      if (source === "base" && !baseVisible) {
        return;
      }
      return { win, lose };
    };
    const target = state.allPlay ? viewerId : (state.answeringPlayer ?? viewerId);
    const hasPersonalStakes =
      Object.keys(scriptProgress.finalBids).length > 0 ||
      Object.keys(scriptProgress.stakes).length > 0;
    const scoreEstimate =
      !hasPersonalStakes ||
      state.answeringPlayer != null ||
      (target !== undefined && game.isPlayerEligibleToAnswer(target))
        ? estimate(target)
        : undefined;
    const reviewScoreEstimates =
      reveal && state.allPlay
        ? Object.fromEntries(
            state.allPlay.entries.flatMap(({ playerId }) => {
              const score = estimate(playerId);
              return score ? [[playerId, score]] : [];
            })
          )
        : undefined;
    visible.scriptView = {
      ...visible.scriptView,
      ...(scoreEstimate ? { scoreEstimate } : {}),
      ...(reviewScoreEstimates ? { reviewScoreEstimates } : {})
    };
  }
  return visible;
}

export function projectScriptQuestion(
  state: GameStateDTO,
  question: PackageQuestionDTO,
  host = false
): PackageQuestionDTO {
  const { script: _script, ...current } = question;
  const visible: PackageQuestionDTO = host
    ? current
    : GameQuestionMapper.mapToSimpleQuestion(current);
  if (!host && visible.answers) {
    visible.answers = visible.answers.map(({ id, order, text, file, sourceLabel }) => ({
      id,
      order,
      text,
      file,
      ...(sourceLabel == null ? {} : { sourceLabel })
    }));
  }
  if (state.scriptProgress) {
    delete visible.allowedPrices;
  }
  if (state.scriptProgress && state.scriptProgress.waitingFor !== "answer") {
    delete visible.correctChoiceOrder;
    if (state.questionState !== QuestionState.MEDIA_DOWNLOADING) {
      visible.answers = [];
    }
  }
  if (revealsScriptPrice(state, question) && question.realPrice != null) {
    visible.realPrice = question.realPrice;
  } else if (!host) {
    delete visible.realPrice;
  }
  // Operands for future content and answers are never carried by a current script view.
  if (!host && state.questionState !== QuestionState.SHOWING_ANSWER) {
    delete visible.answerTextItems;
  }
  return visible;
}
