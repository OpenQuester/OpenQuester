import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart' as chat_core;
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart';

const _captureFontFamily = 'Roboto';
const _visualDebugDirectory = '.codex/visual_debug';

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // ignore: invalid_use_of_visible_for_testing_member
    SharedPreferences.setMockInitialValues({});
    await _loadCaptureFonts();
    await _cleanVisualDebugDirectory();
    await EasyLocalization.ensureInitialized();
  });

  setUp(() async {
    await getIt.reset();
    _registerServices();
  });

  tearDown(() async {
    await getIt.reset();
  });

  final matrix = <_VisualCase>[
    for (final size in _requiredSizes) ...[
      _VisualCase(size: size, chatOpen: false),
      _VisualCase(size: size, chatOpen: true),
    ],
    const _VisualCase(
      size: Size(431, 895),
      chatOpen: false,
      gameTitle: 'asdasdsadsa',
    ),
    const _VisualCase(
      size: Size(393, 877),
      chatOpen: false,
      themeMode: AppThemeMode.dark,
      seed: AppThemeSeed.teal,
      scenario: _LobbyScenarioKind.playerNotReady,
    ),
    const _VisualCase(
      size: Size(768, 1024),
      chatOpen: false,
      themeMode: AppThemeMode.pureDark,
      seed: AppThemeSeed.orange,
      scenario: _LobbyScenarioKind.fullCapacity,
    ),
    const _VisualCase(
      size: Size(768, 1024),
      chatOpen: false,
      themeMode: AppThemeMode.pureDark,
      seed: AppThemeSeed.orange,
      scenario: _LobbyScenarioKind.fullCapacity,
      expandRounds: true,
    ),
    const _VisualCase(
      size: Size(1280, 800),
      chatOpen: false,
      scenario: _LobbyScenarioKind.fullCapacity,
      expandRounds: true,
      holdRoundHeader: true,
    ),
    const _VisualCase(
      size: Size(1280, 800),
      chatOpen: false,
      seed: AppThemeSeed.green,
      scenario: _LobbyScenarioKind.spectator,
    ),
    const _VisualCase(
      size: Size(1920, 1080),
      chatOpen: true,
      themeMode: AppThemeMode.pureDark,
      seed: AppThemeSeed.deepPurple,
      scenario: _LobbyScenarioKind.zeroPlayers,
    ),
  ];

  testWidgets('capture lobby visual matrix', (tester) async {
    for (var index = 0; index < matrix.length; index += 1) {
      final visualCase = matrix[index];
      try {
        await binding.setSurfaceSize(visualCase.size);
        tester.view.devicePixelRatio = 1;
        _seedScenario(visualCase);

        final captureKey = GlobalKey();
        await tester.pumpWidget(
          _VisualApp(captureKey: captureKey, visualCase: visualCase),
        );
        await tester.pumpAndSettle();

        TestGesture? heldGesture;
        if (visualCase.expandRounds) {
          for (final title in ['Warmup', 'Final', 'Archive']) {
            final finder = find.text(title);
            if (finder.evaluate().isNotEmpty) {
              await tester.ensureVisible(finder.first);
              await tester.pumpAndSettle();
              await tester.tap(finder.first);
              await tester.pumpAndSettle();
            }
          }

          if (visualCase.holdRoundHeader) {
            final finder = find.text('Final');
            await tester.ensureVisible(finder.first);
            await tester.pumpAndSettle();
            heldGesture = await tester.startGesture(
              tester.getCenter(finder.first),
            );
            await tester.pump(const Duration(milliseconds: 160));
          }
        }

        expect(tester.takeException(), isNull);

        final layout = LobbyLayoutResolver.resolve(
          availableWidth: visualCase.size.width,
          chatOpen: visualCase.chatOpen,
        );

        if (visualCase.chatOpen && visualCase.size.width == 1280) {
          expect(layout.chatPresentation, LobbyChatPresentation.overlay);
        }
        if (visualCase.chatOpen && visualCase.size.width == 1920) {
          expect(layout.chatPresentation, LobbyChatPresentation.persistent);
        }

        final boundary =
            captureKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await boundary.toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          final outFile = File(
            '$_visualDebugDirectory/${visualCase.fileName(index)}',
          );
          await outFile.parent.create(recursive: true);
          await outFile.writeAsBytes(bytes!.buffer.asUint8List());
        });
        await heldGesture?.up();
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        await binding.setSurfaceSize(null);
      }
    }
  });
}

