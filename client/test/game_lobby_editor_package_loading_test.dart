import 'dart:async';

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

  testWidgets('shows package panel only when package data is available', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 720));
    tester.view.devicePixelRatio = 1;
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
    });

    final packageController =
        getIt<PackageController>() as _PendingPackageController;
    getIt<GameLobbyController>()
      ..gameData.value = _gameData()
      ..gameListData.value = _gameList();

    await tester.pumpWidget(const _TestApp(child: GameLobbyEditor()));
    const packagePanelKey = Key('lobby_package_overview_panel');

    await tester.pump();
    expect(find.byKey(packagePanelKey), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);

    packageController.completePackage(_package(10));
    await _pumpUntilFound(tester, find.byKey(packagePanelKey));
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pump();
    await tester.binding.setSurfaceSize(const Size(1280, 720));
    await tester.pump();

    expect(find.text('General knowledge'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
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
    ..registerSingleton<PackageController>(_PendingPackageController());
}

class _PendingPackageController extends PackageController {
  final Completer<OqPackage> _packageCompleter = Completer<OqPackage>();
  OqPackage? _cachedPackage;

  @override
  OqPackage? getCachedPackage(int id) {
    final package = _cachedPackage;
    if (package?.id != id) return null;
    return package;
  }

  @override
  Future<OqPackage> getPackage(int id) {
    final package = getCachedPackage(id);
    if (package != null) return Future.value(package);
    return _packageCompleter.future;
  }

  void completePackage(OqPackage package) {
    _cachedPackage = package;
    _packageCompleter.complete(package);
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

SocketIoGameJoinEventPayload _gameData({bool extraPlayer = false}) {
  return SocketIoGameJoinEventPayload(
    meta: const SocketIoGameJoinMeta(title: 'Friday Quiz'),
    players: [
      _player(id: 1, name: 'Mira', role: PlayerRole.spectator),
      _player(id: 2, name: 'Dana', role: PlayerRole.showman),
      if (extraPlayer)
        _player(id: 3, name: 'Ari', role: PlayerRole.player, slot: 0),
    ],
    gameState: const GameState(isPaused: false),
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
    maxPlayers: 2,
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
