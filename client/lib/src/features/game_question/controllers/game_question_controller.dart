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

  File? _tmpFile;

  Future<void> clear() async {
    logger.d('Clearing question data');
    questionData.value = null;
    error.value = null;
    showMedia.value = false;
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

      if (file == null) return;

      VideoPlayerController? controller;
      if (file.type != PackageFileType.image) {
        final uri = Uri.parse(file.link!);

        // Fixes loading media without file extension
        final desktopPlatform =
            !kIsWeb &&
            (Platform.isMacOS || Platform.isWindows || Platform.isLinux);
        if (desktopPlatform) {
          await _setTmpFile(file);
          await getIt<DioController>().client.downloadUri(uri, _tmpFile!.path);
          controller = VideoPlayerController.file(_tmpFile!);
        } else {
          controller = VideoPlayerController.networkUrl(uri);
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

      // Delay to let others players to download
      await Future<void>.delayed(const Duration(milliseconds: 500));

      mediaController.value = controller;
      await controller?.play();
      showMedia.value = true;
    } catch (e) {
      error.value = getIt<GameLobbyController>().onError(e);
    }
    // TODO: Start slideshow timer
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

  Future<void> onChangeVolume(double volume) async {
    this.volume.value = volume.clamp(0, 1);
    await mediaController.value?.setVolume(this.volume.value);
  }
}
