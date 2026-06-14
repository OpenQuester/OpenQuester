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

  testWidgets('keeps player drag feedback passive in both lobby layouts', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 720));
    tester.view.devicePixelRatio = 1;
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
    });

    final lobbyController = getIt<GameLobbyController>()
      ..gameData.value = _gameData(started: false)
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await tester.pumpAndSettle();

    {
      final enabledInkWellsBeforeDrag = _enabledInkWellCount(tester);
      final sourcePlayer = find.text('Dan');
      final spectatorGroup = find.text('Spectators');

      expect(sourcePlayer, findsOneWidget);
      expect(spectatorGroup, findsOneWidget);

      final gesture = await tester.startGesture(tester.getCenter(sourcePlayer));
      await gesture.moveTo(tester.getCenter(spectatorGroup));
      await tester.pump();

      expect(_enabledInkWellCount(tester), enabledInkWellsBeforeDrag);
      expect(tester.takeException(), isNull);

      await gesture.up();
      await tester.pumpAndSettle();
    }
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();

    lobbyController
      ..gameData.value = _gameData()
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    await tester.pumpAndSettle();

    {
      final sourcePlayer = find.text('Dan');
      final spectatorDropTarget = find.text('Drag or tap to set as spectator');

      expect(sourcePlayer, findsOneWidget);
      expect(spectatorDropTarget, findsOneWidget);
      expect(find.byType(PlayerEditBtn), findsNWidgets(2));

      final gesture = await tester.startGesture(tester.getCenter(sourcePlayer));
      await gesture.moveTo(tester.getCenter(spectatorDropTarget));
      await tester.pump();

      expect(find.text('Release to set as spectator'), findsOneWidget);
      expect(find.byType(PlayerEditBtn), findsNWidgets(2));
      expect(tester.takeException(), isNull);

      await gesture.up();
      await tester.pumpAndSettle();
    }
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
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

int _enabledInkWellCount(WidgetTester tester) {
  return tester
      .widgetList<InkWell>(find.byType(InkWell))
      .where((widget) => widget.onTap != null || widget.onSecondaryTap != null)
      .length;
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

SocketIoGameJoinEventPayload _gameData({bool started = true}) {
  return SocketIoGameJoinEventPayload(
    meta: const SocketIoGameJoinMeta(title: 'Friday Quiz'),
    players: [
      _player(id: 1, name: 'Mira', role: PlayerRole.showman),
      _player(id: 2, name: 'Dan', role: PlayerRole.player, slot: 0),
      _player(id: 3, name: 'Ari', role: PlayerRole.player, slot: 1),
    ],
    gameState: GameState(
      isPaused: false,
      readyPlayers: started ? null : [2, 3],
      currentRound: started
          ? const SocketIoGameStateRoundData(
              order: 0,
              name: 'Warmup',
              type: PackageRoundType.simple,
              themes: [],
            )
          : null,
    ),
    chatMessages: const [],
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
    createdBy: const ShortUserInfo(id: 1, username: 'Mira'),
    title: 'Friday Quiz',
    createdAt: DateTime(2026),
    ageRestriction: AgeRestriction.none,
    isPrivate: false,
    players: const [],
    maxPlayers: 4,
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
