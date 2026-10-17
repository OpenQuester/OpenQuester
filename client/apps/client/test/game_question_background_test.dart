import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openquester/openquester.dart' hide test;
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

class _MockLogger extends Mock implements TalkerLogger {}

class _MockLobby extends Mock implements GameLobbyController {}

class _VideoPlatform extends VideoPlayerPlatform {
  bool initializeImmediately = true;
  final sources = <int, DataSource>{};
  final streams = <int, StreamController<VideoEvent>>{};
  final initialized = <int>{};
  final disposed = <int>{};
  final playing = <int>{};
  final played = <int>{};
  final positions = <int, Duration>{};
  final volumes = <int, double>{};
  Completer<void>? delayDispose;
  Completer<void>? delayNextSeek;

  @override
  Future<void> init() async {}

  @override
  Future<int?> createWithOptions(VideoCreationOptions options) async {
    final id = sources.length;
    sources[id] = options.dataSource;
    streams[id] = StreamController<VideoEvent>();
    if (initializeImmediately) completeInitialization(id);
    return id;
  }

  void completeInitialization(int id) {
    if (!initialized.add(id)) return;
    streams[id]!.add(
      VideoEvent(
        eventType: VideoEventType.initialized,
        duration: const Duration(seconds: 20),
        size: const Size(100, 100),
      ),
    );
  }

  int playerFor(String md5) {
    final ids = sources.entries
        .where((entry) => entry.value.uri?.contains(md5) ?? false)
        .map((entry) => entry.key)
        .toList();
    expect(ids, hasLength(1), reason: '$md5 needs its own media player');
    return ids.single;
  }

  @override
  Stream<VideoEvent> videoEventsFor(int playerId) => streams[playerId]!.stream;

  @override
  Future<void> play(int playerId) async {
    playing.add(playerId);
    played.add(playerId);
  }

  @override
  Future<void> pause(int playerId) async {
    playing.remove(playerId);
  }

  @override
  Future<void> dispose(int playerId) async {
    await delayDispose?.future;
    playing.remove(playerId);
    disposed.add(playerId);
  }

  @override
  Future<void> seekTo(int playerId, Duration position) async {
    final delay = delayNextSeek;
    delayNextSeek = null;
    await delay?.future;
    positions[playerId] = position;
  }

  @override
  Future<Duration> getPosition(int playerId) async =>
      positions[playerId] ?? Duration.zero;

  @override
  Future<void> setVolume(int playerId, double volume) async {
    volumes[playerId] = volume;
  }

  @override
  Future<void> setLooping(int playerId, bool looping) async {}

  @override
  Future<void> setPlaybackSpeed(int playerId, double speed) async {}

  @override
  Future<void> setMixWithOthers(bool mixWithOthers) async {}

  Future<void> close() async {
    for (final stream in streams.values) {
      await stream.close();
    }
  }
}

PackageQuestionFile _file(
  int order,
  PackageFileType type, {
  bool background = false,
  String? md5,
}) => PackageQuestionFile(
  order: order,
  displayTime: null,
  placement: background ? ContentPlacement.background : ContentPlacement.screen,
  file: FileItem(
    md5: md5 ?? 'media-$order',
    type: type,
    link: 'https://media.invalid/${md5 ?? 'media-$order'}.webm',
  ),
);

QuestionContentPlanItem _item(
  int order,
  int durationMs, {
  bool background = false,
  bool text = false,
}) => QuestionContentPlanItem(
  kind: text
      ? QuestionContentPlanItemKind.text
      : QuestionContentPlanItemKind.file,
  order: order,
  placement: background ? ContentPlacement.background : ContentPlacement.screen,
  durationMs: durationMs,
);

