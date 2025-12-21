import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import {
  GAME_QUESTION_ANSWER_TIME,
  STAKE_QUESTION_BID_TIME,
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { SecretQuestionTransferLogic } from "domain/logic/special-question/SecretQuestionTransferLogic";
import { StakeBidSubmitLogic } from "domain/logic/special-question/StakeBidSubmitLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { StakeBiddingMapper } from "domain/mappers/StakeBiddingMapper";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import {
  StakeBidSubmitInputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { StakeBidSubmitResult } from "domain/types/socket/question/StakeQuestionResults";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { StakeQuestionValidator } from "domain/validators/StakeQuestionValidator";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Result from secret question transfer
 */
export interface SecretQuestionTransferResult {
  game: Game;
  fromPlayerId: number;
  toPlayerId: number;
  questionId: number;
  timer: GameStateTimer;
  /** Full question data for personalized broadcasts */
  question: PackageQuestionDTO;
}

/**
 * Result from stake question setup
 */
export interface StakeQuestionSetupResult {
  stakeQuestionData: StakeQuestionGameData;
  timer: GameStateTimer;
  automaticNominalBid: PlayerBidData | null;
}

/**
 * Service handling special question types: stake and secret questions
 */
export class SpecialQuestionService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handles secret question transfer to another player.
   */
  public async handleSecretQuestionTransfer(
    socketId: string,
    data: SecretQuestionTransferInputData
  ): Promise<SecretQuestionTransferResult> {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    const secretData = game.gameState.secretQuestionData;
    SecretQuestionValidator.validateTransfer({
      game,
      currentPlayer,
      secretData: secretData ?? null,
      targetPlayerId: data.targetPlayerId,
    });

    // Setup timer
    const timerEntity =
      await this.socketQuestionStateService.setupQuestionTimer(
        game,
        GAME_QUESTION_ANSWER_TIME,
        QuestionState.ANSWERING
      );

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      secretData!.questionId
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    // Process transfer via Logic class
    SecretQuestionTransferLogic.processTransfer(
      game,
      questionData,
      data.targetPlayerId
    );

    // Save
    await this.gameService.updateGame(game);

    return SecretQuestionTransferLogic.buildResult({
      game,
      fromPlayerId: currentPlayer!.meta.id,
      toPlayerId: data.targetPlayerId,
      secretData: secretData!,
      timer: timerEntity,
      question: questionData.question,
    });
  }

  /**
   * Handles stake question bid submission.
   */
  public async handleStakeBidSubmit(
    socketId: string,
    inputData: StakeBidSubmitInputData
  ): Promise<StakeBidSubmitResult> {
    // Context & Validation
    const bid: number | StakeBidType =
      inputData.bidType === StakeBidType.NORMAL && inputData.bidAmount !== null
        ? inputData.bidAmount
        : inputData.bidType;

    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    StakeQuestionValidator.validateBidSubmission({
      game,
      currentPlayer,
      stakeData: game.gameState.stakeQuestionData ?? null,
    });

    const stakeData = game.gameState.stakeQuestionData!;

    // Resolve bidding player via Logic class
    const biddingPlayer = StakeBidSubmitLogic.resolveBiddingPlayer(
      game,
      currentPlayer!,
      stakeData
    );

    const stakeQuestionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      stakeData.questionId
    );

    if (!stakeQuestionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const question = stakeQuestionData.question;
    const allPlayers = game.getInGamePlayers().map((player) => player.toDTO());

    const bidResult = StakeBiddingMapper.placeBid({
      playerId: biddingPlayer.meta.id,
      bid,
      stakeData,
      currentPlayer: biddingPlayer.toDTO(),
      questionPrice: question.price || 1,
      allPlayers,
    });

    game.gameState.stakeQuestionData = bidResult.updatedStakeData;

    const bidType = bidResult.bidType;
    const bidAmount = bidResult.bidAmount;
    const isPhaseComplete = bidResult.isPhaseComplete ?? false;
    const nextBidderId = bidResult.nextBidderId ?? null;

    const { questionData, timer } = await this.handleStakeBidTimers(
      game,
      isPhaseComplete,
      bidResult.updatedStakeData.winnerPlayerId,
      nextBidderId
    );

    await this.gameService.updateGame(game);

    return StakeBidSubmitLogic.buildResult({
      game,
      playerId: biddingPlayer.meta.id,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId: bidResult.updatedStakeData.winnerPlayerId,
      questionData: questionData ? { question: questionData } : null,
      timer,
    });
  }

  /**
   * Sets up secret question data and game state.
   * Returns null if no active players exist.
   */
  public setupSecretQuestion(
    game: Game,
    question: PackageQuestionDTO,
    currentPlayer: Player
  ): SecretQuestionGameData | null {
    const activeInGamePlayers = game.getInGamePlayers();
    if (activeInGamePlayers.length === 0) {
      return null;
    }

    const secretQuestionData: SecretQuestionGameData = {
      pickerPlayerId: currentPlayer.meta.id,
      transferType: question.transferType!,
      questionId: question.id!,
      transferPhase: true,
    };

    game.gameState.questionState = QuestionState.SECRET_TRANSFER;
    game.gameState.secretQuestionData = secretQuestionData;

    return secretQuestionData;
  }

  /**
   * Sets up stake question data, bidding order, and handles automatic bidding.
   * Returns null if no active players exist.
   */
  public async setupStakeQuestion(
    game: Game,
    question: PackageQuestionDTO,
    currentPlayer: Player
  ): Promise<StakeQuestionSetupResult | null> {
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    if (eligiblePlayers.length === 0) {
      return null;
    }

    const pickerIndex = eligiblePlayers.findIndex(
      (p) => p.meta.id === currentPlayer.meta.id
    );

    const biddingOrder = [
      ...eligiblePlayers.slice(pickerIndex),
      ...eligiblePlayers.slice(0, pickerIndex),
    ].map((p) => p.meta.id);

    const stakeQuestionData: StakeQuestionGameData = {
      pickerPlayerId: currentPlayer.meta.id,
      questionId: question.id!,
      maxPrice: question.maxPrice ?? null,
      bids: {},
      passedPlayers: [],
      biddingOrder,
      currentBidderIndex: 0,
      highestBid: null,
      winnerPlayerId: null,
      biddingPhase: true,
    };

    game.gameState.questionState = QuestionState.BIDDING;
    game.gameState.stakeQuestionData = stakeQuestionData;

    const timerEntity =
      await this.socketQuestionStateService.setupQuestionTimer(
        game,
        STAKE_QUESTION_BID_TIME,
        QuestionState.BIDDING
      );

    let automaticNominalBid: PlayerBidData | null = null;

    const nominalBidAmount = question.price ?? 1;

    if (currentPlayer.score < nominalBidAmount) {
      automaticNominalBid = this.handleAutomaticBid(
        stakeQuestionData,
        currentPlayer,
        game.players.map((player) => player.toDTO()),
        nominalBidAmount
      );
    }

    return { stakeQuestionData, timer: timerEntity, automaticNominalBid };
  }

  /**
   * Handles timer setup for stake bid submissions
   */
  private async handleStakeBidTimers(
    game: Game,
    isPhaseComplete: boolean,
    winnerPlayerId: number | null,
    nextBidderId: number | null
  ): Promise<{
    questionData: PackageQuestionDTO | undefined;
    timer: GameStateTimerDTO | undefined;
  }> {
    let questionData: PackageQuestionDTO | undefined;
    let timer: GameStateTimerDTO | undefined;

    if (isPhaseComplete && winnerPlayerId) {
      await this.gameService.clearTimer(game.id);

      game.gameState.questionState = QuestionState.SHOWING;
      game.gameState.answeringPlayer = null;

      const stakeData = game.gameState.stakeQuestionData;
      if (stakeData) {
        const questionAndTheme = GameQuestionMapper.getQuestionAndTheme(
          game.package,
          game.gameState.currentRound!.id,
          stakeData.questionId
        );

        if (questionAndTheme) {
          game.gameState.currentQuestion =
            GameQuestionMapper.mapToSimpleQuestion(questionAndTheme.question);
          questionData = questionAndTheme.question;
        }
      }

      const timerEntity =
        await this.socketQuestionStateService.setupQuestionTimer(
          game,
          GAME_QUESTION_ANSWER_TIME,
          QuestionState.SHOWING
        );

      timer = timerEntity.start();
    } else if (nextBidderId !== null) {
      await this.gameService.clearTimer(game.id);

      const timerEntity =
        await this.socketQuestionStateService.setupQuestionTimer(
          game,
          STAKE_QUESTION_BID_TIME,
          QuestionState.BIDDING
        );

      timer = timerEntity.start();
    }

    return { questionData, timer };
  }

  /**
   * Handles automatic bidding when player cannot afford nominal bid
   */
  private handleAutomaticBid(
    stakeQuestionData: StakeQuestionGameData,
    currentPlayer: Player,
    allPlayers: PlayerDTO[],
    questionPrice: number
  ): PlayerBidData {
    const autoBidAmount = questionPrice;
    stakeQuestionData.bids[currentPlayer.meta.id] = autoBidAmount;
    stakeQuestionData.highestBid = autoBidAmount;
    stakeQuestionData.winnerPlayerId = currentPlayer.meta.id;

    const shouldEndBidding = this.shouldAutoBidEndBidding(
      stakeQuestionData,
      autoBidAmount,
      allPlayers
    );

    if (shouldEndBidding) {
      stakeQuestionData.biddingPhase = false;
      stakeQuestionData.currentBidderIndex = 0;
    } else {
      stakeQuestionData.currentBidderIndex =
        (stakeQuestionData.currentBidderIndex + 1) %
        stakeQuestionData.biddingOrder.length;
    }

    return {
      playerId: currentPlayer.meta.id,
      bidAmount: autoBidAmount,
    };
  }

  /**
   * Determines if an auto-bid should immediately end the bidding phase
   */
  private shouldAutoBidEndBidding(
    stakeQuestionData: StakeQuestionGameData,
    autoBidAmount: number,
    allPlayers: PlayerDTO[]
  ): boolean {
    if (
      stakeQuestionData.maxPrice !== null &&
      autoBidAmount >= stakeQuestionData.maxPrice
    ) {
      return true;
    }

    const otherPlayerIds = stakeQuestionData.biddingOrder.filter(
      (playerId) => playerId !== stakeQuestionData.pickerPlayerId
    );

    for (const playerId of otherPlayerIds) {
      const player = allPlayers.find((p) => p.meta.id === playerId);
      if (player) {
        const minimumOutbid = autoBidAmount + 1;
        if (player.score >= minimumOutbid) {
          return false;
        }
      }
    }

    return true;
  }
}
