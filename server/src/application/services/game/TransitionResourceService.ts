import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { Game } from "domain/entities/game/Game";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/round/FinalRoundHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { TransitionQuestionWithTheme, TransitionResources } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import type { ResolvedFinalRoundQuestion } from "domain/types/finalround/FinalRoundInterfaces";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Loads server-side data needed by pure transition handlers.
 */
@singleton()
export class TransitionResourceService {
  public constructor(
    private readonly gameService: GameService,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  public async getSavedShowingTimer(game: Game): Promise<TransitionResources> {
    return {
      savedShowingTimer: await this.gameService.getTimer(game.id, QuestionState.SHOWING)
    };
  }

  public async getCurrentQuestionWithTheme(game: Game): Promise<TransitionResources | undefined> {
    const questionId = game.gameState.currentQuestion?.id;
    if (!questionId) {
      return undefined;
    }

    return this.getQuestionWithTheme(game, questionId);
  }

  public async getQuestionWithTheme(
    game: Game,
    questionId: number
  ): Promise<TransitionResources | undefined> {
    const questionWithTheme = await this.packageStore.getQuestionWithTheme(game.id, questionId);

    const live = game.gameState.currentQuestion;
    return this.fromQuestionWithTheme(
      questionWithTheme && live?.id === questionId && live.realPrice != null
        ? {
            ...questionWithTheme,
            question: { ...questionWithTheme.question, realPrice: live.realPrice }
          }
        : questionWithTheme
    );
  }

  public fromQuestionWithTheme(
    questionWithTheme: TransitionQuestionWithTheme | null
  ): TransitionResources | undefined {
    if (!questionWithTheme) {
      return undefined;
    }

    return {
      questionWithTheme,
      simpleQuestion: this.mapSimpleQuestion(questionWithTheme.question)
    };
  }

  public fromSimpleQuestion(question: PackageQuestionDTO | null): TransitionResources | undefined {
    const simpleQuestion = question ? GameQuestionMapper.mapToSimpleQuestion(question, true) : null;
    if (!simpleQuestion) {
      return undefined;
    }

    return { simpleQuestion };
  }

  public async getFinalRoundQuestionData(game: Game): Promise<TransitionResources | undefined> {
    const resolved = await this.resolveFinalRoundQuestionData(game);
    if (!resolved) {
      return undefined;
    }

    return {
      finalRoundQuestionData: resolved.questionData,
      finalRoundFullQuestion: resolved.fullQuestion
    };
  }

  public async getNextRound(game: Game): Promise<TransitionResources> {
    const nextRoundEntry = game.getNextRound();

    return {
      nextRound: nextRoundEntry
        ? await this.packageStore.getRound(game.id, nextRoundEntry.order)
        : null
    };
  }

  public async getFinalReviewCompletionResources(game: Game): Promise<TransitionResources> {
    const nextRoundEntry = game.getNextRound();
    const nextRound = nextRoundEntry
      ? await this.packageStore.getRound(game.id, nextRoundEntry.order)
      : null;

    const resolved = await this.resolveFinalRoundQuestionData(game);
    return {
      nextRound,
      finalRoundFullQuestion: resolved?.fullQuestion,
      finalQuestionAnswerData: resolved
        ? {
            themeId: resolved.questionData.themeId,
            themeName: resolved.questionData.themeName,
            questionText: resolved.fullQuestion.text || undefined,
            answerText: resolved.fullQuestion.answerText || undefined
          }
        : null
    };
  }

  public merge(
    ...resources: Array<TransitionResources | undefined>
  ): TransitionResources | undefined {
    const merged: TransitionResources = {};

    for (const resource of resources) {
      if (resource) {
        Object.assign(merged, resource);
      }
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private async resolveFinalRoundQuestionData(
    game: Game
  ): Promise<ResolvedFinalRoundQuestion | null> {
    const handler = RoundHandlerFactory.create(PackageRoundType.FINAL) as FinalRoundHandler;
    const remainingTheme = handler.getRemainingTheme(game);

    if (!remainingTheme?.questions?.[0]) {
      return null;
    }

    const questionId = remainingTheme.questions[0].id;
    const questionWithTheme = await this.packageStore.getQuestionWithTheme(game.id, questionId);

    if (!questionWithTheme) {
      return null;
    }

    return {
      questionData: {
        themeId: remainingTheme.id,
        themeName: remainingTheme.name,
        question: GameQuestionMapper.mapToSimpleQuestion(questionWithTheme.question, false)
      },
      fullQuestion: questionWithTheme.question
    };
  }

  private mapSimpleQuestion(question: PackageQuestionDTO | null): SimplePackageQuestionDTO | null {
    if (!question) {
      return null;
    }

    return GameQuestionMapper.mapToSimpleQuestion(question);
  }
}
