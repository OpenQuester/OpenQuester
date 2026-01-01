import 'package:crypto/crypto.dart' show md5;
import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_shared/oq_shared.dart';

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
    List<UiMediaFile> mediaFiles,
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
    UiMediaFile media,
  ) async {
    // Read file bytes (only when needed)
    final bytes = await _readFileBytes(media.reference);

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
      md5: md5Hash,
      type: media.type,
    );

    // Create PackageQuestionFile reference
    return PackageQuestionFile(
      order: media.order,
      file: fileItem,
      displayTime: media.displayTime,
    );
  }

  /// Read file bytes from platform file
  /// Only reads when needed (memory efficient)
  Future<Uint8List> _readFileBytes(MediaFileReference media) async {
    return media.platformFile.readBytes();
  }
}
