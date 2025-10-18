import 'package:openapi/openapi.dart';

/// Detects media type from file extension
class MediaTypeDetector {
  const MediaTypeDetector._();

  /// Detect media type from extension
  static PackageFileType? detectType(String? extension) {
    if (extension == null) return null;
    final ext = extension.toLowerCase();

    if (_imageExtensions.contains(ext)) {
      return PackageFileType.image;
    } else if (_videoExtensions.contains(ext)) {
      return PackageFileType.video;
    } else if (_audioExtensions.contains(ext)) {
      return PackageFileType.audio;
    }
    return null;
  }

  /// Check if extension is supported
  static bool isSupported(String? extension) {
    return detectType(extension) != null;
  }

  static const _imageExtensions = {
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'avif',
  };

  static const _videoExtensions = {
    'mp4',
    'mov',
    'avi',
    'webm',
  };

  static const _audioExtensions = {
    'mp3',
    'wav',
    'ogg',
    'm4a',
    'opus',
  };

  /// Get all supported extensions
  static List<String> get allExtensions => [
    ..._imageExtensions,
    ..._videoExtensions,
    ..._audioExtensions,
  ];
}