Future<void> _loadCaptureFonts() async {
  await Future.wait([
    _loadRobotoFont(),
    _loadMaterialIconsFont(),
  ]);
}

Future<void> _loadRobotoFont() async {
  final regular = _firstExistingFontFile([
    _flutterFontPath('Roboto-Regular.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  ]);

  if (regular == null) {
    throw StateError('No readable text font found for lobby visual capture.');
  }

  final loader = FontLoader(_captureFontFamily)
    ..addFont(_loadFontFile(regular));
  final medium = _firstExistingFontFile([
    _flutterFontPath('Roboto-Medium.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ]);

  if (medium != null) {
    loader.addFont(_loadFontFile(medium));
  }

  await loader.load();
}

Future<void> _loadMaterialIconsFont() async {
  final loader = FontLoader('MaterialIcons')
    ..addFont(_loadMaterialIconsFontData());
  await loader.load();
}

Future<ByteData> _loadMaterialIconsFontData() async {
  try {
    return await rootBundle.load('fonts/MaterialIcons-Regular.otf');
  } catch (_) {
    final file = _firstExistingFontFile([
      'build/unit_test_assets/fonts/MaterialIcons-Regular.otf',
      'build/flutter_assets/fonts/MaterialIcons-Regular.otf',
      'build/web/assets/fonts/MaterialIcons-Regular.otf',
    ]);

    if (file == null) {
      throw StateError(
        'No readable Material Icons font found for lobby visual capture.',
      );
    }

    return _loadFontFile(file);
  }
}

String _flutterFontPath(String fileName) {
  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  if (flutterRoot == null || flutterRoot.isEmpty) return fileName;

  return '$flutterRoot/engine/src/flutter/txt/third_party/fonts/$fileName';
}

File? _firstExistingFontFile(List<String> paths) {
  for (final path in paths) {
    final file = File(path);
    if (file.existsSync()) return file;
  }

  return null;
}

Future<ByteData> _loadFontFile(File file) async {
  final bytes = await file.readAsBytes();
  return ByteData.view(Uint8List.fromList(bytes).buffer);
}

Future<void> _cleanVisualDebugDirectory() async {
  final directory = Directory(_visualDebugDirectory);
  if (!directory.existsSync()) return;

  await for (final entry in directory.list()) {
    if (entry is File && entry.path.endsWith('.png')) {
      await entry.delete();
    }
  }
}

const _requiredSizes = [
  Size(393, 877),
  Size(768, 1024),
  Size(1280, 800),
  Size(1920, 1080),
];

enum _LobbyScenarioKind {
  showman,
  zeroPlayers,
  playerReady,
  playerNotReady,
  fullCapacity,
  spectator,
}

class _VisualCase {
  const _VisualCase({
    required this.size,
    required this.chatOpen,
    this.themeMode = AppThemeMode.light,
    this.seed = AppThemeSeed.indigo,
    this.scenario = _LobbyScenarioKind.showman,
    this.expandRounds = false,
    this.holdRoundHeader = false,
    this.gameTitle,
  });

  final Size size;
  final bool chatOpen;
  final AppThemeMode themeMode;
  final AppThemeSeed seed;
  final _LobbyScenarioKind scenario;
  final bool expandRounds;
  final bool holdRoundHeader;
  final String? gameTitle;

  bool get dark => themeMode.isDark;

  String fileName(int index) {
    final chat = chatOpen ? 'chat_open' : 'chat_closed';
    final dimensions = '${size.width.toInt()}x${size.height.toInt()}';
    final state = holdRoundHeader ? '_pressed' : '';
    return 'step_${(index + 1).toString().padLeft(2, '0')}_'
        '${scenario.name}_${themeMode.name}_${seed.name}_${chat}_'
        '$dimensions$state.png';
  }
}

class _VisualApp extends StatelessWidget {
  const _VisualApp({
    required this.captureKey,
    required this.visualCase,
  });

  final GlobalKey captureKey;
  final _VisualCase visualCase;

  @override
  Widget build(BuildContext context) {
    final settings = AppSettings(
      themeMode: visualCase.themeMode,
      themeSeed: visualCase.seed,
    );
    getIt<SettingsController>().settings = settings;

    return EasyLocalization(
      supportedLocales: const [Locale('en', 'US')],
      path: 'assets/localization',
      fallbackLocale: const Locale('en', 'US'),
      startLocale: const Locale('en', 'US'),
      child: Builder(
        builder: (context) => MaterialApp(
          theme: _themeWithCaptureFont(settings.lightTheme),
          darkTheme: _themeWithCaptureFont(settings.darkTheme),
          themeMode: settings.themeMode.material,
          locale: context.locale,
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: captureKey,
            child: _VisualLobbyScreen(visualCase: visualCase),
          ),
        ),
      ),
    );
  }
}

ThemeData _themeWithCaptureFont(ThemeData theme) {
  return theme.copyWith(
    textTheme: theme.textTheme.apply(fontFamily: _captureFontFamily),
    primaryTextTheme: theme.primaryTextTheme.apply(
      fontFamily: _captureFontFamily,
    ),
  );
}

class _VisualLobbyScreen extends StatelessWidget {
  const _VisualLobbyScreen({required this.visualCase});

  final _VisualCase visualCase;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final layout = LobbyLayoutResolver.resolve(
          availableWidth: constraints.maxWidth,
          chatOpen: visualCase.chatOpen,
        );
        final showAction = shouldShowLobbyActionButton(
          getIt<GameLobbyController>().gameData.value,
        );
        final showOverlayChat =
            visualCase.chatOpen &&
            layout.chatPresentation == LobbyChatPresentation.overlay;
        final showBottomAction = shouldShowLobbyBottomActionArea(
          pregameLobbyVisible: true,
          showLobbyActionButton: showAction,
          layout: layout,
        );

        return LobbyLayoutScope(
          layout: layout,
          child: Scaffold(
            appBar: AppBar(
              leading: IconButton(
                tooltip: LocaleKeys.leave_game.tr(),
                onPressed: () {},
                icon: const Icon(Icons.exit_to_app),
              ),
              actions: [
                IconButton(
                  tooltip: LocaleKeys.more_actions.tr(),
                  onPressed: () {},
                  icon: const Icon(Icons.more_vert),
                ),
                IconButton(
                  tooltip: visualCase.chatOpen
                      ? LocaleKeys.close_chat.tr()
                      : LocaleKeys.open_chat.tr(),
                  onPressed: () {},
                  icon: Icon(
                    visualCase.chatOpen
                        ? Icons.chat_bubble
                        : Icons.chat_bubble_outline,
                  ),
                ),
              ],
            ),
            bottomNavigationBar: showBottomAction
                ? _DimmedVisualBottomAction(
                    dimmed: shouldDimLobbyBottomActionArea(layout),
                    child: const LobbyActionButton(),
                  )
                : null,
            body: SafeArea(
              bottom: false,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Expanded(child: GameLobbyEditor()),
                      if (visualCase.chatOpen &&
                          layout.chatPresentation ==
                              LobbyChatPresentation.persistent) ...[
                        SizedBox(
                          width: layout.reservedChatWidth,
                          child: const _VisualChatPanel().paddingBottom(16),
                        ),
                      ],
                    ],
                  ),
                  if (showOverlayChat)
                    ColoredBox(
                      color: context.theme.colorScheme.scrim.withValues(
                        alpha: .28,
                      ),
                      child: Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: visualCase.size.width >= 700
                                ? 420
                                : double.infinity,
                          ),
                          child: const _VisualChatPanel().paddingAll(16),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _DimmedVisualBottomAction extends StatelessWidget {
  const _DimmedVisualBottomAction({
    required this.dimmed,
    required this.child,
  });

  final bool dimmed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!dimmed) return child;

    return Stack(
      children: [
        child,
        Positioned.fill(
          child: IgnorePointer(
            child: ColoredBox(
              color: context.theme.colorScheme.scrim.withValues(alpha: .28),
            ),
          ),
        ),
      ],
    );
  }
}

class _VisualChatPanel extends StatelessWidget {
  const _VisualChatPanel();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Card(
        clipBehavior: Clip.antiAlias,
        color: context.theme.colorScheme.surfaceContainer,
        child: const ChatScreen(),
      ),
    );
  }
}

void _registerServices() {
  getIt
    ..registerSingleton(SettingsController()..settings = const AppSettings())
    ..registerSingleton(ProfileController()..user.value = _user())
    ..registerSingleton(SocketChatController())
    ..registerSingleton(GameLobbyController())
    ..registerSingleton(GameLobbyEditorController())
    ..registerSingleton(GameQuestionController())
    ..registerSingleton<PackageController>(_VisualPackageController());
}

void _seedScenario(_VisualCase visualCase) {
  final lobby = getIt<GameLobbyController>();
  final gameList = _gameList(maxPlayers: visualCase.scenario.maxPlayers);
  final players = visualCase.scenario.players;
  final gameTitle =
      visualCase.gameTitle ??
      'Friday Quiz Night With An Extraordinarily Long Game Name For Layout';

  lobby
    ..gameData.value = SocketIoGameJoinEventPayload(
      meta: SocketIoGameJoinMeta(title: gameTitle),
      players: players,
      gameState: GameState(
        isPaused: false,
        readyPlayers: visualCase.scenario.readyPlayerIds,
      ),
      chatMessages: const [],
    )
    ..gameListData.value = gameList
    ..showChat.value = visualCase.chatOpen;
  _seedChatController(players);
}

void _seedChatController(List<PlayerData> players) {
  final chatController = getIt<SocketChatController>();
  chatController.chatController?.dispose();
  chatController
    ..chatController = chat_core.InMemoryChatController()
    ..user = const chat_core.User(id: '1', name: 'Mira')
    ..setUsers([
      for (final player in players)
        chat_core.User(
          id: player.meta.id.toString(),
          name: player.meta.username,
          imageSource: player.meta.avatar,
        ),
      const chat_core.User(
        id: SocketChatController.systemMessageId,
        name: 'System',
      ),
    ]);
}

class _VisualPackageController extends PackageController {
  @override
  Future<OqPackage> getPackage(int id) async => _package(id);

  @override
  OqPackage? getCachedPackage(int id) => _package(id);
}

extension on _LobbyScenarioKind {
  int get maxPlayers => switch (this) {
    _LobbyScenarioKind.fullCapacity => 4,
    _ => 8,
  };

  List<int> get readyPlayerIds => switch (this) {
    _LobbyScenarioKind.playerReady => [1],
    _LobbyScenarioKind.playerNotReady => const <int>[],
    _ => [3],
  };

  List<PlayerData> get players {
    return switch (this) {
      _LobbyScenarioKind.zeroPlayers => [
        _player(id: 1, name: 'Mira Showman Longname', role: PlayerRole.showman),
      ],
      _LobbyScenarioKind.playerReady => [
        _player(
          id: 1,
          name: 'Mira Player Ready Longname',
          role: PlayerRole.player,
        ),
        _player(id: 2, name: 'Dana Showman', role: PlayerRole.showman),
      ],
      _LobbyScenarioKind.playerNotReady => [
        _player(
          id: 1,
          name: 'Mira Player Not Ready Longname',
          role: PlayerRole.player,
        ),
        _player(id: 2, name: 'Dana Showman', role: PlayerRole.showman),
      ],
      _LobbyScenarioKind.fullCapacity => [
        _player(id: 1, name: 'Mira Showman', role: PlayerRole.showman),
        for (var index = 0; index < 4; index += 1)
          _player(
            id: index + 3,
            name: 'Player ${index + 1} With A Long Display Name',
            role: PlayerRole.player,
            slot: index,
          ),
        for (var index = 0; index < 6; index += 1)
          _player(
            id: index + 20,
            name: 'Spectator ${index + 1} Longname',
            role: PlayerRole.spectator,
          ),
      ],
      _LobbyScenarioKind.spectator => [
        _player(
          id: 1,
          name: 'Mira Spectator Longname',
          role: PlayerRole.spectator,
        ),
        _player(id: 2, name: 'Dana Showman', role: PlayerRole.showman),
        _player(id: 3, name: 'Dan Player', role: PlayerRole.player, slot: 0),
      ],
      _LobbyScenarioKind.showman => [
        _player(id: 1, name: 'Mira Showman', role: PlayerRole.showman),
        _player(
          id: 3,
          name: 'Ari With A Long Nickname That Should Truncate',
          role: PlayerRole.player,
          slot: 0,
        ),
        _player(
          id: 4,
          name: 'Dan Ready Player',
          role: PlayerRole.player,
          slot: 1,
        ),
        _player(
          id: 5,
          name: 'Noa Spectator Longname',
          role: PlayerRole.spectator,
        ),
        _player(id: 6, name: 'Eli', role: PlayerRole.spectator),
      ],
    };
  }
}

ResponseUser _user() {
  return ResponseUser(
    id: 1,
    username: 'mira',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
    isDeleted: false,
    isBanned: false,
    isGuest: false,
    permissions: const [],
    name: 'Mira',
  );
}

PlayerData _player({
  required int id,
  required String name,
  required PlayerRole role,
  PlayerDataStatus status = PlayerDataStatus.inGame,
  int? slot,
}) {
  return PlayerData(
    meta: PlayerMeta(id: id, username: name),
    role: role,
    restrictionData: const PlayerRestrictions(
      muted: false,
      restricted: false,
      banned: false,
    ),
    score: id * 100,
    status: status,
    slot: slot,
  );
}

GameListItem _gameList({required int maxPlayers}) {
  return GameListItem(
    id: 'visual-game-id',
    createdBy: const ShortUserInfo(id: 1, username: 'Mira'),
    title: 'Friday Quiz Night',
    createdAt: DateTime(2026),
    ageRestriction: AgeRestriction.none,
    isPrivate: false,
    players: const [],
    maxPlayers: maxPlayers,
    package: PackageItem(
      id: 10,
      title: 'Knowledge Pack With A Long Title',
      createdAt: DateTime(2026),
      author: const ShortUserInfo(id: 2, username: 'Author'),
      ageRestriction: AgeRestriction.a16,
      roundsCount: 9,
      questionsCount: 27,
      tags: const [],
    ),
  );
}

OqPackage _package(int id) {
  return OqPackage(
    id: id,
    title:
        'Knowledge Pack With A Long Title That Must Stay On One Or Two Lines',
    createdAt: DateTime(2026),
    author: const ShortUserInfo(id: 2, username: 'Author'),
    ageRestriction: AgeRestriction.a16,
    description:
        'A balanced set for a quick friendly game. It includes fast text '
        'questions, media prompts, and mixed rounds without exposing answers.',
    language: 'en',
    tags: const [],
    rounds: [
      _round(0, 'Warmup', 3, 3),
      _round(1, 'Final', 2, 1, type: PackageRoundType.valueFinal),
      _round(2, 'Archive', 2, 1),
      _round(3, 'Lightning With A Long Round Name', 2, 1),
      _round(4, 'Visuals', 2, 1),
      _round(5, 'Audio', 2, 1),
      _round(6, 'Places', 2, 1),
      _round(7, 'Teams', 2, 1),
      _round(8, 'Final Mix', 2, 1),
    ],
  );
}

PackageRound _round(
  int order,
  String name,
  int themeCount,
  int questionsPerTheme, {
  PackageRoundType type = PackageRoundType.simple,
}) {
  return PackageRound(
    order: order,
    name: name,
    type: type,
    themes: [
      for (var theme = 0; theme < themeCount; theme += 1)
        PackageTheme(
          order: theme,
          name: 'Theme ${theme + 1} With A Very Long Public Name',
          questions: [
            for (var question = 0; question < questionsPerTheme; question += 1)
              PackageQuestionUnion.simple(
                order: question,
                price: (question + 1) * 100,
                showAnswerDuration: 5000,
                text: 'Hidden question text',
                answerText: 'Hidden answer',
              ),
          ],
        ),
    ],
  );
}
