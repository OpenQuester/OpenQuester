import 'dart:convert';

import 'package:archive/archive_io.dart';
import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/siq_import_helper.dart';
import 'package:universal_io/io.dart';

/// Utility class for archiving/unarchiving OQ packages
/// Archive structure:
/// /content.json - serialized OqPackage model
/// /encoded_files.json - metadata about which files were encoded (optional)
/// /files/{md5} - media files with MD5 hash as filename
class OqPackageArchiver {
  /// Export package to .oq archive
  /// Returns the archive bytes ready for download
  static Future<Uint8List> exportPackage(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash, {
    Set<String>? encodedFileHashes,
  }) async {
    // Prepare media files map by reading bytes from all sources
    final mediaFilesBytes = <String, Uint8List>{};

    // Add media files from MediaFileReference (includes both new and imported)
    for (final entry in mediaFilesByHash.entries) {
      final hash = entry.key;
      final mediaFile = entry.value;

      // Get file bytes
      if (mediaFile.platformFile.bytes != null) {
        mediaFilesBytes[hash] = mediaFile.platformFile.bytes!;
      } else if (mediaFile.platformFile.path != null) {
        // Read from path if bytes not available
        final file = File(mediaFile.platformFile.path!);
        mediaFilesBytes[hash] = await file.readAsBytes();
      } else {
        throw Exception('Cannot export: file has no bytes or path');
      }
    }

    // Run heavy encoding in isolate
    return compute(
      _encodePackageArchive,
      _EncodeArchiveParams(
        package: package,
        mediaFilesBytes: mediaFilesBytes,
        encodedFileHashes: encodedFileHashes,
      ),
    );
  }

  /// Isolate-safe function to encode package archive
  static Uint8List _encodePackageArchive(_EncodeArchiveParams params) {
    final archive = Archive();

    // Add content.json
    final contentJson = jsonEncode(params.package.toJson());
    final contentBytes = utf8.encode(contentJson);
    archive.addFile(
      ArchiveFile('content.json', contentBytes.length, contentBytes),
    );

    // Add encoded_files.json metadata if encoded files exist
    if (params.encodedFileHashes != null &&
        params.encodedFileHashes!.isNotEmpty) {
      final encodedFilesJson = jsonEncode({
        'encoded_files': params.encodedFileHashes!.toList(),
        'version': 1, // For future compatibility
      });
      final encodedFilesBytes = utf8.encode(encodedFilesJson);
      archive.addFile(
        ArchiveFile(
          'encoded_files.json',
          encodedFilesBytes.length,
          encodedFilesBytes,
        ),
      );
    }

    // Add all media files
    for (final entry in params.mediaFilesBytes.entries) {
      final hash = entry.key;
      final fileBytes = entry.value;

      archive.addFile(
        ArchiveFile(
          'files/$hash',
          fileBytes.length,
          fileBytes,
        ),
      );
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
    // Run heavy decoding in isolate
    return compute(_decodePackageArchive, archiveBytes);
  }

  /// Isolate-safe function to decode package archive
  static PackageImportResult _decodePackageArchive(Uint8List archiveBytes) {
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

    // Read encoded files metadata if available
    Set<String>? encodedFileHashes;
    final encodedFilesFile = archive.findFile('encoded_files.json');
    if (encodedFilesFile != null) {
      try {
        final encodedFilesJson = utf8.decode(
          encodedFilesFile.content as List<int>,
        );
        final encodedFilesData =
            jsonDecode(encodedFilesJson) as Map<String, dynamic>;
        final encodedFilesList =
            encodedFilesData['encoded_files'] as List<dynamic>?;
        if (encodedFilesList != null) {
          encodedFileHashes = encodedFilesList.cast<String>().toSet();
        }
      } catch (e) {
        // If parsing fails, just continue without encoded files info
        // This maintains backward compatibility with older archives
      }
    }

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
      encodedFileHashes: encodedFileHashes,
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
        '${sanitizedTitle}_${DateTime.now().millisecondsSinceEpoch}.oq';

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
    final fileResult = await SiqImportHelper.pickPackageFile();
    if (fileResult == null) return null;

    // Validate that it's an OQ file
    if (fileResult.extension != 'oq') {
      throw Exception(
        'Expected .oq file, got .${fileResult.extension}. '
        'Please select an OQ package file.',
      );
    }

    return fileResult.bytes;
  }
}

/// Result of package import
class PackageImportResult {
  PackageImportResult({
    required this.package,
    required this.filesBytesByHash,
    this.encodedFileHashes,
  });

  final OqPackage package;

  /// Raw file bytes keyed by MD5 hash
  /// Type, order, and displayTime metadata are in the package JSON
  final Map<String, Uint8List> filesBytesByHash;

  /// Set of file hashes that were encoded/compressed in the original export
  /// Used to populate MediaFileEncoder cache to avoid re-encoding
  final Set<String>? encodedFileHashes;
}

/// Parameters for encoding package archive in isolate
class _EncodeArchiveParams {
  _EncodeArchiveParams({
    required this.package,
    required this.mediaFilesBytes,
    this.encodedFileHashes,
  });

  final OqPackage package;
  final Map<String, Uint8List> mediaFilesBytes;

  /// Set of file hashes that were encoded/compressed
  final Set<String>? encodedFileHashes;
}
