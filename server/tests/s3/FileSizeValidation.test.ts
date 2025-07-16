import { fileUploadBodyScheme } from "presentation/schemes/file/fileSchemes";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";
import { MAX_FILE_SIZE, MAX_LOGO_SIZE } from "domain/constants/storage";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

describe("File Size Validation Schemas", () => {
  describe("fileUploadBodyScheme", () => {
    it("should accept valid file size", () => {
      const validData = {
        size: 1024 * 1024, // 1MB
      };

      const validator = new RequestDataValidator(validData, fileUploadBodyScheme());
      expect(() => validator.validate()).not.toThrow();
    });

    it("should reject file size exceeding MAX_FILE_SIZE", () => {
      const invalidData = {
        size: MAX_FILE_SIZE + 1,
      };

      const validator = new RequestDataValidator(invalidData, fileUploadBodyScheme());
      expect(() => validator.validate()).toThrow();
    });

    it("should reject zero file size", () => {
      const invalidData = {
        size: 0,
      };

      const validator = new RequestDataValidator(invalidData, fileUploadBodyScheme());
      expect(() => validator.validate()).toThrow();
    });

    it("should reject negative file size", () => {
      const invalidData = {
        size: -1,
      };

      const validator = new RequestDataValidator(invalidData, fileUploadBodyScheme());
      expect(() => validator.validate()).toThrow();
    });

    it("should reject non-integer file size", () => {
      const invalidData = {
        size: 1024.5,
      };

      const validator = new RequestDataValidator(invalidData, fileUploadBodyScheme());
      expect(() => validator.validate()).toThrow();
    });
  });

  describe("uploadPackageScheme - file size validation", () => {
    const validPackageData = {
      content: {
        title: "Test Package",
        description: "Test Description",
        ageRestriction: "0+",
        rounds: [
          {
            name: "Round 1",
            order: 0,
            description: null,
            type: "normal",
            themes: [
              {
                name: "Theme 1",
                order: 0,
                description: null,
                questions: [
                  {
                    price: 100,
                    order: 0,
                    type: "simple",
                    text: "Question text",
                    answerText: "Answer text",
                    questionFiles: [
                      {
                        file: {
                          md5: "abcdef1234567890",
                          type: "image",
                          size: 1024 * 1024, // 1MB
                        },
                        displayTime: 5000,
                        order: 0,
                      },
                    ],
                    answerFiles: [
                      {
                        file: {
                          md5: "fedcba0987654321",
                          type: "audio",
                          size: 2 * 1024 * 1024, // 2MB
                        },
                        displayTime: 3000,
                        order: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        logo: {
          file: {
            md5: "logofile123456789",
            type: "image",
            size: 512 * 1024, // 512KB (within logo limit)
          },
        },
      },
    };

    it("should accept valid package with file sizes", () => {
      const validator = new RequestDataValidator(validPackageData, uploadPackageScheme());
      expect(() => validator.validate()).not.toThrow();
    });

    it("should reject package with question file exceeding MAX_FILE_SIZE", () => {
      const invalidData = JSON.parse(JSON.stringify(validPackageData));
      invalidData.content.rounds[0].themes[0].questions[0].questionFiles[0].file.size = MAX_FILE_SIZE + 1;

      const validator = new RequestDataValidator(invalidData, uploadPackageScheme());
      expect(() => validator.validate()).toThrow();
    });

    it("should reject package with logo exceeding MAX_LOGO_SIZE", () => {
      const invalidData = JSON.parse(JSON.stringify(validPackageData));
      invalidData.content.logo.file.size = MAX_LOGO_SIZE + 1;

      const validator = new RequestDataValidator(invalidData, uploadPackageScheme());
      expect(() => validator.validate()).toThrow();
    });

    it("should reject package with zero file size", () => {
      const invalidData = JSON.parse(JSON.stringify(validPackageData));
      invalidData.content.rounds[0].themes[0].questions[0].questionFiles[0].file.size = 0;

      const validator = new RequestDataValidator(invalidData, uploadPackageScheme());
      expect(() => validator.validate()).toThrow();
    });
  });
});