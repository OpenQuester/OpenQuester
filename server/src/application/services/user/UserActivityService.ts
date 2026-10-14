import { singleton } from "tsyringe";

import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";

/** Records when a user was last active; guest cleanup reads it. */
@singleton()
export class UserActivityService {
  constructor(private readonly storageRepository: StorageRepository) {
    //
  }

  /** Writes at most once an hour per user (the query checks too). */
  public touchLastSeen(userId: number): Promise<void> {
    return this.storageRepository.touchLastSeen(userId);
  }
}
