import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';
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

  static final Dio _cacheDio = Dio(
    BaseOptions(receiveTimeout: const Duration(seconds: 10)),
  );

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
        return;
      }

      // Wait for all players before playing
      waitingForPlayers.value = !ignoreWaitingForPlayers;

      VideoPlayerController? controller;
      if (file.type != PackageFileType.image) {
        final extension = switch (file.type) {
          PackageFileType.video => 'webm',
          PackageFileType.audio => 'webm',
          _ => 'webm',
        };

        // Web: Preload media by caching it
        if (kIsWeb) {
          await _cacheFile(Uri.parse(file.link!));
        }

        final (
          videoController,
          tmpFile,
        ) = await VideoPlayerUtils.createController(
          url: file.link!,
          fileExtension: extension,
          cacheKey: file.md5,
        );
        controller = videoController;
        _tmpFile = tmpFile;

        await controller.setVolume(VideoPlayerUtils.toLogVolume(volume.value));
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
    }
    // TODO: Start slideshow timer
  }

  Future<void> clearVideoControllers() async {
    await mediaController.value?.pause();
    mediaController.value = null;
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

  Future<void> onChangeVolume(double volume) async {
    this.volume.value = volume.clamp(0, 1);
    await mediaController.value?.setVolume(
      VideoPlayerUtils.toLogVolume(this.volume.value),
    );
  }

  Future<void> onImageLoaded() async {
    // Notify server that media is downloaded
    // Wait for all players before showing
    getIt<GameLobbyController>().notifyMediaDownloaded();
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
}
