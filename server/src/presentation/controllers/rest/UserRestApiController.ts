import { type Express, type Request, type Response, Router } from "express";

import { FileService } from "application/services/file/FileService";
import { TranslateService as ts } from "application/services/text/TranslateService";
import { type UserService } from "application/services/user/UserService";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { UpdateUserDTO } from "domain/types/dto/user/UpdateUserDTO";
import { UpdateUserInputDTO } from "domain/types/dto/user/UpdateUserInputDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { UserInputDTO } from "domain/types/dto/user/UserInputDTO";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { File } from "infrastructure/database/models/File";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import {
  checkPermission,
  checkPermissionWithId,
} from "presentation/middleware/permission/PermissionMiddleware";
import { PaginationSchema } from "presentation/schemes/pagination/PaginationSchema";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import {
  userIdScheme,
  userUpdateScheme,
} from "presentation/schemes/user/userSchemes";

/**
 * Handles all endpoints related for User CRUD
 */
export class UserRestApiController {
  constructor(
    private readonly app: Express,
    private readonly userService: UserService,
    private readonly fileService: FileService,
    private readonly logger: ILogger
  ) {
    const router = Router();
    const meRouter = Router();

    this.app.use("/v1/me", meRouter);
    this.app.use("/v1/users", router);

    meRouter.get("/", asyncHandler(this.getUser));

    meRouter.patch("/", asyncHandler(this.updateUser));

    meRouter.get("/", asyncHandler(this.deleteUser));

    router.get(
      "/",
      checkPermission(Permissions.GET_ALL_USERS, this.logger),
      asyncHandler(this.listUsers)
    );

    router.get(
      "/:id",
      checkPermissionWithId(Permissions.GET_ANOTHER_USER, this.logger),
      asyncHandler(this.getUser)
    );

    router.patch(
      "/:id",
      checkPermissionWithId(Permissions.CHANGE_ANOTHER_USER, this.logger),
      asyncHandler(this.updateUser)
    );

    router.delete(
      "/:id",
      checkPermissionWithId(Permissions.DELETE_ANOTHER_USER, this.logger),
      asyncHandler(this.deleteUser)
    );
  }

  private getUser = async (req: Request, res: Response) => {
    const id: number = this._getUserId(req);

    const validatedData = new RequestDataValidator<UserInputDTO>(
      { userId: id },
      userIdScheme()
    ).validate();

    let user: UserDTO;

    if (req.user && validatedData.userId === req.user.id) {
      user = req.user.toDTO();
    } else {
      user = await this.userService.get(validatedData.userId);
    }

    if (user) {
      return res.status(HttpStatus.OK).send(user);
    }

    return res.status(HttpStatus.NOT_FOUND).send({
      message: await ts.localize(ClientResponse.USER_NOT_FOUND, req.headers),
    });
  };

  private updateUser = async (req: Request, res: Response) => {
    const id: number = this._getUserId(req);

    const userInputDTO = new RequestDataValidator<UpdateUserInputDTO>(
      { ...req.body },
      userUpdateScheme()
    ).validate();

    if (Object.keys(userInputDTO).length < 1) {
      throw new ClientError(ClientResponse.NO_USER_DATA);
    }

    const user = await this.userService.getRaw(id, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"],
      },
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND);
    }

    let avatarFile: File | null = null;

    if (userInputDTO.avatar) {
      avatarFile = await this.fileService.getFileByFilename(
        userInputDTO.avatar
      );

      if (ValueUtils.isBad(avatarFile)) {
        throw new ClientError(ClientResponse.NO_AVATAR);
      }
    }

    const userUpdateDTO: UpdateUserDTO = {
      email: userInputDTO.email,
      username: userInputDTO.username,
      birthday: userInputDTO.birthday,
    };

    if (avatarFile) {
      userUpdateDTO.avatar = avatarFile;
    }

    const result = await this.userService.update(user, userUpdateDTO);

    return res.status(HttpStatus.OK).send(result);
  };

  private deleteUser = async (req: Request, res: Response) => {
    const id: number = this._getUserId(req);

    const validatedData = new RequestDataValidator<UserInputDTO>(
      { userId: id },
      userIdScheme()
    ).validate();

    await this.userService.delete(validatedData.userId);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private listUsers = async (req: Request, res: Response) => {
    const paginationOpts = await new PaginationSchema<User>({
      data: {
        sortBy: req.query.sortBy as keyof User,
        order: req.query.order as PaginationOrder,
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      },
      possibleSortByFields: [
        "id",
        "is_deleted",
        "created_at",
        "username",
        "email",
        "updated_at",
      ],
    }).validate();

    const result = await this.userService.list(paginationOpts);

    if (result) {
      return res.status(HttpStatus.OK).send(result);
    }

    return res.status(HttpStatus.NOT_FOUND).send({
      message: await ts.localize(ClientResponse.USER_NOT_FOUND, req.headers),
    });
  };

  private _getUserId(req: Request) {
    if (req.params && req.params.id) {
      return Number(req.params.id);
    } else {
      const id = req.session.userId;
      if (!id) {
        throw new ClientError(
          ClientResponse.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }
      return id;
    }
  }
}
