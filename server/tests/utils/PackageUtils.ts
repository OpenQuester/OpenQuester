import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";

export class PackageUtils {
  constructor() {
    //
  }

  public createTestPackageData(author: ShortUserInfo): PackageDTO {
    return {
      title: "Test Game Package",
      description: "A package for testing game features",
      author,
      tags: [],
      language: "en",
      createdAt: new Date(),
      ageRestriction: AgeRestriction.NONE,
      rounds: [
        {
          name: "Round 1",
          description: "First test round",
          order: 0,
          type: PackageRoundType.SIMPLE,
          themes: [
            {
              name: "Theme 1",
              description: "First theme with different question types",
              order: 0,
              questions: [
                {
                  type: PackageQuestionType.SIMPLE,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 0,
                  price: 100,
                  text: "Simple question text",
                  answerText: "Simple answer",
                  answerDelay: 5000,
                  isHidden: false,
                },
                {
                  type: PackageQuestionType.STAKE,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 1,
                  price: 200,
                  text: "Stake question text",
                  answerText: "Stake answer",
                  answerDelay: 5000,
                  maxPrice: 400,
                  isHidden: false,
                },
                {
                  type: PackageQuestionType.SECRET,
                  subType: PackageQuestionSubType.CUSTOM_PRICE,
                  transferType: PackageQuestionTransferType.ANY,
                  order: 2,
                  price: 300,
                  text: "Secret question text",
                  answerText: "Secret answer",
                  answerDelay: 5000,
                  allowedPrices: [100, 200, 300],
                  isHidden: false,
                },
                {
                  type: PackageQuestionType.NO_RISK,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 3,
                  price: 400,
                  text: "No risk question text",
                  answerText: "No risk answer",
                  answerDelay: 5000,
                  priceMultiplier: 2,
                  isHidden: false,
                },
                {
                  type: PackageQuestionType.HIDDEN,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 4,
                  price: 500,
                  text: "Hidden question text",
                  answerText: "Hidden answer",
                  answerDelay: 5000,
                  isHidden: true,
                },
              ],
            },
          ],
        },
        {
          name: "Final Round",
          description: "Final round with choice questions",
          order: 1,
          type: PackageRoundType.FINAL,
          themes: [
            {
              name: "Multiple Choice",
              description: "Theme with choice questions",
              order: 0,
              questions: [
                {
                  type: PackageQuestionType.CHOICE,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 0,
                  price: 1000,
                  text: "Choice question text",
                  answerText: "Choice answer",
                  answerDelay: 5000,
                  showDelay: 3000,
                  isHidden: false,
                  answers: [
                    {
                      text: "Choice 1",
                      file: null,
                      order: 0,
                    },
                    {
                      text: "Choice 2",
                      file: null,
                      order: 1,
                    },
                    {
                      text: "Choice 3",
                      file: null,
                      order: 2,
                    },
                    {
                      text: "Choice 4",
                      file: null,
                      order: 3,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }
}
