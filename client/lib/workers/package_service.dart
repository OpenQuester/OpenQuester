import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:openapi/openapi.dart';
import 'package:openquester/workers/models/worker_models.dart';
import 'package:openquester/workers/package_service.activator.g.dart';
import 'package:oq_shared/data/consts.dart';
import 'package:siq_file/siq_file.dart';
import 'package:squadron/squadron.dart';

part 'package_service.worker.g.dart';

/// Unified package processing service with multiple methods
@SquadronService(baseUrl: '/workers')
class PackageWorkerService {
  /// Parse OQ package file
  @SquadronMethod()
  Future<OqParseResult> parseOqPackage(Uint8List fileData) async {
    try {
      // Decode zip archive
      final archive = ZipDecoder().decodeBytes(fileData);

      // Find content.json
      final contentFile = archive.files.firstWhere(
        (file) => file.name == oqContentFileName,
        orElse: () =>
            throw Exception('Invalid OQ package: content.json not found'),
      );

      // Parse package content
      final contentJson = utf8.decode(contentFile.content as List<int>);
      final packageData = jsonDecode(contentJson) as Map<String, dynamic>;

      // Extract file hashes from files directory
      final fileHashes = <String>{};
      final filesBytesByHash = <String, Uint8List>{};

      for (final file in archive.files) {
        if (file.name.startsWith('files/')) {
          final hash = file.name.substring(6); // Remove 'files/' prefix
          fileHashes.add(hash);
          filesBytesByHash[hash] = file.content;
        }
      }

      // Check for encoded files metadata
      List<String>? encodedFileHashes;
      try {
        final encodedFile = archive.files.firstWhere(
          (file) => file.name == oqEncodedFilesFileName,
        );
        final encodedJson = utf8.decode(encodedFile.content as List<int>);
        final encodedList = jsonDecode(encodedJson) as List<dynamic>;
        encodedFileHashes = encodedList.cast<String>();
      } catch (_) {
        // encoded_files.json is optional
      }

      return OqParseResult(
        package: packageData,
        fileHashes: fileHashes.toList(),
        filesBytesByHash: filesBytesByHash,
        encodedFileHashes: encodedFileHashes,
      );
    } catch (e) {
      throw Exception('Failed to parse OQ package: $e');
    }
  }

  /// Encode OQ package to archive bytes
  @SquadronMethod()
  Future<List<int>> encodeOqPackage(OqEncodeInput input) async {
    try {
      // Create archive
      final archive = Archive();

      // Add package content
      final contentBytes = utf8.encode(jsonEncode(input.package));
      final contentFile = ArchiveFile(
        oqContentFileName,
        contentBytes.length,
        contentBytes,
      );
      archive.addFile(contentFile);

      // Add encoded files metadata if provided
      if (input.encodedFileHashes != null &&
          input.encodedFileHashes!.isNotEmpty) {
        final encodedBytes = utf8.encode(
          jsonEncode(input.encodedFileHashes!.toList()),
        );
        final encodedFile = ArchiveFile(
          oqEncodedFilesFileName,
          encodedBytes.length,
          encodedBytes,
        );
        archive.addFile(encodedFile);
      }

      // Add media files
      for (final entry in input.mediaFilesBytes.entries) {
        final hash = entry.key;
        final fileBytes = Uint8List.fromList(entry.value);
        final file = ArchiveFile('files/$hash', fileBytes.length, fileBytes);
        archive.addFile(file);
      }

      // Encode to zip
      final encoder = ZipEncoder();
      return encoder.encode(archive);
    } catch (e) {
      throw Exception('Failed to encode OQ package: $e');
    }
  }

  /// Parse SIQ file
  @SquadronMethod()
  Future<SiqParseResult> parseSiqFile(Uint8List fileData) async {
    final parser = SiqArchiveParser();
    late PackageCreateInputData siqFile;
    await parser.load(fileData);
    try {
      siqFile = await parser.parse();
      final body = PackageCreationInput(content: siqFile).toJson();
      final files = parser.filesHash.map(
        (a, b) {
          final content = parser.filesHash[a]?.firstOrNull?.content;
          if (content == null || content.isEmpty) {
            throw Exception('File content missing for hash $a');
          }
          return MapEntry(a, content);
        },
      );
      return SiqParseResult(body: body, files: files);
    } finally {
      await parser.dispose();
    }
  }
}
