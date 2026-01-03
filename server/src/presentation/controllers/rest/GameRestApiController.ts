import { Router, type Express, type Request, type Response } from "express";

import { type GameService } from "application/services/game/GameService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import {
  createGameScheme,
  gameIdScheme,
  gamePaginationScheme,
  updateGameScheme,
} from "presentation/schemes/game/gameSchemes";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

export class GameRestApiController {
  constructor(
    private readonly app: Express,
    private readonly gameService: GameService
  ) {
    const router = Router();

    this.app.use("/v1/games", router);

    router.get(`/`, asyncHandler(this.listGames));
    router.post(`/`, asyncHandler(this.createGame));
    router.get(`/:gameId`, asyncHandler(this.getGame));
    router.patch(`/:gameId`, asyncHandler(this.updateGame));
    router.delete(`/:gameId`, asyncHandler(this.deleteGame));
  }

  private deleteGame = async (req: Request, res: Response) => {
    const validatedData = new RequestDataValidator<{ gameId: string }>(
      { gameId: req.params.gameId },
      gameIdScheme()
    ).validate();

    await this.gameService.delete(req, validatedData.gameId);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private getGame = async (req: Request, res: Response) => {
    const validatedData = new RequestDataValidator<{ gameId: string }>(
      { gameId: req.params.gameId },
      gameIdScheme()
    ).validate();

    const result = await this.gameService.get(validatedData.gameId);

    return res.status(HttpStatus.OK).send(result);
  };

  private listGames = async (req: Request, res: Response) => {
    const paginationOpts = new RequestDataValidator<GamePaginationOpts>(
      req.query as unknown as GamePaginationOpts,
      gamePaginationScheme()
    ).validate();

    const result = await this.gameService.list(paginationOpts);
    return res.status(HttpStatus.OK).send(result);
  };

  private createGame = async (req: Request, res: Response) => {
    const gameCreateDTO = new RequestDataValidator<GameCreateDTO>(
      req.body,
      createGameScheme()
    ).validate();

    if (Object.keys(gameCreateDTO).length < 1) {
      throw new ClientError(ClientResponse.NO_GAME_DATA);
    }

    const result = await this.gameService.create(req, gameCreateDTO);
    return res.status(HttpStatus.OK).send(result);
  };

  private updateGame = async (req: Request, res: Response) => {
    const validatedParams = new RequestDataValidator<{ gameId: string }>(
      { gameId: req.params.gameId },
      gameIdScheme()
    ).validate();

    const updateDTO = new RequestDataValidator<GameUpdateDTO>(
      req.body,
      updateGameScheme()
    ).validate();

    if (Object.keys(updateDTO).length < 1) {
      throw new ClientError(ClientResponse.NO_GAME_DATA);
    }

    const result = await this.gameService.update(
      req,
      validatedParams.gameId,
      updateDTO
    );
    return res.status(HttpStatus.OK).send(result);
  };
}
