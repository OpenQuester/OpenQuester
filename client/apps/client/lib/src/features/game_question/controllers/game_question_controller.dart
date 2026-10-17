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
  final _background = <int, _BackgroundMedia>{};
  bool _planPlaying = false;
  int _planRevision = 0;

  /// Start of the screen file's step on the question timer while the
  /// timeline plays, so its clip starts at the server's position
  int? _screenStartMs;
  int? _screenEndMs;
  final _screenSync = Expando<Future<void>>();

  /// Bumped by every question data change; an older media load sees it
  /// changed and drops its player instead of showing it
  int _loadRevision = 0;

  static final Dio _cacheDio = Dio(
    BaseOptions(receiveTimeout: const Duration(seconds: 10)),
  );

  Future<void> clear() async {
    logger.d('GameQuestionController: Clearing question data');
    final stopping = stopPlan();
    final clearing = clearVideoControllers();
    _loadRevision++;
    questionData.value = null;
    error.value = null;
    showMedia.value = false;
    waitingForPlayers.value = false;
    ignoreWaitingForPlayers = false;
    await Future.wait([stopping, clearing]);
  }

  Future<void> _onQuestionChange() async {
    final load = ++_loadRevision;
    bool current() => load == _loadRevision;
    // Owned by this load until it is shown; disposed if a newer one wins
    VideoPlayerController? loaded;
    File? loadedFile;
    try {
      await clearVideoControllers();
      if (!current()) return;

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

      if (file.type != PackageFileType.image) {
        final extension = switch (file.type) {
          PackageFileType.video => 'webm',
          PackageFileType.audio => 'webm',
          _ => 'webm',
        };

        // Web: Preload media by caching it
        if (kIsWeb) {
          await _cacheFile(Uri.parse(file.link!));
          if (!current()) return;
        }

        final (
          videoController,
          tmpFile,
        ) = await VideoPlayerUtils.createController(
          url: file.link!,
          fileExtension: extension,
          // Each overlapping load owns its file, even for the same media hash.
          cacheKey:
              '${file.md5}-screen-'
              '${DateTime.now().microsecondsSinceEpoch}-$load',
        );
        loaded = videoController;
        loadedFile = tmpFile;
        if (!current()) return;

        await videoController.setVolume(
          VideoPlayerUtils.toLogVolume(volume.value),
        );
        await videoController.initialize();
        if (!current()) return;

        final waitMs = questionData.value?.file?.displayTime;
        if (waitMs != null && _plan == null) {
          // Only this load's player, and only while it is still on screen
          Future<void>.delayed(Duration(milliseconds: waitMs), () {
            if (_plan == null &&
                identical(mediaController.value, videoController)) {
              return videoController.pause();
            }
          });
        }
      }

      final controller = loaded;
      if (loadedFile != null) _tmpFile = loadedFile;
      loaded = null;
      loadedFile = null;
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
        // The timeline already runs (a later step, or a rejoin)
        waitingForPlayers.value = false;
        if (controller != null) await _playScreenMedia(controller);
      }
    } catch (e) {
      if (current()) {
        error.value = getIt<GameLobbyController>().onError(e);
        logger.e('GameQuestionController: Failed to load media: $e');
      }
    } finally {
      if (loaded != null) unawaited(_disposeMedia(loaded, loadedFile));
    }
    // TODO: Start slideshow timer
  }

  /// Starts a screen clip at the server timeline's position within its
  /// step, so a rejoin or a slow load doesn't replay it from the start and
  /// get cut off by the next step
  Future<void> _playScreenMedia(VideoPlayerController controller) =>
      _screenSync[controller] =
          (_screenSync[controller] ?? Future<void>.value()).then(
            (_) => _syncScreenMedia(controller),
          );

  Future<void> _syncScreenMedia(VideoPlayerController controller) async {
    final revision = _planRevision;
    bool current() =>
        identical(mediaController.value, controller) &&
        revision == _planRevision &&
        (_plan == null || _planPlaying);
    if (!current()) return;
    try {
      final startMs = _screenStartMs;
      if (_plan != null && startMs != null) {
        final elapsed = timerElapsedMs(_planTimer, paused: false);
        final offsetMs = elapsed < startMs ? 0 : elapsed - startMs;
        await controller.seekTo(Duration(milliseconds: offsetMs));
        if (!current()) return;
        final elapsedAfterSeek = timerElapsedMs(_planTimer, paused: false);
        if ((_screenEndMs != null && elapsedAfterSeek >= _screenEndMs!) ||
            offsetMs >= controller.value.duration.inMilliseconds) {
          await controller.pause();
          return;
        }
      }
      if (current()) await controller.play();
    } catch (e) {
      if (current()) error.value = getIt<GameLobbyController>().onError(e);
    }
  }

  Future<void> _disposeMedia(
    VideoPlayerController? controller,
    File? file,
  ) async {
    try {
      await controller?.dispose();
    } catch (e) {
      logger.w(e);
    }
    try {
      await file?.delete();
    } catch (e) {
      logger.w(e);
    }
  }

  /// Plays the question's content timeline on the server's question timer:
  /// each step shows its file or text, the way the web client does.
  void playPlan({
    required PackageQuestion question,
    required QuestionContentPlan plan,
    required GameStateTimer timer,
  }) {
    unawaited(stopPlan());
    if (plan.steps.isEmpty) return;
    _plan = plan;
    _planQuestion = question;
    _planTimer = timer;
    _planPlaying = true;
    _applyPlanStep();
  }

  /// Continues the timeline on a new timer (after a pause or a wrong answer)
  void resumePlan(GameStateTimer? timer) {
    if (_plan == null || timer == null) return;
    _stepTimer?.cancel();
    _planTimer = timer;
    _planPlaying = true;
    _applyPlanStep();
  }

  /// Holds the current step while someone answers or the game is paused
  void holdPlan() {
    _stepTimer?.cancel();
    _planPlaying = false;
    _planRevision++;
    for (final media in _background.values) {
      unawaited(
        media.controller?.pause().catchError((Object e) {
          logger.w(e);
        }),
      );
    }
  }

  Future<void> stopPlan() async {
    _stepTimer?.cancel();
    _stepTimer = null;
    _plan = null;
    _planQuestion = null;
    _planTimer = null;
    _planPlaying = false;
    _planRevision++;
    _screenStartMs = null;
    _screenEndMs = null;
    final background = _background.values.toList();
    _background.clear();
    await Future.wait(background.map((media) => media.dispose()));
  }

  void _applyPlanStep() {
    final plan = _plan;
    final question = _planQuestion;
    if (plan == null || question == null) return;

    final elapsed = timerElapsedMs(_planTimer, paused: false);
    final position = ContentPlanPosition.at(plan, elapsed);
    _planRevision++;
    _updateBackground(question, position);
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
    _screenStartMs = position.screenStartMs;
    final screenItem = position.screen.firstWhereOrNull(
      (item) =>
          item.kind == QuestionContentPlanItemKind.file &&
          item.order == fileOrder,
    );
    _screenEndMs = screenItem == null
        ? null
        : position.screenStartMs + screenItem.durationMs;
    ignoreWaitingForPlayers = true;
    if (next != questionData.value) {
      questionData.value = next;
    } else if (waitingForPlayers.value) {
      // Loaded before the timeline started (a rejoin): play it from here
      unawaited(onAllPlayersReady());
    } else {
      final controller = mediaController.value;
      if (controller != null) unawaited(_playScreenMedia(controller));
    }

    var nextAt = ContentPlanPosition.nextChangeAt(plan, elapsed);
    final screenEnd = _screenEndMs;
    if (screenEnd != null &&
        screenEnd > elapsed &&
        (nextAt == null || screenEnd < nextAt)) {
      nextAt = screenEnd;
    }
    if (nextAt != null) {
      _stepTimer = Timer(
        Duration(milliseconds: nextAt - elapsed),
        _applyPlanStep,
      );
    }
  }

  void _updateBackground(
    PackageQuestion question,
    ContentPlanPosition position,
  ) {
    final active = {for (final track in position.background) track.item.order};
    for (final order in _background.keys.toList()) {
      if (!active.contains(order)) {
        unawaited(_background.remove(order)!.dispose());
      }
    }
    for (final track in position.background) {
      final order = track.item.order;
      final existing = _background[order];
      if (existing != null) {
        if (existing.controller?.value.isInitialized ?? false) {
          unawaited(_queueBackgroundSync(existing));
        }
        continue;
      }
      final file = question.questionFiles
          ?.firstWhereOrNull((file) => file.order == order)
          ?.file;
      if (file?.type != PackageFileType.audio || file?.link == null) continue;
      final media = _BackgroundMedia(
        order,
        track.startMs,
        track.startMs + track.item.durationMs,
      );
      _background[order] = media;
      unawaited(_loadBackground(media, file!));
    }
  }

  bool _ownsBackground(_BackgroundMedia media) =>
      identical(_background[media.order], media);

  Future<void> _loadBackground(_BackgroundMedia media, FileItem file) async {
    try {
      final playerKey = DateTime.now().microsecondsSinceEpoch;
      final (controller, tmpFile) = await VideoPlayerUtils.createController(
        url: file.link!,
        fileExtension: 'webm',
        // Each player owns its file, including overlapping uses of one MD5.
        cacheKey: '${file.md5}-background-$playerKey-${media.order}',
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );
      media
        ..controller = controller
        ..tmpFile = tmpFile;
      if (!_ownsBackground(media)) {
        await media.dispose();
        return;
      }
      await controller.initialize();
      if (_ownsBackground(media)) await _queueBackgroundSync(media);
    } catch (e) {
      if (_ownsBackground(media)) {
        _background.remove(media.order);
        error.value = getIt<GameLobbyController>().onError(e);
      }
      await media.dispose();
    }
  }

  Future<void> _queueBackgroundSync(_BackgroundMedia media) =>
      media.sync = media.sync.then((_) => _syncBackground(media));

  Future<void> _syncBackground(_BackgroundMedia media) async {
    final controller = media.controller;
    final revision = _planRevision;
    bool current() =>
        _ownsBackground(media) && revision == _planRevision && _planPlaying;
    if (controller == null || !current()) return;
    try {
      await controller.setVolume(VideoPlayerUtils.toLogVolume(volume.value));
      if (!current()) return;
      final elapsed = timerElapsedMs(_planTimer, paused: false);
      if (elapsed >= media.endMs) return;
      await controller.seekTo(Duration(milliseconds: elapsed - media.startMs));
      if (current()) await controller.play();
    } catch (e) {
      if (current()) error.value = getIt<GameLobbyController>().onError(e);
    }
  }

  Future<void> clearVideoControllers() async {
    final controller = mediaController.value;
    final file = _tmpFile;
    mediaController.value = null;
    _tmpFile = null;
    await _disposeMedia(controller, file);
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
    for (final media in _background.values.toList()) {
      await media.controller?.setVolume(
        VideoPlayerUtils.toLogVolume(this.volume.value),
      );
    }
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
      final controller = mediaController.value;
      if (controller != null) await _playScreenMedia(controller);
    }
  }
}

class _BackgroundMedia {
  _BackgroundMedia(this.order, this.startMs, this.endMs);

  final int order;
  final int startMs;
  final int endMs;
  VideoPlayerController? controller;
  File? tmpFile;
  Future<void> sync = Future.value();

  Future<void> dispose() async {
    final player = controller;
    final file = tmpFile;
    controller = null;
    tmpFile = null;
    try {
      await player?.dispose();
    } catch (e) {
      logger.w(e);
    }
    try {
      await file?.delete();
    } catch (e) {
      logger.w(e);
    }
  }
}
