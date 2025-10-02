import 'dart:async';

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
  final showMedia = ValueNotifier<bool>(false);
  final error = ValueNotifier<String?>(null);
  final volume = ValueNotifier<double>(.5);
  final waitingForPlayers = ValueNotifier<bool>(false);

  File? _tmpFile;

  Future<void> clear() async {
    questionData.value = null;
    error.value = null;
    showMedia.value = false;
    waitingForPlayers.value = false;
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
        getIt<GameLobbyController>().notifyMediaDownloaded();
        return;
      }

      VideoPlayerController? controller;
      if (file.type != PackageFileType.image) {
        final uri = Uri.parse(file.link!);

        // Platform-specific media handling for proper preloading
        if (kIsWeb) {
          // Web: Use network URL (cannot save to file system)
          controller = VideoPlayerController.networkUrl(uri);
        } else {
          // Mobile/Desktop: Download and use local file for reliable preloading
          await _setTmpFile(file);
          await getIt<DioController>().client.downloadUri(uri, _tmpFile!.path);
          controller = VideoPlayerController.file(_tmpFile!);
        }

        await controller.setVolume(volume.value);
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
      // Wait for all players before playing
      waitingForPlayers.value = true;
      getIt<GameLobbyController>().notifyMediaDownloaded();
    } catch (e) {
      error.value = getIt<GameLobbyController>().onError(e);
    }
    // TODO: Start slideshow timer
  }

  /// Called by GameLobbyController when all players have downloaded media
  Future<void> onAllPlayersReady() async {
    if (waitingForPlayers.value) {
      waitingForPlayers.value = false;
      await mediaController.value?.play();
    }
  }

  Future<void> _setTmpFile(FileItem file) async {
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
  }

  Future<void> clearVideoControllers() async {
    await mediaController.value?.pause();
    mediaController.value = null;
  }

  void onChangeVolume(double volume) {
    this.volume.value = volume.clamp(0, 1);
    mediaController.value?.setVolume(this.volume.value);
  }
}
