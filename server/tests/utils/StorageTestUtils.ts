import { jest } from "@jest/globals";
import { container } from "tsyringe";

import { S3ObjectStorage } from "infrastructure/storage/S3ObjectStorage";

/** Size the fake storage reports for every object. */
const STORED_FILE_SIZE = 100;

/**
 * Makes storage answer that every package file is uploaded, so gameplay
 * tests can start games from packages with media. Tests run without real
 * storage, and unconfirmed media keeps a package unplayable.
 * Restore the returned spy when the suite is done.
 */
export function fakeUploadedMedia(): ReturnType<typeof jest.spyOn> {
  return jest
    .spyOn(container.resolve(S3ObjectStorage), "headObject")
    .mockResolvedValue({ size: STORED_FILE_SIZE });
}
