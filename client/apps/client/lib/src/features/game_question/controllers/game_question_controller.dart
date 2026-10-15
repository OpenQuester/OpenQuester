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

  // Content timeline: which file or text is on screen, step by step
  QuestionContentPlan? _plan;
  PackageQuestion? _planQuestion;
  GameStateTimer? _planTimer;
  Timer? _stepTimer;

  static final Dio _cacheDio = Dio(
    BaseOptions(receiveTimeout: const Duration(seconds: 10)),
  );

  Future<void> clear() async {
    logger.d('GameQuestionController: Clearing question data');
    stopPlan();
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

        await videoController.setVolume(
          VideoPlayerUtils.toLogVolume(volume.value),
        );
        await videoController.initialize();

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

      // Notify server that media is downloaded, with the clip's length so
      // the content timeline (and the buzzer) wait for it to play
      if (!ignoreWaitingForPlayers) {
        final duration = controller?.value.duration;
        getIt<GameLobbyController>().notifyMediaDownloaded(
          mediaDurations: duration == null || duration == Duration.zero
              ? null
              : [
                  MediaDurations(
                    md5: file.md5,
                    durationMs: duration.inMilliseconds,
                  ),
                ],
        );
      } else {
        await mediaController.value?.play();
      }
    } catch (e) {
      error.value = getIt<GameLobbyController>().onError(e);
      logger.e('GameQuestionController: Failed to load media: $e');
    }
    // TODO: Start slideshow timer
  }

  /// Plays the question's content timeline on the server's question timer:
  /// each step shows its file or text, the way the web client does.
  void playPlan({
    required PackageQuestion question,
    required QuestionContentPlan plan,
    required GameStateTimer timer,
  }) {
    stopPlan();
    if (plan.steps.isEmpty) return;
    _plan = plan;
    _planQuestion = question;
    _planTimer = timer;
    _applyPlanStep();
  }

  /// Continues the timeline on a new timer (after a pause or a wrong answer)
  void resumePlan(GameStateTimer? timer) {
    if (_plan == null || timer == null) return;
    _stepTimer?.cancel();
    _planTimer = timer;
    _applyPlanStep();
  }

  /// Holds the current step while someone answers or the game is paused
  void holdPlan() => _stepTimer?.cancel();

  void stopPlan() {
    _stepTimer?.cancel();
    _stepTimer = null;
    _plan = null;
    _planQuestion = null;
    _planTimer = null;
  }

  void _applyPlanStep() {
    final plan = _plan;
    final question = _planQuestion;
    if (plan == null || question == null) return;

    final elapsed = timerElapsedMs(_planTimer, paused: false);
    final position = ContentPlanPosition.at(plan, elapsed);
    final fileOrder = position.fileOrder;
    final file = fileOrder == null
        ? null
        : question.questionFiles?.firstWhereOrNull((f) => f.order == fileOrder);
    // Text without its own step stays as a caption the whole time
    final caption = question.textOrder == null ? question.text : null;
    final next = GameQuestionData(
      text: position.showsText ? question.text : caption,
      file: file,
    );
    if (next != questionData.value) {
      ignoreWaitingForPlayers = true;
      questionData.value = next;
    }

    final nextAt = ContentPlanPosition.nextChangeAt(plan, elapsed);
    if (nextAt != null) {
      _stepTimer = Timer(
        Duration(milliseconds: nextAt - elapsed),
        _applyPlanStep,
      );
    }
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
    // Later steps of the timeline and answers need no handshake
    if (ignoreWaitingForPlayers) return;
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
