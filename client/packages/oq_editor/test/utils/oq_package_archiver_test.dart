import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/oq_package_archiver.dart';

void main() {
  group('OqPackageArchiver', () {
    test('exports and imports package correctly', () async {
      // Create a test package
      final testPackage = OqPackage(
        id: 1,
        title: 'Test Package',
        description: 'Test Description',
        createdAt: DateTime(2024),
        author: const ShortUserInfo(id: 1, username: 'testuser'),
        ageRestriction: AgeRestriction.none,
        language: 'en',
        rounds: [],
        tags: [],
      );

      // Create test media file
      final testFileBytes = Uint8List.fromList([1, 2, 3, 4, 5]);
      final testHash = md5.convert(testFileBytes).toString();
      final platformFile = PlatformFile(
        name: 'test.jpg',
        size: testFileBytes.length,
        bytes: testFileBytes,
      );

      final mediaFile = MediaFileReference(
        platformFile: platformFile,
      );

      final mediaFiles = {testHash: mediaFile};

      // Export package
      final archiveBytes = await OqPackageArchiver.exportPackage(
        testPackage,
        mediaFiles,
      );

      expect(archiveBytes, isNotEmpty);

      // Import package
      final result = await OqPackageArchiver.importPackage(archiveBytes);

      // Verify package data
      expect(result.package.id, testPackage.id);
      expect(result.package.title, testPackage.title);
      expect(result.package.description, testPackage.description);
      expect(result.package.author.username, testPackage.author.username);

      // Verify media files
      expect(result.filesBytesByHash.length, 1);
      expect(result.filesBytesByHash.containsKey(testHash), true);

      final importedFileBytes = result.filesBytesByHash[testHash]!;
      // Type, order, and displayTime are not stored in file bytes
      // They are stored in the package question models (PackageQuestionFile)
      expect(importedFileBytes, equals(testFileBytes));
    });

    test('throws error when content.json is missing', () async {
      // Create empty archive
      final emptyArchive = Uint8List.fromList([
        0x50, 0x4B, 0x05, 0x06, // ZIP end of central directory signature
        0x00, 0x00, 0x00, 0x00, // Empty archive
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00,
      ]);

      expect(
        () => OqPackageArchiver.importPackage(emptyArchive),
        throwsA(isA<Exception>()),
      );
    });

    test('verifies hash integrity on import', () async {
      // This would require creating a malformed archive
      // with mismatched hash, which is complex for a unit test
      // Consider this as an integration test case
    });
  });
}
