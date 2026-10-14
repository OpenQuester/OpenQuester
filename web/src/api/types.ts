import type { components } from "./schema";

type S = components["schemas"];

export type User = S["ResponseUser"];
export type GameListItem = S["GameListItem"];
export type PaginatedGames = S["PaginatedGames"];
export type PackageListItem = S["PackageListItem"];
export type PaginatedPackages = S["PaginatedPackages"];
export type OqPackage = S["OqPackage"];
export type PackageRound = S["PackageRound"];
export type PackageTheme = S["PackageTheme"];
export type PackageQuestion = S["PackageQuestionUnion"];
export type GameCreateData = S["GameCreateData"];
export type GameUpdateData = S["GameUpdateData"];
export type AgeRestriction = S["AgeRestriction"];
export type PlayerRole = S["PlayerRole"];
export type GameEventSubscription = S["GameEventSubscription"];
export type GameSettings = S["GameSettings"];
export type ButtonPressMode = S["ButtonPressMode"];
export type GameTimerSettings = S["GameTimerSettings"];
export type WrongAnswerPenalty = S["WrongAnswerPenalty"];
