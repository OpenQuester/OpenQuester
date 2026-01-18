import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  maxWorkers: 1,
  // tsyringe requires reflect-metadata to be imported before any tests
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^application/(.*)$": "<rootDir>/src/application/$1",
    "^domain/(.*)$": "<rootDir>/src/domain/$1",
    "^infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^presentation/(.*)$": "<rootDir>/src/presentation/$1",
    "^tests/(.*)$": "<rootDir>/tests/$1",
  },
  moduleDirectories: ["node_modules"],
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};

export default config;
