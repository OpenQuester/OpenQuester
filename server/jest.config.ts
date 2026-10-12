import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  maxWorkers: 1,
  // Individual waits stay narrowly bounded; hooks need room to run every
  // independent cleanup step and report their aggregate instead of being preempted.
  testTimeout: 30000,
  testResultsProcessor: "<rootDir>/scripts/test/failOnOpenHandles.cjs",
  // tsyringe requires reflect-metadata to be imported before any tests
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^application/(.*)$": "<rootDir>/src/application/$1",
    "^domain/(.*)$": "<rootDir>/src/domain/$1",
    "^infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^presentation/(.*)$": "<rootDir>/src/presentation/$1",
    "^bootstrap/(.*)$": "<rootDir>/src/bootstrap/$1",
    "^shared/(.*)$": "<rootDir>/src/shared/$1",
    "^tests/(.*)$": "<rootDir>/tests/$1"
  },
  moduleDirectories: ["node_modules"],
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
  }
};

export default config;
