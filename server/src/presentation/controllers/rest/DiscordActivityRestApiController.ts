import { Router, type Express, type Request, type Response } from "express";

import { type DiscordActivityService } from "application/services/discord/DiscordActivityService";
import { type UserService } from "application/services/user/UserService";
import { HttpStatus } from "domain/enums/HttpStatus";
import { type GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { discordInstanceIdScheme } from "presentation/schemes/discord/discordSchemes";
import { createGameScheme } from "presentation/schemes/game/gameSchemes";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

interface InstanceParams {
  instanceId: string;
}

/** The lobby of a Discord Activity instance (see DiscordActivityService) */
export class DiscordActivityRestApiController {
  constructor(
    private readonly app: Express,
    private readonly discordActivityService: DiscordActivityService,
    private readonly userService: UserService
  ) {
    const router = Router();

    this.app.use("/v1/discord/activity", router);

    router.get("/instances/:instanceId/game", asyncHandler(this.getInstanceGame));
    router.post("/instances/:instanceId/game", asyncHandler(this.getOrCreateInstanceGame));
  }

  private getInstanceGame = async (req: Request, res: Response) => {
    const { instanceId } = this._validateParams(req);

    const result = await this.discordActivityService.getInstanceGame(instanceId);

    res.status(HttpStatus.OK).json(result);
  };

  private getOrCreateInstanceGame = async (req: Request, res: Response) => {
    const { instanceId } = this._validateParams(req);

    const gameData = new RequestDataValidator<GameCreateDTO>(
      req.body,
      createGameScheme()
    ).validate();

    const user = await this.userService.getUserBySession(req.session.userId, {
      select: ["id", "username", "name"],
      relations: []
    });

    const result = await this.discordActivityService.getOrCreateInstanceGame(
      instanceId,
      { id: user.id, username: user.name?.trim() || user.username },
      gameData
    );

    res.status(HttpStatus.OK).json(result);
  };

  private _validateParams(req: Request): InstanceParams {
    return new RequestDataValidator<InstanceParams>(
      { instanceId: req.params.instanceId },
      discordInstanceIdScheme()
    ).validate();
  }
}
