import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { setTestEnvDefaults } from "tests/utils/utils";

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

describe("Environment", () => {
  beforeEach(() => {
    setTestEnvDefaults();
  });

  it("should parse ADMIN_EMAILS safely when env is not set", () => {
    delete process.env.ADMIN_EMAILS;

    const env = Environment.getInstance(createLoggerMock(), { overwrite: true });
    env.load(true);

    expect(env.ADMIN_EMAILS).toEqual([]);
  });

  it("should parse ADMIN_EMAILS safely when env value is literal undefined", () => {
    process.env.ADMIN_EMAILS = "undefined";

    const env = Environment.getInstance(createLoggerMock(), { overwrite: true });
    env.load(true);

    expect(env.ADMIN_EMAILS).toEqual([]);
  });

  it("should parse and normalize ADMIN_EMAILS values", () => {
    process.env.ADMIN_EMAILS = " Admin@example.com ,admin@example.com, second@example.com ";

    const env = Environment.getInstance(createLoggerMock(), { overwrite: true });
    env.load(true);

    expect(env.ADMIN_EMAILS).toEqual([
      "admin@example.com",
      "second@example.com",
    ]);
  });
});
