import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    await EasyLocalization.ensureInitialized();
  });

  setUp(() async {
    await getIt.reset();
    _registerServices();
  });

  tearDown(() async {
    await getIt.reset();
  });

  testWidgets('covers lobby header, participant width, and readiness color', (
    tester,
  ) async {
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
      tester.view.resetDevicePixelRatio();
    });

    final controller = getIt<GameLobbyController>();

    await tester.binding.setSurfaceSize(const Size(431, 895));
    tester.view.devicePixelRatio = 1;
    controller
      ..gameData.value = _gameData(
        playerCount: 0,
        spectatorCount: 0,
        title: 'asdasdsadsa',
      )
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await _pumpUntilFound(tester, find.text('asdasdsadsa'));

    final titleRect = tester.getRect(find.text('asdasdsadsa'));
    final buttonRect = tester.getRect(find.text('Copy invite link'));
    expect((titleRect.center.dy - buttonRect.center.dy).abs(), lessThan(24));

    await _disposeTestApp(tester);
    await tester.binding.setSurfaceSize(const Size(1280, 720));
    controller
      ..gameData.value = _gameData(
        playerCount: 2,
        spectatorCount: 0,
        playerNames: const [
          'First Long Player Name',
          'Second Long Player Name',
        ],
        readyPlayerIds: const [2],
      )
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await _pumpUntilFound(tester, find.text('Second Long Player Name'));

    final firstPlayerRect = tester.getRect(find.text('First Long Player Name'));
    final secondPlayerRect = tester.getRect(
      find.text('Second Long Player Name'),
    );
    expect(secondPlayerRect.top, greaterThan(firstPlayerRect.bottom));
    expect(find.text('Not ready'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await _disposeTestApp(tester);
    await tester.binding.setSurfaceSize(null);
    tester.view.resetDevicePixelRatio();
    controller
      ..gameData.value = _gameData(
        playerCount: 1,
        spectatorCount: 0,
        readyPlayerIds: const [],
      )
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await _pumpUntilFound(tester, find.text('0/1 Ready'));

    final decoration = _boxDecorationForText(tester, '0/1 Ready');
    final neutralColor = AppTheme.build(
      Colors.indigo,
      Brightness.light,
    ).colorScheme.surfaceContainerHighest;
    expect(decoration.color, neutralColor);

    await tester.binding.setSurfaceSize(const Size(1280, 720));
    tester.view.devicePixelRatio = 1;
    controller
      ..gameData.value = _gameData(
        playerCount: 2,
        spectatorCount: 1,
        playerNames: const [
          'Active Player',
          'Disconnected Player',
        ],
        spectatorNames: const ['Disconnected Spectator'],
        readyPlayerIds: const [2, 3],
        disconnectedPlayerIds: const [3, 20],
      )
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await tester.pumpAndSettle();
    final activePlayer = find.text('Active Player', skipOffstage: false);
    await _pumpUntilFound(tester, activePlayer);

    expect(activePlayer, findsOneWidget);
    expect(find.text('Disconnected Player', skipOffstage: false), findsNothing);
    expect(
      find.text('Disconnected Spectator', skipOffstage: false),
      findsNothing,
    );
    expect(find.text('Players (1 / 10)', skipOffstage: false), findsOneWidget);
    expect(find.text('Spectators (0)', skipOffstage: false), findsOneWidget);
    expect(find.text('1/1 Ready', skipOffstage: false), findsOneWidget);

    await _disposeTestApp(tester);
  });
}

Future<void> _disposeTestApp(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

Future<void> _pumpUntilFound(WidgetTester tester, Finder finder) async {
  for (var attempt = 0; attempt < 30; attempt += 1) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }

  fail('Expected to find widget before timeout.');
}

