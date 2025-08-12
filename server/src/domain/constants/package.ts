import { Package } from "infrastructure/database/models/package/Package";

export const PACKAGE_SELECT_FIELDS: Array<keyof Package> = [
  "id",
  "title",
  "description",
  "age_restriction",
  "created_at",
  "language",
];

// Minimal relations for lightweight listings or shallow fetch (used in lists)
export const PACKAGE_SELECT_RELATIONS: string[] = ["logo", "author", "tags"];

// Full graph required for detailed package view / gameplay (rounds -> themes -> questions)
export const PACKAGE_DETAILED_RELATIONS: string[] = [
  "logo",
  "author",
  "tags",
  "rounds",
  "rounds.themes",
  "rounds.themes.questions",
  "rounds.themes.questions.questionFiles",
  "rounds.themes.questions.questionFiles.file",
  "rounds.themes.questions.answerFiles",
  "rounds.themes.questions.answerFiles.file",
  "rounds.themes.questions.answers",
];
