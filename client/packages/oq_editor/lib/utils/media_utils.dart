import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';

/// Returns appropriate icon for media type
IconData getMediaIcon(PackageFileType type) {
  return switch (type) {
    PackageFileType.image => Icons.image,
    PackageFileType.video => Icons.video_library,
    PackageFileType.audio => Icons.music_note,
    PackageFileType.$unknown => Icons.file_present,
  };
}

/// Formats file size to human readable string
String formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  if (bytes < 1024 * 1024 * 1024) {
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
  return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
}