GameStateTimer _timer(int elapsedMs) => GameStateTimer(
  // Keep wall-clock time out of these tests: running time clamps to zero.
  startedAt: DateTime.utc(2100),
  durationMs: 30000,
  elapsedMs: elapsedMs,
);

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();
  const pathProvider = MethodChannel('plugins.flutter.io/path_provider');
  late GameQuestionController controller;
  late _VideoPlatform platform;
  late VideoPlayerPlatform previousPlatform;

  final picture = _file(0, PackageFileType.image);
  final nextPicture = _file(1, PackageFileType.image);
  final sound = _file(2, PackageFileType.audio, background: true);
  final secondSound = _file(3, PackageFileType.audio, background: true);
  final question = PackageQuestion(
    type: QuestionType.simple,
    order: 0,
    price: 100,
    showAnswerDuration: null,
    text: 'Name this sound',
    textOrder: 4,
    questionFiles: [picture, nextPicture, sound, secondSound],
  );

  QuestionContentPlan plan({bool simultaneousSounds = false}) =>
      QuestionContentPlan(
        totalMs: 6000,
        steps: [
          QuestionContentStep(
            startMs: 0,
            durationMs: 1000,
            items: [
              _item(4, 1000, text: true),
              _item(0, 1000),
              _item(2, simultaneousSounds ? 1500 : 4000, background: true),
              if (simultaneousSounds) _item(3, 4500, background: true),
            ],
          ),
          QuestionContentStep(
            startMs: 1000,
            durationMs: 5000,
            items: [_item(1, 5000)],
          ),
        ],
      );

  Future<void> flush() async {
    // Drain preparation, platform events, and the async notifier listener.
    // The server timer supplied by _timer controls the timeline position.
    for (var i = 0; i < 12; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  Future<void> start({
    int elapsedMs = 0,
    bool simultaneousSounds = false,
  }) async {
    await controller.onAllPlayersReady();
    controller.playPlan(
      question: question,
      plan: plan(simultaneousSounds: simultaneousSounds),
      timer: _timer(elapsedMs),
    );
    await flush();
  }

  setUp(() async {
    await getIt.reset();
    getIt
      ..registerSingleton<TalkerLogger>(_MockLogger())
      ..registerSingleton<GameLobbyController>(_MockLobby());
    previousPlatform = VideoPlayerPlatform.instance;
    platform = _VideoPlatform();
    VideoPlayerPlatform.instance = platform;
    // Exercise the existing network-controller fallback without real files,
    // downloads, or native path-provider registration.
    binding.defaultBinaryMessenger.setMockMethodCallHandler(
      pathProvider,
      (_) async => throw MissingPluginException('No temporary files in tests'),
    );
    controller = GameQuestionController();
  });

  tearDown(() async {
    VideoPlayerPlatform.instance = previousPlatform;
    binding.defaultBinaryMessenger.setMockMethodCallHandler(pathProvider, null);
    await getIt.reset();
  });

  void backgroundTest(
    String description,
    Future<void> Function() body,
  ) {
    test(description, () async {
      try {
        await body();
      } finally {
        platform.sources.keys.toList().forEach(platform.completeInitialization);
        await flush();
        final stopping = controller.stopPlan();
        await flush();
        await stopping;
        await controller.clear();
        await flush();
        await platform.close();
      }
    });
  }

  backgroundTest(
    'plays background audio alongside the current text and image',
    () async {
      await start();

      final id = platform.playerFor(sound.file.md5);
      expect(platform.playing, contains(id));
      expect(controller.questionData.value?.text, question.text);
      expect(controller.questionData.value?.file, picture);
    },
  );

  backgroundTest(
    'keeps the same background player when the screen step changes',
    () async {
      await start();
      final id = platform.playerFor(sound.file.md5);

      controller.resumePlan(_timer(1000));
      await flush();

      expect(controller.questionData.value?.file, nextPicture);
      expect(platform.playerFor(sound.file.md5), id);
      expect(platform.playing, contains(id));
      expect(platform.disposed, isNot(contains(id)));
    },
  );

  backgroundTest(
    'disposes background audio at its own end inside a screen step',
    () async {
      await start();
      final id = platform.playerFor(sound.file.md5);

      controller.resumePlan(_timer(3999));
      await flush();
      expect(platform.playing, contains(id));

      controller.resumePlan(_timer(4000));
      await flush();
      expect(platform.disposed, contains(id));
      expect(platform.playing, isNot(contains(id)));
      expect(controller.questionData.value?.file, nextPicture);
    },
  );

  backgroundTest('ends simultaneous backgrounds independently', () async {
    await start(simultaneousSounds: true);
    final firstId = platform.playerFor(sound.file.md5);
    final secondId = platform.playerFor(secondSound.file.md5);
    expect(firstId, isNot(secondId));
    expect(platform.playing, containsAll([firstId, secondId]));

    controller.resumePlan(_timer(1500));
    await flush();

    expect(platform.disposed, contains(firstId));
    expect(platform.disposed, isNot(contains(secondId)));
    expect(platform.playing, contains(secondId));
    expect(platform.playerFor(secondSound.file.md5), secondId);
  });

  backgroundTest('starts a later track at its own timer offset', () async {
    final laterPlan = plan();
    controller.playPlan(
      question: question,
      plan: laterPlan.copyWith(
        totalMs: laterPlan.totalMs + 2000,
        steps: laterPlan.steps
            .map((step) => step.copyWith(startMs: step.startMs + 2000))
            .toList(),
      ),
      timer: _timer(1999),
    );
    await flush();
    expect(platform.sources, isEmpty);

    controller.resumePlan(_timer(2500));
    await flush();
    final id = platform.playerFor(sound.file.md5);
    expect(platform.positions[id], const Duration(milliseconds: 500));
    expect(platform.playing, contains(id));
  });

  backgroundTest(
    'holds audio for an answer and resumes at the restored offset',
    () async {
      await start(elapsedMs: 1200);
      final id = platform.playerFor(sound.file.md5);
      expect(platform.positions[id], const Duration(milliseconds: 1200));

      controller.holdPlan();
      await flush();
      expect(platform.playing, isNot(contains(id)));
      expect(platform.disposed, isNot(contains(id)));

      controller.resumePlan(_timer(2400));
      await flush();
      expect(platform.playerFor(sound.file.md5), id);
      expect(platform.positions[id], const Duration(milliseconds: 2400));
      expect(platform.playing, contains(id));
    },
  );

  backgroundTest(
    'changes background volume with the question volume',
    () async {
      await start();
      final id = platform.playerFor(sound.file.md5);

      await controller.onChangeVolume(.25);

      expect(platform.volumes[id], VideoPlayerUtils.toLogVolume(.25));
    },
  );

  backgroundTest('stopPlan disposes all background players', () async {
    await start(simultaneousSounds: true);
    final ids = [
      platform.playerFor(sound.file.md5),
      platform.playerFor(secondSound.file.md5),
    ];

    await controller.stopPlan();
    await flush();

    expect(platform.disposed, containsAll(ids));
    expect(platform.playing, isEmpty);
  });

  backgroundTest(
    'clear disposes background players and clears question data',
    () async {
      await start();
      final id = platform.playerFor(sound.file.md5);

      await controller.clear();
      await flush();

      expect(platform.disposed, contains(id));
      expect(platform.playing, isEmpty);
      expect(controller.questionData.value, isNull);
    },
  );

  backgroundTest('an old clear cannot erase a replacement question', () async {
    await start();
    final disposal = Completer<void>();
    platform.delayDispose = disposal;
    final clearing = controller.clear();
    try {
      controller.playPlan(
        question: question.copyWith(text: 'Replacement question'),
        plan: plan(),
        timer: _timer(0),
      );
      await flush();
    } finally {
      disposal.complete();
      await clearing;
    }
    expect(controller.questionData.value?.text, 'Replacement question');
  });

  backgroundTest(
    'a delayed seek cannot overwrite a newer resume position',
    () async {
      await start();
      final id = platform.playerFor(sound.file.md5);
      final seek = Completer<void>();
      platform.delayNextSeek = seek;
      controller.resumePlan(_timer(1200));
      await flush();
      controller
        ..holdPlan()
        ..resumePlan(_timer(2400));
      await flush();
      seek.complete();
      await flush();
      expect(platform.positions[id], const Duration(milliseconds: 2400));
      expect(platform.playing, contains(id));
    },
  );

  backgroundTest('a delayed player cannot start after clear', () async {
    platform.initializeImmediately = false;
    await start();
    final id = platform.playerFor(sound.file.md5);
    expect(platform.played, isEmpty);

    final clearing = controller.clear();
    platform.completeInitialization(id);
    await flush();
    await clearing;

    expect(platform.played, isNot(contains(id)));
    expect(platform.disposed, contains(id));
    expect(controller.questionData.value, isNull);
  });

  backgroundTest(
    'a delayed player stays paused when an answer holds the plan',
    () async {
      platform.initializeImmediately = false;
      await start();
      final id = platform.playerFor(sound.file.md5);

      controller.holdPlan();
      platform.completeInitialization(id);
      await flush();
      expect(platform.played, isNot(contains(id)));

      controller.resumePlan(_timer(1200));
      await flush();
      expect(platform.positions[id], const Duration(milliseconds: 1200));
      expect(platform.playing, contains(id));
    },
  );

  backgroundTest(
    'a delayed player cannot start after its question is replaced',
    () async {
      platform.initializeImmediately = false;
      await start();
      final oldId = platform.playerFor(sound.file.md5);
      final replacement = _file(
        2,
        PackageFileType.audio,
        background: true,
        md5: 'replacement-sound',
      );

      controller.playPlan(
        question: question.copyWith(questionFiles: [picture, replacement]),
        plan: plan(),
        timer: _timer(0),
      );
      await flush();
      final replacementId = platform.playerFor(replacement.file.md5);
      platform
        ..completeInitialization(oldId)
        ..completeInitialization(replacementId);
      await flush();

      expect(platform.played, isNot(contains(oldId)));
      expect(platform.disposed, contains(oldId));
      expect(platform.playing, contains(replacementId));
    },
  );

  group('screen clips', () {
    final firstClip = _file(0, PackageFileType.audio, md5: 'first-clip');
    final secondClip = _file(1, PackageFileType.audio, md5: 'second-clip');
    final clipQuestion = PackageQuestion(
      type: QuestionType.simple,
      order: 0,
      price: 100,
      showAnswerDuration: null,
      text: 'Name this tune',
      questionFiles: [firstClip, secondClip],
    );
    final clipPlan = QuestionContentPlan(
      totalMs: 8000,
      steps: [
        QuestionContentStep(
          startMs: 0,
          durationMs: 4000,
          items: [_item(0, 4000)],
        ),
        QuestionContentStep(
          startMs: 4000,
          durationMs: 4000,
          items: [_item(1, 4000)],
        ),
      ],
    );

    backgroundTest(
      'a rejoin starts the clip at the timeline position',
      () async {
        controller.playPlan(
          question: clipQuestion,
          plan: clipPlan,
          timer: _timer(5500),
        );
        await flush();

        final id = platform.playerFor(secondClip.file.md5);
        expect(platform.positions[id], const Duration(milliseconds: 1500));
        expect(platform.playing, contains(id));
      },
    );

    backgroundTest(
      'a clip loaded before the timeline started plays from its position',
      () async {
        controller.questionData.value = GameQuestionData(
          text: clipQuestion.text,
          file: firstClip,
        );
        await flush();
        final id = platform.playerFor(firstClip.file.md5);
        expect(controller.waitingForPlayers.value, isTrue);
        expect(platform.played, isEmpty);

        controller.playPlan(
          question: clipQuestion,
          plan: clipPlan,
          timer: _timer(1500),
        );
        await flush();

        expect(platform.playerFor(firstClip.file.md5), id);
        expect(platform.positions[id], const Duration(milliseconds: 1500));
        expect(platform.playing, contains(id));
        expect(controller.waitingForPlayers.value, isFalse);
      },
    );

    backgroundTest('a slow old load cannot replace a newer step', () async {
      platform.initializeImmediately = false;
      controller.playPlan(
        question: clipQuestion,
        plan: clipPlan,
        timer: _timer(0),
      );
      await flush();
      final oldId = platform.playerFor(firstClip.file.md5);

      controller.resumePlan(_timer(4000));
      await flush();
      final newId = platform.playerFor(secondClip.file.md5);
      platform.completeInitialization(newId);
      await flush();
      platform.completeInitialization(oldId);
      await flush();

      expect(controller.questionData.value?.file, secondClip);
      expect(platform.played, isNot(contains(oldId)));
      expect(platform.disposed, contains(oldId));
      expect(platform.playing, contains(newId));
      expect(controller.mediaController.value?.playerId, newId);
    });
  });
}