BoxDecoration _boxDecorationForText(WidgetTester tester, String text) {
  final containers = find
      .ancestor(
        of: find.text(text),
        matching: find.byType(Container),
      )
      .evaluate()
      .map((element) => element.widget)
      .whereType<Container>();

  for (final container in containers) {
    final decoration = container.decoration;
    if (decoration is BoxDecoration && decoration.color != null) {
      return decoration;
    }
  }

  fail('Expected to find a decorated container for "$text".');
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return EasyLocalization(
      supportedLocales: const [Locale('en', 'US')],
      path: 'assets/localization',
      fallbackLocale: const Locale('en', 'US'),
      startLocale: const Locale('en', 'US'),
      child: Builder(
        builder: (context) => MaterialApp(
          theme: AppTheme.build(Colors.indigo, Brightness.light),
          locale: context.locale,
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          home: Scaffold(body: child),
        ),
      ),
    );
  }
}

void _registerServices() {
  getIt
    ..registerSingleton(SettingsController()..settings = const AppSettings())
    ..registerSingleton(ProfileController()..user.value = _user())
    ..registerSingleton(GameLobbyController())
    ..registerSingleton(GameLobbyEditorController())
    ..registerSingleton(GameQuestionController())
    ..registerSingleton<PackageController>(_TestPackageController());
}

class _TestPackageController extends PackageController {
  @override
  Future<OqPackage> getPackage(int id) async => _package(id);
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

SocketIoGameJoinEventPayload _gameData({
  required int playerCount,
  required int spectatorCount,
  String title = 'Friday Quiz',
  List<String>? playerNames,
  List<String>? spectatorNames,
  List<int>? readyPlayerIds,
  List<int>? disconnectedPlayerIds,
}) {
  final readyPlayers =
      readyPlayerIds ??
      [
        for (var index = 0; index < playerCount; index += 1) index + 2,
      ];

  return SocketIoGameJoinEventPayload(
    meta: SocketIoGameJoinMeta(title: title),
    players: [
      _player(id: 1, name: 'Dana', role: PlayerRole.showman),
      for (var index = 0; index < playerCount; index += 1)
        _player(
          id: index + 2,
          name: playerNames?[index] ?? 'Player $index',
          role: PlayerRole.player,
          slot: index,
          status: disconnectedPlayerIds?.contains(index + 2) ?? false
              ? PlayerDataStatus.disconnected
              : PlayerDataStatus.inGame,
        ),
      for (var index = 0; index < spectatorCount; index += 1)
        _player(
          id: index + 20,
          name: spectatorNames?[index] ?? 'Spectator $index',
          role: PlayerRole.spectator,
          status: disconnectedPlayerIds?.contains(index + 20) ?? false
              ? PlayerDataStatus.disconnected
              : PlayerDataStatus.inGame,
        ),
    ],
    gameState: GameState(
      isPaused: false,
      readyPlayers: readyPlayers,
    ),
    chatMessages: const [],
  );
}

PlayerData _player({
  required int id,
  required String name,
  required PlayerRole role,
  int? slot,
  PlayerDataStatus status = PlayerDataStatus.inGame,
}) {
  return PlayerData(
    meta: PlayerMeta(id: id, username: name),
    role: role,
    restrictionData: const PlayerRestrictions(
      muted: false,
      restricted: false,
      banned: false,
    ),
    score: 0,
    status: status,
    slot: slot,
  );
}

GameListItem _gameList() {
  return GameListItem(
    id: 'game-id',
    createdBy: const ShortUserInfo(id: 1, username: 'Dana'),
    title: 'Friday Quiz',
    createdAt: DateTime(2026),
    ageRestriction: AgeRestriction.none,
    isPrivate: false,
    players: const [],
    maxPlayers: 10,
    package: PackageItem(
      id: 10,
      title: 'General knowledge',
      createdAt: DateTime(2026),
      author: const ShortUserInfo(id: 2, username: 'Author'),
      ageRestriction: AgeRestriction.none,
      roundsCount: 1,
      questionsCount: 12,
      tags: const [],
    ),
  );
}

OqPackage _package(int id) {
  return OqPackage(
    id: id,
    title: 'General knowledge',
    createdAt: DateTime(2026),
    author: const ShortUserInfo(id: 2, username: 'Author'),
    ageRestriction: AgeRestriction.none,
    description: 'Short package used by the lobby test.',
    language: 'en',
    tags: const [],
    rounds: const [],
  );
}
