import Joi from "joi";
import { MAX_QUESTION_PRICE_UPLOAD } from "domain/constants/game";

const order = () => Joi.number().integer().min(0).max(2147483647);
const range = Joi.object({
  min: Joi.number().integer().min(0).max(MAX_QUESTION_PRICE_UPLOAD).required(),
  max: Joi.number().integer().min(Joi.ref("min")).max(MAX_QUESTION_PRICE_UPLOAD).required(),
  step: Joi.number().integer().min(0).max(MAX_QUESTION_PRICE_UPLOAD).required()
}).required();
const op = (name: string) => Joi.string().valid(name).required();

export const questionScriptScheme = Joi.object({
  version: Joi.number().valid(1).required(),
  answerTextItems: Joi.array()
    .items(
      Joi.object({
        order: order().required(),
        text: Joi.string()
          .max(100000)
          .when("durationMs", {
            is: Joi.number().positive().required(),
            then: Joi.string().allow(""),
            otherwise: Joi.string().pattern(/\S/)
          })
          .required(),
        durationMs: Joi.number().integer().min(0).max(120000).allow(null),
        waitForFinish: Joi.boolean(),
        placement: Joi.string().valid("screen", "replic")
      })
    )
    .max(30),
  steps: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.object({ op: op("setTheme") }),
        Joi.object({ op: op("accept") }),
        Joi.object({
          op: op("setAnswerType"),
          answerType: Joi.string().valid("text", "number", "point", "select").required(),
          optionOrders: Joi.array().items(order()).max(1000),
          correctChoiceOrder: order().allow(null)
        }),
        Joi.object({
          op: op("showContent"),
          phase: Joi.string().valid("question", "answer").required(),
          orders: Joi.array().items(order()).max(300).required(),
          revealRight: Joi.boolean()
        }),
        Joi.object({
          op: op("askAnswer"),
          mode: Joi.string().valid("button", "direct").required(),
          durationMs: Joi.number().integer().positive().max(86400000).allow(null).required()
        }),
        Joi.object({
          op: op("setAnswerer"),
          mode: Joi.string().valid("current", "byCurrent", "all").required(),
          select: Joi.string().valid("any", "exceptCurrent")
        }),
        Joi.object({
          op: op("setAnswerer"),
          mode: Joi.string().valid("stake").required(),
          select: Joi.string().valid("highest", "allPossible").required(),
          stakeVisibility: Joi.string().valid("visible", "hidden").required()
        }).custom((step, helpers) =>
          (step.select === "highest") === (step.stakeVisibility === "visible")
            ? step
            : helpers.error("any.invalid")
        ),
        Joi.object({ op: op("announcePrice"), range }),
        Joi.object({ op: op("setPrice"), mode: Joi.string().valid("select").required(), range }),
        Joi.object({
          op: op("setPrice"),
          mode: Joi.string().valid("multiply", "noRisk", "withButton", "forAll").required()
        })
      )
    )
    .min(1)
    .max(128)
    .required()
}).allow(null);
