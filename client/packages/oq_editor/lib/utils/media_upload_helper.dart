import 'package:crypto/crypto.dart' show md5;
import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:universal_io/io.dart';

/// Helper for uploading media files from editor
/// Reads files only when needed (memory efficient)
class MediaUploadHelper {
  const MediaUploadHelper({
    required this.uploadFile,
    required this.getUploadUrl,
  });

  /// Upload file bytes to storage
  final Future<void> Function({
    required Uri uploadLink,
    required String md5Hash,
    required Uint8List file,
  })
  uploadFile;

  /// Get upload URL from backend
  final Future<String> Function(String md5Hash) getUploadUrl;

  /// Upload media files and create PackageQuestionFile references
  /// Files are read from disk/bytes only when uploading (memory efficient)
  Future<List<PackageQuestionFile>> uploadMediaFiles(
    List<MediaFileReference> mediaFiles,
  ) async {
    final results = <PackageQuestionFile>[];

    for (final media in mediaFiles) {
      final packageFile = await _uploadSingleMedia(media);
      results.add(packageFile);
    }

    return results;
  }

  /// Upload single media file
  Future<PackageQuestionFile> _uploadSingleMedia(
    MediaFileReference media,
  ) async {
    // Read file bytes (only when needed)
    final bytes = await _readFileBytes(media);

    // Calculate MD5 hash
    final md5Hash = md5.convert(bytes).toString();

    // Get upload URL
    final uploadUrl = await getUploadUrl(md5Hash);

    // Upload file
    await uploadFile(
      uploadLink: Uri.parse(uploadUrl),
      md5Hash: md5Hash,
      file: bytes,
    );

    // Create FileItem reference
    final fileItem = FileItem(
      id: null,
      md5: md5Hash,
      type: media.type,
      link: null,
    );

    // Create PackageQuestionFile reference
    return PackageQuestionFile(
      id: null,
      order: media.order,
      file: fileItem,
      displayTime: media.displayTime,
    );
  }

  /// Read file bytes from platform file
  /// Only reads when needed (memory efficient)
  Future<Uint8List> _readFileBytes(MediaFileReference media) async {
    final platformFile = media.platformFile;

    // Web platform - bytes already in memory
    if (kIsWeb) {
      if (platformFile.bytes != null) {
        return platformFile.bytes!;
      }
      throw Exception('File bytes not available on web');
    }

    // Native platforms - read from file path
    if (platformFile.path != null) {
      final file = File(platformFile.path!);
      return file.readAsBytes();
    }

    throw Exception('File path not available');
  }
}
