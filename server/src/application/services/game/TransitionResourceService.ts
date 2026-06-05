import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { Game } from "domain/entities/game/Game";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/round/FinalRoundHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import {
  TransitionQuestionWithTheme,
  TransitionResources,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { FinalRoundQuestionData } from "domain/types/finalround/FinalRoundInterfaces";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { QuestionAnswerData } from "domain/types/socket/finalround/QuestionAnswerData";
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

  public async getSavedShowingTimer(
    game: Game
  ): Promise<TransitionResources> {
    return {
      savedShowingTimer: await this.gameService.getTimer(
        game.id,
        QuestionState.SHOWING
      ),
    };
  }

  public async getCurrentQuestionWithTheme(
    game: Game
  ): Promise<TransitionResources | undefined> {
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
    const questionWithTheme = await this.packageStore.getQuestionWithTheme(
      game.id,
      questionId
    );

    return this.fromQuestionWithTheme(questionWithTheme);
  }

  public fromQuestionWithTheme(
    questionWithTheme: TransitionQuestionWithTheme | null
  ): TransitionResources | undefined {
    if (!questionWithTheme) {
      return undefined;
    }

    return {
      questionWithTheme,
      simpleQuestion: this.mapSimpleQuestion(questionWithTheme.question),
    };
  }

  public fromSimpleQuestion(
    question: PackageQuestionDTO | null
  ): TransitionResources | undefined {
    const simpleQuestion = this.mapSimpleQuestion(question);
    if (!simpleQuestion) {
      return undefined;
    }

    return { simpleQuestion };
  }

  public async getFinalRoundQuestionData(
    game: Game
  ): Promise<TransitionResources | undefined> {
    const finalRoundQuestionData = await this.resolveFinalRoundQuestionData(game);
    if (!finalRoundQuestionData) {
      return undefined;
    }

    return { finalRoundQuestionData };
  }

  public async getNextRound(game: Game): Promise<TransitionResources> {
    const nextRoundEntry = game.getNextRound();

    return {
      nextRound: nextRoundEntry
        ? await this.packageStore.getRound(game.id, nextRoundEntry.order)
        : null,
    };
  }

  public async getFinalReviewingToGameFinishResources(
    game: Game
  ): Promise<TransitionResources> {
    const nextRoundEntry = game.getNextRound();
    const nextRound = nextRoundEntry
      ? await this.packageStore.getRound(game.id, nextRoundEntry.order)
      : null;

    return {
      nextRound,
      finalQuestionAnswerData: await this.resolveFinalQuestionAnswerData(game),
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
  ): Promise<FinalRoundQuestionData | null> {
    const handler = RoundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;
    const remainingTheme = handler.getRemainingTheme(game);

    if (!remainingTheme?.questions?.[0]) {
      return null;
    }

    const questionId = remainingTheme.questions[0].id;
    const questionWithTheme = await this.packageStore.getQuestionWithTheme(
      game.id,
      questionId
    );

    if (!questionWithTheme) {
      return null;
    }

    return {
      themeId: remainingTheme.id,
      themeName: remainingTheme.name,
      question: GameQuestionMapper.mapToSimpleQuestion(
        questionWithTheme.question
      ),
    };
  }

  private async resolveFinalQuestionAnswerData(
    game: Game
  ): Promise<QuestionAnswerData | null> {
    const handler = RoundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;
    const remainingTheme = handler.getRemainingTheme(game);

    if (!remainingTheme?.id || !remainingTheme?.name) {
      return null;
    }

    const questionId = remainingTheme.questions?.[0]?.id;
    if (!questionId) {
      return null;
    }

    const question = await this.packageStore.getQuestion(game.id, questionId);
    if (!question) {
      return null;
    }

    return {
      themeId: remainingTheme.id,
      themeName: remainingTheme.name,
      questionText: question.text || undefined,
      answerText: question.answerText || undefined,
    };
  }

  private mapSimpleQuestion(
    question: PackageQuestionDTO | null
  ): SimplePackageQuestionDTO | null {
    if (!question) {
      return null;
    }

    return GameQuestionMapper.mapToSimpleQuestion(question);
  }
}
