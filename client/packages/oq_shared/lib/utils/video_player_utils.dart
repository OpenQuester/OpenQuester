import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Utility for creating VideoPlayerController
/// with platform-specific optimizations
class VideoPlayerUtils {
  VideoPlayerUtils._();

  static final Dio _cacheDio = Dio(
    BaseOptions(receiveTimeout: const Duration(seconds: 10)),
  );

  /// Creates a VideoPlayerController from a URL with platform-specific handling
  ///
  /// On web: Uses network URL
  /// On mobile/desktop: Downloads file locally for reliable playback
  ///
  /// Returns a record (controller, tempFile) where tempFile must be deleted
  /// when the controller is disposed
  ///
  /// [url] The media URL to load
  /// [fileExtension] Optional file extension (e.g., 'mp4', 'mp3')
  /// [cacheKey] Optional cache key (e.g., file MD5 hash)
  static Future<(VideoPlayerController, File?)> createController({
    required String url,
    String? fileExtension,
    String? cacheKey,
  }) async {
    final uri = Uri.parse(url);

    // Platform-specific media handling for proper preloading
    if (kIsWeb) {
      // Web: Browsers do not support file system access,
      // so we use the network URL.
      return (VideoPlayerController.networkUrl(uri), null);
    } else {
      try {
        // Mobile/Desktop: Download and use local file for reliable preloading
        final tmpFile = await _getTempFile(
          cacheKey ?? uri.hashCode.toString(),
          fileExtension ?? 'mp4',
        );
        await _cacheDio.downloadUri(uri, tmpFile.path);
        return (VideoPlayerController.file(tmpFile), tmpFile);
      } catch (e) {
        debugPrint(
          'VideoPlayerUtils.createController: '
          'Failed to preload media from $uri: $e',
        );
        // Fallback to network URL if download fails
        return (VideoPlayerController.networkUrl(uri), null);
      }
    }
  }

  static Future<File> _getTempFile(String cacheKey, String extension) async {
    final tmpDir = await getTemporaryDirectory();
    return File(
      [
        tmpDir.path,
        '$cacheKey.$extension',
      ].join(Platform.pathSeparator),
    );
  }

  // Volume conversion utilities

  static const double minVol = 0.003;
  static const double maxVol = 1;
  static final double _b = math.log(maxVol / minVol);

  /// Converts linear volume (0-1) to logarithmic scale for natural perception
  static double toLogVolume(double linear) =>
      minVol * math.exp(_b * linear.clamp(minVol, maxVol));
}
