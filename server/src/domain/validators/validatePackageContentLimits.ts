import { MAX_CONTENT_FILES_PER_STEP, MAX_CONTENT_STEPS } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { authoredContentGroups } from "domain/logic/question/authoredContentGroups";
import type { PackageDTO } from "domain/types/dto/package/PackageDTO";

/** Check both authored timelines before persisting a package or creating a game from it. */
export function validatePackageContentLimits(pack: Pick<PackageDTO, "rounds">): void {
  for (const round of pack.rounds) {
    for (const theme of round.themes) {
      for (const [index, question] of theme.questions.entries()) {
        const timelines = {
          question: authoredContentGroups({ ...question, files: question.questionFiles }),
          answer: authoredContentGroups({
            files: question.answerFiles,
            textItems: question.answerTextItems
          })
        };
        for (const [phase, groups] of Object.entries(timelines)) {
          const location = { round: round.name, theme: theme.name, question: index + 1, phase };
          if (groups.length > MAX_CONTENT_STEPS) {
            throw new ClientError(ClientResponse.PACKAGE_CONTENT_STEP_LIMIT, undefined, {
              ...location,
              actual: groups.length,
              max: MAX_CONTENT_STEPS
            });
          }
          for (const [step, group] of groups.entries()) {
            const files = group.filter((entry) => "media" in entry).length;
            if (files > MAX_CONTENT_FILES_PER_STEP) {
              throw new ClientError(ClientResponse.PACKAGE_CONTENT_FILE_LIMIT, undefined, {
                ...location,
                step: step + 1,
                actual: files,
                max: MAX_CONTENT_FILES_PER_STEP
              });
            }
          }
        }
      }
    }
  }
}
