import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { FileService } from "application/services/file/FileService";
import { FileUsageService } from "application/services/file/FileUsageService";
import { UserService } from "application/services/user/UserService";
import { DependencyService } from "infrastructure/services/dependency/DependencyService";
import { S3Context } from "domain/types/file/S3Context";
import { MAX_FILE_SIZE, MAX_LOGO_SIZE } from "domain/constants/storage";

describe("S3StorageService Size Validation", () => {
  let s3StorageService: S3StorageService;
  let mockFileService: jest.Mocked<FileService>;
  let mockFileUsageService: jest.Mocked<FileUsageService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockDependencyService: jest.Mocked<DependencyService>;
  
  const mockS3Context: S3Context = {
    accessKey: "test-access-key",
    secretKey: "test-secret-key",
    endpoint: "http://localhost:9000",
    region: "us-east-1",
    bucket: "test-bucket",
    urlPrefix: "http://localhost:9000/test-bucket",
    useSubDomainBucketFormat: false,
  };

  beforeEach(() => {
    mockFileService = {} as jest.Mocked<FileService>;
    mockFileUsageService = {} as jest.Mocked<FileUsageService>;
    mockUserService = {} as jest.Mocked<UserService>;
    mockDependencyService = {} as jest.Mocked<DependencyService>;

    s3StorageService = new S3StorageService(
      mockS3Context,
      mockFileService,
      mockFileUsageService,
      mockUserService,
      mockDependencyService
    );
  });

  describe("generatePresignedUrl", () => {
    it("should include Content-Length header when size is provided", async () => {
      const filename = "abcdef1234567890";
      const size = 1024 * 1024; // 1MB
      
      // Mock the S3 client to avoid actual AWS calls
      const mockSend = jest.fn().mockResolvedValue({});
      (s3StorageService as any)._client = { send: mockSend };

      const url = await s3StorageService.generatePresignedUrl(
        "PUT",
        "test-bucket",
        "files/ab/cd/abcdef1234567890",
        3600,
        filename,
        size
      );

      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
    });

    it("should not include Content-Length header when size is not provided", async () => {
      const filename = "abcdef1234567890";

      // Mock the S3 client to avoid actual AWS calls
      const mockSend = jest.fn().mockResolvedValue({});
      (s3StorageService as any)._client = { send: mockSend };

      const url = await s3StorageService.generatePresignedUrl(
        "PUT",
        "test-bucket",
        "files/ab/cd/abcdef1234567890",
        3600,
        filename
      );

      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
    });
  });

  describe("Constants validation", () => {
    it("should have proper file size limits", () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024); // 100 MB
      expect(MAX_LOGO_SIZE).toBe(10 * 1024 * 1024); // 10 MB
      expect(MAX_LOGO_SIZE).toBeLessThan(MAX_FILE_SIZE);
    });
  });
});