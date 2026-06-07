import { type Express, type Request, type Response, Router } from "express";

import { FileService } from "application/services/file/FileService";
import { type UpdateUserDTO } from "application/types/user/UpdateUserDTO";
import { type UpdateUserInputDTO } from "application/types/user/UpdateUserInputDTO";
import { TranslateService as ts } from "domain/utils/TranslateService";
import { type UserService } from "application/services/user/UserService";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { type UserDTO } from "domain/types/dto/user/UserDTO";
import { type UserInputDTO } from "domain/types/dto/user/UserInputDTO";
import { type UserPermissionsUpdateDTO } from "domain/types/dto/user/UserPermissionsUpdateDTO";
import { asUserId } from "domain/types/ids";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { type UserSortField } from "domain/types/pagination/user/UserPaginationOpts";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { ValueUtils } from "domain/utils/ValueUtils";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import {
  checkPermissionMiddleware,
  checkPermissionWithId
} from "presentation/middleware/permission/PermissionMiddleware";
import { PaginationSchema } from "presentation/schemes/pagination/PaginationSchema";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import {
  userIdScheme,
  userPermissionsUpdateScheme,
  userUpdateScheme
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
    meRouter.delete("/", asyncHandler(this.deleteUser));

    router.get(
      "/",
      checkPermissionMiddleware(Permissions.GET_ALL_USERS, this.logger),
      asyncHandler(this.listUsers)
    );

    router.get(
      "/:id",
      checkPermissionWithId(Permissions.GET_ANOTHER_USER, this.logger),
      asyncHandler(this.getUser)
    );

    router.patch(
      "/:id/permissions",
      checkPermissionMiddleware(Permissions.MANAGE_PERMISSIONS, this.logger),
      asyncHandler(this.updateUserPermissions)
    );
  }

  private getUser = async (req: Request, res: Response) => {
    const id = this._getUserId(req);

    const validatedData = new RequestDataValidator<UserInputDTO>(
      { userId: id },
      userIdScheme()
    ).validate();

    let user: UserDTO;

    if (req.auth && validatedData.userId === req.auth.userId) {
      user = await this.userService.get(validatedData.userId);
    } else {
      user = await this.userService.get(validatedData.userId);
    }

    if (user) {
      return res.status(HttpStatus.OK).send(user);
    }

    return res.status(HttpStatus.NOT_FOUND).send({
      message: await ts.localize(ClientResponse.USER_NOT_FOUND, req.headers["accept-language"])
    });
  };

  private updateUser = async (req: Request, res: Response) => {
    const id = req.session.userId;
    if (!id) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const userInputDTO = new RequestDataValidator<UpdateUserInputDTO>(
      { ...req.body },
      userUpdateScheme()
    ).validate();

    if (Object.keys(userInputDTO).length < 1) {
      throw new ClientError(ClientResponse.NO_USER_DATA);
    }

    const user = await this.userService.getRaw(asUserId(id), {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"]
      }
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND);
    }

    let avatarFile = null;

    if (userInputDTO.avatar) {
      avatarFile = await this.fileService.getFileByFilename(userInputDTO.avatar);

      if (ValueUtils.isBad(avatarFile)) {
        throw new ClientError(ClientResponse.NO_AVATAR);
      }
    }

    const userUpdateDTO: UpdateUserDTO = {
      email: userInputDTO.email,
      username: userInputDTO.username,
      name: userInputDTO.name,
      birthday: userInputDTO.birthday
    };

    if (avatarFile) {
      userUpdateDTO.avatar = avatarFile;
    }

    const result = await this.userService.update(user, userUpdateDTO);

    return res.status(HttpStatus.OK).send(result);
  };

  private deleteUser = async (req: Request, res: Response) => {
    const id = req.session.userId;
    if (!id) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const validatedData = new RequestDataValidator<UserInputDTO>(
      { userId: asUserId(id) },
      userIdScheme()
    ).validate();

    await this.userService.delete(validatedData.userId);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private listUsers = async (req: Request, res: Response) => {
    const paginationOpts = await new PaginationSchema<UserSortField>({
      data: {
        sortBy: req.query.sortBy as UserSortField,
        order: req.query.order as PaginationOrder,
        limit: Number(req.query.limit),
        offset: Number(req.query.offset)
      },
      possibleSortByFields: ["id", "is_deleted", "created_at", "username", "email", "updated_at"]
    }).validate();

    const result = await this.userService.list(paginationOpts);

    if (result) {
      return res.status(HttpStatus.OK).send(result);
    }

    return res.status(HttpStatus.NOT_FOUND).send({
      message: await ts.localize(ClientResponse.USER_NOT_FOUND, req.headers["accept-language"])
    });
  };

  private updateUserPermissions = async (req: Request, res: Response) => {
    const userId = asUserId(Number(req.params.id));

    // Validate user ID
    const validatedUserData = new RequestDataValidator<UserInputDTO>(
      { userId },
      userIdScheme()
    ).validate();

    // Validate permissions update data
    const validatedPermissionsData = new RequestDataValidator<UserPermissionsUpdateDTO>(
      req.body,
      userPermissionsUpdateScheme()
    ).validate();

    this.logger.info("User permissions update request received", {
      prefix: LogPrefix.USER,
      targetUserId: validatedUserData.userId,
      requestorUserId: req.auth?.userId,
      permissionsCount: validatedPermissionsData.permissions.length,
      newPermissions: validatedPermissionsData.permissions
    });

    // Delegate business logic to service
    const updatedUser = await this.userService.updateUserPermissionsByNames(
      validatedUserData.userId,
      validatedPermissionsData.permissions
    );

    this.logger.audit("User permissions update completed successfully", {
      prefix: LogPrefix.USER,
      targetUserId: validatedUserData.userId,
      requestorUserId: req.auth?.userId
    });

    // Return success response with user data
    return res.status(HttpStatus.OK).send({
      message: "User permissions updated successfully",
      data: updatedUser
    });
  };

  private _getUserId(req: Request) {
    if (req.params && req.params.id) {
      return asUserId(Number(req.params.id));
    } else {
      const id = req.session.userId;
      if (!id) {
        throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return asUserId(id);
    }
  }
}
