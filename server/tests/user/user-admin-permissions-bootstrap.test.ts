import { Namespace } from "socket.io";

import { UserService } from "application/services/user/UserService";
import { FileUsageService } from "application/services/file/FileUsageService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";

function createLoggerMock(): ILogger {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    audit: jest.fn(),
    migration: jest.fn(),
    log: jest.fn(),
    checkAccess: jest.fn(),
    performance: jest.fn(() => ({ finish: jest.fn() })),
  } as unknown as ILogger;
}

describe("UserService admin bootstrap permissions", () => {
  it("should grant all permissions to configured admin emails", async () => {
    const firstPermission = { id: 1, name: "p1" } as Permission;
    const secondPermission = { id: 2, name: "p2" } as Permission;
    const allPermissions = [firstPermission, secondPermission];

    const needsUpdateUser = {
      id: 10,
      email: "admin1@example.com",
      permissions: [firstPermission],
    } as User;

    const hasAllPermissionsUser = {
      id: 11,
      email: "admin2@example.com",
      permissions: allPermissions,
    } as User;

    const userRepository = {
      getAllPermissions: jest.fn().mockResolvedValue(allPermissions),
      findByEmails: jest
        .fn()
        .mockResolvedValue([needsUpdateUser, hasAllPermissionsUser]),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;

    const logger = createLoggerMock();

    const service = new UserService(
      userRepository,
      {} as FileUsageService,
      {} as UserNotificationRoomService,
      {} as SocketUserDataService,
      {} as Namespace,
      logger
    );

    await service.grantAllPermissionsByEmails([
      " ADMIN1@example.com ",
      "admin2@example.com",
    ]);

    expect(userRepository.findByEmails).toHaveBeenCalledWith([
      "admin1@example.com",
      "admin2@example.com",
    ]);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(userRepository.save).toHaveBeenCalledWith(needsUpdateUser);
    expect(needsUpdateUser.permissions).toEqual(allPermissions);
  });

  it("should skip processing when email list is empty", async () => {
    const userRepository = {
      getAllPermissions: jest.fn(),
      findByEmails: jest.fn(),
      save: jest.fn(),
    } as unknown as UserRepository;

    const service = new UserService(
      userRepository,
      {} as FileUsageService,
      {} as UserNotificationRoomService,
      {} as SocketUserDataService,
      {} as Namespace,
      createLoggerMock()
    );

    await service.grantAllPermissionsByEmails(["   ", ""]);

    expect(userRepository.getAllPermissions).not.toHaveBeenCalled();
    expect(userRepository.findByEmails).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
