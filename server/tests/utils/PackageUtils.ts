import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import {
  PackageQuestionDTO,
  PackageQuestionSubType,
} from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";

export class PackageUtils {
  constructor() {
    //
  }

  public createTestPackageData(
    author: ShortUserInfo,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): PackageDTO {
    const rounds = [
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
              } satisfies PackageQuestionDTO,
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
              } satisfies PackageQuestionDTO,
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
              } satisfies PackageQuestionDTO,
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
              } satisfies PackageQuestionDTO,
              {
                type: PackageQuestionType.HIDDEN,
                subType: PackageQuestionSubType.SIMPLE,
                order: 4,
                price: 500,
                text: "Hidden question text",
                answerText: "Hidden answer",
                answerDelay: 5000,
                isHidden: true,
              } satisfies PackageQuestionDTO,
              {
                type: PackageQuestionType.CHOICE,
                subType: PackageQuestionSubType.SIMPLE,
                order: 5,
                price: 300,
                text: "Choice question text",
                answerText: "Choice answer",
                answerDelay: 5000,
                showDelay: 3000,
                answers: [
                  {
                    order: 0,
                    text: "Option A",
                    file: null,
                  },
                  {
                    order: 1,
                    text: "Option B",
                    file: null,
                  },
                  {
                    order: 2,
                    text: "Option C",
                    file: null,
                  },
                  {
                    order: 3,
                    text: "Option D",
                    file: null,
                  },
                ],
                isHidden: false,
              } satisfies PackageQuestionDTO,
              {
                type: PackageQuestionType.HIDDEN,
                subType: PackageQuestionSubType.SIMPLE,
                order: 6,
                price: 600,
                text: "Another hidden question text",
                answerText: "Another hidden answer",
                answerDelay: 5000,
                isHidden: true,
              } satisfies PackageQuestionDTO,
            ] as PackageQuestionDTO[],
          },
        ],
      },
    ];

    if (includeFinalRound) {
      rounds.push({
        name: "Final Round",
        description: "Final round with simple questions",
        order: 1,
        type: PackageRoundType.FINAL,
        themes: [
          {
            name: "Final Theme 1",
            description: "First final theme",
            order: 0,
            questions: [
              {
                type: PackageQuestionType.SIMPLE,
                subType: PackageQuestionSubType.SIMPLE,
                order: 0,
                price: null, // Final round questions don't have a price - players bid after theme selection
                text: "Final question text 1",
                answerText: "Final answer 1",
                answerDelay: 5000,
                isHidden: false,
              } satisfies PackageQuestionDTO,
            ] as PackageQuestionDTO[],
          },
          {
            name: "Final Theme 2",
            description: "Second final theme",
            order: 1,
            questions: [
              {
                type: PackageQuestionType.SIMPLE,
                subType: PackageQuestionSubType.SIMPLE,
                order: 0,
                price: null, // Final round questions don't have a price - players bid after theme selection
                text: "Final question text 2",
                answerText: "Final answer 2",
                answerDelay: 5000,
                isHidden: false,
              } satisfies PackageQuestionDTO,
            ] as PackageQuestionDTO[],
          },
          {
            name: "Final Theme 3",
            description: "Third final theme",
            order: 2,
            questions: [
              {
                type: PackageQuestionType.SIMPLE,
                subType: PackageQuestionSubType.SIMPLE,
                order: 0,
                price: null, // Final round questions don't have a price - players bid after theme selection
                text: "Final question text 3",
                answerText: "Final answer 3",
                answerDelay: 5000,
                isHidden: false,
              } satisfies PackageQuestionDTO,
            ] as PackageQuestionDTO[],
          },
        ],
      });
    } else {
      // Add a second simple round instead of a final round
      rounds.push({
        name: "Round 2",
        description: "Second test simple round",
        order: 1,
        type: PackageRoundType.SIMPLE,
        themes: [
          {
            name: "Theme 2",
            description: "Second theme",
            order: 0,
            questions: [
              {
                type: PackageQuestionType.SIMPLE,
                subType: PackageQuestionSubType.SIMPLE,
                order: 0,
                price: 100,
                text: "Simple question text 2",
                answerText: "Simple answer 2",
                answerDelay: 5000,
                isHidden: false,
              } satisfies PackageQuestionDTO,
            ] as PackageQuestionDTO[],
          },
        ],
      });
    }

    if (additionalSimpleQuestions > 0) {
      rounds[0].themes[0].questions.push(
        ...(Array.from({ length: additionalSimpleQuestions }, (_, index) => ({
          type: PackageQuestionType.SIMPLE,
          subType: PackageQuestionSubType.SIMPLE,
          order: rounds[0].themes[0].questions.length + index,
          price: 100 + index * 50,
          text: `Additional simple question ${index + 1}`,
          answerText: `Additional answer ${index + 1}`,
          answerDelay: 5000,
          isHidden: false,
        })) satisfies PackageQuestionDTO[])
      );
    }

    return {
      title: "Test Game Package",
      description: "A package for testing game features",
      author,
      tags: [],
      language: "en",
      createdAt: new Date(),
      ageRestriction: AgeRestriction.NONE,
      rounds,
    };
  }
}
