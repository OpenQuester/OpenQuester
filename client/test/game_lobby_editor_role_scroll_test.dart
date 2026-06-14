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

  testWidgets('scrolls role sections only when they occupy more than one row', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 720));
    tester.view.devicePixelRatio = 1;
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
    });

    final lobbyController = getIt<GameLobbyController>()
      ..gameData.value = _gameData(playerCount: 2, spectatorCount: 1)
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await _pumpUntilFound(tester, find.text('Showman'));

    expect(_scrollableCountForRole(tester, 'Showman'), 0);
    expect(_scrollableCountForRole(tester, 'Players', exact: false), 0);
    expect(_scrollableCountForRole(tester, 'Spectators'), 0);

    lobbyController.gameData.value = _gameData(
      playerCount: 3,
      spectatorCount: 3,
    );
    await tester.pump();
    expect(_scrollableCountForRole(tester, 'Players', exact: false), 1);
    expect(_scrollableCountForRole(tester, 'Spectators'), 1);
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

int _scrollableCountForRole(
  WidgetTester tester,
  String roleTitle, {
  bool exact = true,
}) {
  final titleFinder = exact
      ? find.text(roleTitle)
      : find.textContaining(roleTitle);
  final roleGroup = find
      .ancestor(
        of: titleFinder,
        matching: find.byType(DragTarget<PlayerData>),
      )
      .first;

  return find
      .descendant(
        of: roleGroup,
        matching: find.byType(Scrollable),
      )
      .evaluate()
      .length;
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
}) {
  return SocketIoGameJoinEventPayload(
    meta: const SocketIoGameJoinMeta(title: 'Friday Quiz'),
    players: [
      _player(id: 1, name: 'Dana', role: PlayerRole.showman),
      for (var index = 0; index < playerCount; index += 1)
        _player(
          id: index + 2,
          name: 'Player $index',
          role: PlayerRole.player,
          slot: index,
        ),
      for (var index = 0; index < spectatorCount; index += 1)
        _player(
          id: index + 20,
          name: 'Spectator $index',
          role: PlayerRole.spectator,
        ),
    ],
    gameState: GameState(
      isPaused: false,
      readyPlayers: [
        for (var index = 0; index < playerCount; index += 1) index + 2,
      ],
    ),
    chatMessages: const [],
  );
}

PlayerData _player({
  required int id,
  required String name,
  required PlayerRole role,
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
    score: 0,
    status: PlayerDataStatus.inGame,
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
