import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

@singleton
class GameQuestionController {
  late final questionData = ValueNotifier<GameQuestionData?>(null)
    ..addListener(_onQuestionChange);
  final mediaController = ValueNotifier<VideoPlayerController?>(null);
  final error = ValueNotifier<String?>(null);
  final volume = ValueNotifier<double>(.5);
  final showMedia = ValueNotifier<bool>(false);
  final waitingForPlayers = ValueNotifier<bool>(false);

  File? _tmpFile;
  bool ignoreWaitingForPlayers = false;

  Future<void> clear() async {
    logger.d('GameQuestionController: Clearing question data');
    questionData.value = null;
    error.value = null;
    showMedia.value = false;
    waitingForPlayers.value = false;
    ignoreWaitingForPlayers = false;
    await clearVideoControllers();
    try {
      await _tmpFile?.delete();
    } catch (e) {
      logger.w(e);
    }
    _tmpFile = null;
  }

  Future<void> _onQuestionChange() async {
    try {
      await clearVideoControllers();

      final file = questionData.value?.file?.file;

      if (file == null) {
        // No media, notify immediately
        if (!ignoreWaitingForPlayers) {
          getIt<GameLobbyController>().notifyMediaDownloaded();
        }
        logger.d('GameQuestionController: No media file for question ');
        return;
      }

      // Wait for all players before playing
      waitingForPlayers.value = !ignoreWaitingForPlayers;

      VideoPlayerController? controller;
      if (file.type != PackageFileType.image) {
        final uri = Uri.parse(file.link!);

        // Platform-specific media handling for proper preloading
        controller = await _loadController(uri, file);

        await controller.setVolume(_toLogVolume(volume.value));
        await controller.initialize();

        final waitMs = questionData.value?.file?.displayTime;
        if (waitMs != null) {
          Future<void>.delayed(
            Duration(milliseconds: waitMs),
            () => mediaController.value?.pause(),
          );
        }
      }

      mediaController.value = controller;
      showMedia.value = true;

      // Notify server that media is downloaded
      if (!ignoreWaitingForPlayers) {
        getIt<GameLobbyController>().notifyMediaDownloaded();
      } else {
        await mediaController.value?.play();
      }
    } catch (e) {
      error.value = getIt<GameLobbyController>().onError(e);
      logger.e('GameQuestionController: Failed to load media: $e');
    }
    // TODO: Start slideshow timer
  }

  static final Dio _cacheDio = Dio(
    BaseOptions(receiveTimeout: const Duration(seconds: 10)),
  );

  Future<VideoPlayerController> _loadController(
    Uri uri,
    FileItem file,
  ) async {
    try {
      // Platform-specific media handling for proper preloading
      if (kIsWeb) {
        // Web: Browsers do not support file system access,
        // so we use the network URL.
        // To improve performance, we preload the media by caching it.
        await _cacheFile(uri);
        return VideoPlayerController.networkUrl(uri);
      } else {
        // Mobile/Desktop: Download and use local file for reliable preloading
        final tmpfile = await _setTmpFile(file);
        await _cacheDio
            .downloadUri(uri, _tmpFile!.path)
            .timeout(const Duration(seconds: 5));
        return VideoPlayerController.file(tmpfile);
      }
    } catch (e) {
      logger.d(
        'GameQuestionController._loadController: '
        'Failed to preload media from $uri: $e',
      );
      return VideoPlayerController.networkUrl(uri);
    }
  }

  Future<void> _cacheFile(Uri uri) async {
    try {
      await _cacheDio.getUri<void>(uri);
    } catch (e) {
      logger.d(
        'GameQuestionController._cacheFile: '
        'Failed to preload media from $uri: $e',
      );
    }
  }

  /// Called by GameLobbyController when all players have downloaded media
  Future<void> onAllPlayersReady() async {
    logger.d(
      'GameQuestionController: All players ready, starting media playback '
      'waitingForPlayers.value: ${waitingForPlayers.value}',
    );
    if (waitingForPlayers.value) {
      waitingForPlayers.value = false;
      showMedia.value = true;
      await mediaController.value?.play();
    }
  }

  Future<File> _setTmpFile(FileItem file) async {
    final tmpDir = await getTemporaryDirectory();
    final extension = switch (file.type) {
      PackageFileType.video => 'mp4',
      PackageFileType.audio => 'mp3',
      PackageFileType.image => 'webp',
      _ => throw UnimplementedError(),
    };
    _tmpFile = File(
      [
        tmpDir.path,
        [file.md5, extension].join('.'),
      ].join(Platform.pathSeparator),
    );
    return _tmpFile!;
  }

  Future<void> clearVideoControllers() async {
    await mediaController.value?.pause();
    mediaController.value = null;
  }

  Future<void> onChangeVolume(double volume) async {
    this.volume.value = volume.clamp(0, 1);
    await mediaController.value?.setVolume(_toLogVolume(this.volume.value));
  }

  Future<void> onImageLoaded() async {
    // Notify server that media is downloaded
    // Wait for all players before showing
    getIt<GameLobbyController>().notifyMediaDownloaded();
  }

  static const minVol = 0.015;
  static const maxVol = 1;
  static final double b = math.log(maxVol / minVol);

  double _toLogVolume(double linear) =>
      minVol * math.exp(b * linear.clamp(0, 1));
}
