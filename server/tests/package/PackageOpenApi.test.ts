import { describe, expect, it } from "@jest/globals";
import Ajv from "ajv/dist/2020";
import { readFileSync } from "fs";
import { resolve } from "path";

import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";

// validate:schema checks the OpenAPI document; AJV here checks actual contract values against Joi.
const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi/schema.json"), "utf8"));
const ajv = new Ajv({ strict: false, validateFormats: false });
ajv.addSchema({ $id: "package-contract", components: spec.components });
const field = (schema: string, name: string) =>
  ajv.compile({ $ref: `package-contract#/components/schemas/${schema}/properties/${name}` });
const upload = uploadPackageScheme();
const hash = "a".repeat(32);

describe("Package OpenAPI contract", () => {
  it.each(["PackageListItem", "OqPackage", "PackageItem", "PackageCreateInputData"])(
    "%s accepts absent logos and file metadata, but rejects malformed logos",
    (schema) => {
      const validate = field(schema, "logo");
      expect(validate(null)).toBe(true);
      expect(validate({ file: { md5: hash, type: "image" } })).toBe(true);
      expect(validate("logo.png")).toBe(false);
    }
  );

  it.each([
    { label: "empty", value: {}, valid: true },
    { label: "MD5 and zero bytes", value: { [hash]: 0 }, valid: true },
    {
      label: "uppercase MD5 and extension",
      value: { [`${hash.toUpperCase()}.mp4`]: 42 },
      valid: true
    },
    { label: "filename", value: { "photo.jpg": 42 }, valid: false },
    { label: "short MD5", value: { [hash.slice(1)]: 42 }, valid: false },
    { label: "non-hex MD5", value: { ["g".repeat(32)]: 42 }, valid: false },
    { label: "multiple extensions", value: { [`${hash}.tar.gz`]: 42 }, valid: false },
    { label: "negative bytes", value: { [hash]: -1 }, valid: false },
    { label: "fractional bytes", value: { [hash]: 1.5 }, valid: false }
  ])("fileSizes agrees with the server for $label", ({ value, valid }) => {
    expect(field("PackageCreationInput", "fileSizes")(value)).toBe(valid);
    expect(!upload.extract("fileSizes").validate(value).error).toBe(valid);
  });

  it("matches the server's default answer delay", () => {
    const content = {
      title: "Contract test",
      ageRestriction: "NONE",
      rounds: [
        {
          name: "Round",
          order: 0,
          type: "simple",
          themes: [
            {
              name: "Theme",
              order: 0,
              questions: [
                { type: "simple", order: 0, price: 100, isHidden: false, showAnswerDuration: 5000 }
              ]
            }
          ]
        }
      ]
    };
    const { error, value } = upload.validate({ content });
    expect(error).toBeUndefined();
    expect(value.content.rounds[0].themes[0].questions[0].answerDelay).toBe(
      spec.components.schemas.PackageQuestion.properties.answerDelay.default
    );
  });
});
