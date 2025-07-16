# File Size Validation and Content-Length Header Implementation

## Summary of Changes

This implementation addresses GitHub issue #161 by adding Content-Length header support in S3 presigned URLs and file size validation.

## Key Changes Made

### 1. Storage Constants (`/src/domain/constants/storage.ts`)
- Added `MAX_FILE_SIZE = 100 MB` for general files
- Added `MAX_LOGO_SIZE = 10 MB` for logo files

### 2. Schema Validation (`/src/presentation/schemes/`)
- **fileSchemes.ts**: Added `fileUploadBodyScheme()` to validate size parameter in request body
- **packageSchemes.ts**: Updated file schemas to include required `size` field with proper limits

### 3. Data Transfer Objects
- **FileDTO**: Added optional `size?: number` field
- **PackageFileDTO**: Added optional `size?: number` field for package files

### 4. S3 Storage Service (`/src/infrastructure/services/storage/S3StorageService.ts`)
- Updated `generatePresignedUrl()` to accept optional `size` parameter
- When size is provided, adds `Content-Length` header to S3 PutObject command
- Updated `upload()` and `performFileUpload()` methods to handle size parameter
- Updated `generatePresignedUrls()` to use file sizes from FileDTO objects

### 5. File Upload Controller (`/src/presentation/controllers/rest/FileRestApiController.ts`)
- Updated `uploadFile()` endpoint to require size in request body
- Validates size parameter using new schema

### 6. Package Repository (`/src/infrastructure/database/repositories/PackageRepository.ts`)
- Modified file creation to extract size from package data and include in FileDTO objects
- Handles logo files, question files, answer files, and choice answer files

## API Changes

### File Upload Endpoint
```
POST /v1/files/:filename
Body: { "size": 1048576 }
```

### Package Upload Endpoint
```
POST /v1/packages/
Body: {
  "content": {
    // ... package data with file objects including size field
    "logo": {
      "file": {
        "md5": "...",
        "type": "image",
        "size": 512000  // size in bytes
      }
    }
  }
}
```

## Validation Rules

- File size must be a positive integer
- General files: 1 byte ≤ size ≤ 100 MB
- Logo files: 1 byte ≤ size ≤ 10 MB
- Size is required for all file upload operations

## Testing

- Created validation tests for schema validation
- Added manual verification script (`verify-size-validation.mjs`)
- All build and lint checks pass

## How It Works

1. **Client Request**: Client sends file hash (filename) and size to server
2. **Server Validation**: Server validates size is within limits
3. **Presigned URL Generation**: Server generates S3 presigned URL with Content-Length header
4. **Client Upload**: Client uploads file to S3 using presigned URL with size restriction

This ensures that:
- File uploads are limited by size before reaching S3
- S3 enforces the Content-Length restriction during upload
- Invalid or oversized files are rejected at the API level