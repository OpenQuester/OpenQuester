import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:universal_io/io.dart';

/// Utility class for archiving/unarchiving OQ packages
/// Archive structure:
/// /content.json - serialized OqPackage model
/// /files/{md5} - media files with MD5 hash as filename
class OqPackageArchiver {
  /// Export package to .oq archive
  /// Returns the archive bytes ready for download
  static Future<Uint8List> exportPackage(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash, [
    Map<String, Uint8List>? importedFileBytes,
  ]) async {
    final archive = Archive();

    // Add content.json
    final contentJson = jsonEncode(package.toJson());
    final contentBytes = utf8.encode(contentJson);
    archive.addFile(
      ArchiveFile('content.json', contentBytes.length, contentBytes),
    );

    // Add media files from MediaFileReference (newly added files)
    for (final entry in mediaFilesByHash.entries) {
      final hash = entry.key;
      final mediaFile = entry.value;

      // Get file bytes
      Uint8List fileBytes;
      if (mediaFile.platformFile.bytes != null) {
        fileBytes = mediaFile.platformFile.bytes!;
      } else if (mediaFile.platformFile.path != null) {
        // Read from path if bytes not available
        final file = File(mediaFile.platformFile.path!);
        fileBytes = await file.readAsBytes();
      } else {
        throw Exception('Cannot export: file has no bytes or path');
      }

      // Add to archive with path: files/{hash}
      archive.addFile(
        ArchiveFile(
          'files/$hash',
          fileBytes.length,
          fileBytes,
        ),
      );
    }

    // Add imported file bytes (from previous import)
    if (importedFileBytes != null) {
      for (final entry in importedFileBytes.entries) {
        final hash = entry.key;
        final fileBytes = entry.value;

        // Skip if already added from mediaFilesByHash
        if (mediaFilesByHash.containsKey(hash)) continue;

        // Add to archive with path: files/{hash}
        archive.addFile(
          ArchiveFile(
            'files/$hash',
            fileBytes.length,
            fileBytes,
          ),
        );
      }
    }

    // Encode to zip
    final zipEncoder = ZipEncoder();
    final zipBytes = zipEncoder.encode(archive);

    return Uint8List.fromList(zipBytes);
  }

  /// Import package from .oq archive bytes
  /// Returns the package and a map of file bytes by hash
  static Future<PackageImportResult> importPackage(
    Uint8List archiveBytes,
  ) async {
    // Decode zip archive
    final zipDecoder = ZipDecoder();
    final archive = zipDecoder.decodeBytes(archiveBytes);

    // Find and parse content.json
    final contentFile = archive.findFile('content.json');
    if (contentFile == null) {
      throw Exception('Invalid .oq file: missing content.json');
    }

    final contentJson = utf8.decode(contentFile.content as List<int>);
    final packageJson = jsonDecode(contentJson) as Map<String, dynamic>;
    final package = OqPackage.fromJson(packageJson);

    // Extract media files as raw bytes
    // We don't create MediaFileReference because type/order/displayTime
    // are already stored in the package JSON (PackageQuestionFile objects)
    final filesBytesByHash = <String, Uint8List>{};
    final filesDir = archive.files.where(
      (file) => file.name.startsWith('files/') && file.isFile,
    );

    for (final file in filesDir) {
      // Extract hash from filename (files/{hash})
      final hash = file.name.split('/').last;

      // Get file bytes
      final fileBytes = Uint8List.fromList(file.content as List<int>);

      // Verify hash matches content
      final computedHash = md5.convert(fileBytes).toString();
      if (computedHash != hash) {
        throw Exception(
          'Hash mismatch for file $hash: computed $computedHash',
        );
      }

      filesBytesByHash[hash] = fileBytes;
    }

    return PackageImportResult(
      package: package,
      filesBytesByHash: filesBytesByHash,
    );
  }

  /// Save archive bytes to file using file picker
  /// Extension will be .oq
  static Future<void> saveArchiveToFile(
    Uint8List archiveBytes,
    String packageTitle,
  ) async {
    // Sanitize filename
    final sanitizedTitle = packageTitle
        .replaceAll(RegExp(r'[^\w\s-]'), '')
        .replaceAll(RegExp(r'\s+'), '_');

    final fileName =
        '${sanitizedTitle}_${DateTime.now().millisecondsSinceEpoch}';

    // Use file_picker to save file
    await FilePicker.platform.saveFile(
      fileName: fileName,
      bytes: archiveBytes,
      allowedExtensions: ['oq'],
      lockParentWindow: true,
      type: FileType.custom,
    );
  }

  /// Pick .oq file using file picker
  /// Returns the file bytes or null if cancelled
  static Future<Uint8List?> pickArchiveFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['oq'],
      withData: true, // Ensure bytes are loaded (important for web)
    );

    if (result == null || result.files.isEmpty) {
      return null;
    }

    final pickedFile = result.files.first;

    if (pickedFile.bytes != null) {
      return pickedFile.bytes;
    } else if (pickedFile.path != null) {
      // Read from path if bytes not available (non-web platforms)
      final file = File(pickedFile.path!);
      return file.readAsBytes();
    }

    return null;
  }
}

/// Result of package import
class PackageImportResult {
  PackageImportResult({
    required this.package,
    required this.filesBytesByHash,
  });

  final OqPackage package;

  /// Raw file bytes keyed by MD5 hash
  /// Type, order, and displayTime metadata are in the package JSON
  final Map<String, Uint8List> filesBytesByHash;
}
