import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart' as ft;
import 'package:openquester/openquester.dart';

void main() {
  ft.setUpAll(() async {
    ft.TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    await EasyLocalization.ensureInitialized();
  });

  ft.setUp(() async {
    await getIt.reset();
    _registerServices();
  });

  ft.tearDown(() async {
    await getIt.reset();
  });

  ft.testWidgets('renders transparent bottom area in default mode', (
    tester,
  ) async {
    final controller = getIt<GameLobbyController>();
    controller.gameData.value = _gameData(PlayerRole.player);

    await _pumpTestApp(tester, const LobbyActionButton());

    const actionAreaKey = Key('lobby_action_button_bottom_area');
    await _pumpUntilFound(tester, ft.find.byKey(actionAreaKey));

    ft.expect(ft.find.byKey(actionAreaKey), ft.findsOneWidget);
    final bottomArea = tester.widget<Material>(ft.find.byKey(actionAreaKey));
    ft.expect(
      ft.find.byKey(const Key('lobby_action_button_floating_area')),
      ft.findsNothing,
    );
    ft.expect(bottomArea.type, MaterialType.transparency);
    ft.expect(
      tester.getSize(ft.find.byKey(actionAreaKey)).height,
      ft.lessThan(120),
    );
    ft.expect(_filledButton(), ft.findsOneWidget);

    controller.gameData.value = _gameData(
      PlayerRole.showman,
      includePlayer: false,
      readyPlayers: const [],
    );
    await tester.pumpAndSettle();
    final zeroPlayerHelper = ft.find.text(
      'No players have joined yet',
      skipOffstage: false,
    );
    await _pumpUntilFound(tester, zeroPlayerHelper);

    ft.expect(zeroPlayerHelper, ft.findsOneWidget);
    ft.expect(
      ft.find.text('No players have joined yet.', skipOffstage: false),
      ft.findsNothing,
    );

    final startButton = tester.widget<FilledButton>(_filledButton());
    final startLabelStyle = startButton.style?.textStyle?.resolve({});
    ft.expect(startLabelStyle?.fontSize, ft.greaterThanOrEqualTo(18));
    ft.expect(startLabelStyle?.fontWeight, FontWeight.w400);

    controller.gameData.value = _gameData(
      PlayerRole.showman,
      readyPlayers: const [],
    );
    await tester.pumpAndSettle();
    final notReadyHelper = ft.find.text(
      '1 player is not ready',
      skipOffstage: false,
    );
    await _pumpUntilFound(tester, notReadyHelper);

    ft.expect(notReadyHelper, ft.findsOneWidget);
    ft.expect(
      ft.find.text('1 player is not ready.', skipOffstage: false),
      ft.findsNothing,
    );

    await _disposeTestApp(tester);
  });

  ft.test('keeps bottom action visible for side overlay chat', () {
    final compactOverlay = LobbyLayoutResolver.resolve(
      availableWidth: 393,
      chatOpen: true,
    );
    final mediumOverlay = LobbyLayoutResolver.resolve(
      availableWidth: 768,
      chatOpen: true,
    );

    ft.expect(compactOverlay.chatPresentation, LobbyChatPresentation.overlay);
    ft.expect(mediumOverlay.chatPresentation, LobbyChatPresentation.overlay);
    ft.expect(
      shouldShowLobbyBottomActionArea(
        pregameLobbyVisible: true,
        showLobbyActionButton: true,
        layout: compactOverlay,
      ),
      ft.isFalse,
    );
    ft.expect(
      shouldShowLobbyBottomActionArea(
        pregameLobbyVisible: true,
        showLobbyActionButton: true,
        layout: mediumOverlay,
      ),
      ft.isTrue,
    );
    ft.expect(shouldDimLobbyBottomActionArea(compactOverlay), ft.isFalse);
    ft.expect(shouldDimLobbyBottomActionArea(mediumOverlay), ft.isTrue);
  });
}

ft.Finder _filledButton() {
  return ft.find.byWidgetPredicate((widget) => widget is FilledButton);
}

Future<void> _pumpTestApp(ft.WidgetTester tester, Widget child) async {
  await tester.binding.setSurfaceSize(null);
  tester.view.resetDevicePixelRatio();
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await tester.pumpWidget(_TestApp(child: child));
  await tester.pump();
  await tester.pumpAndSettle();
}

Future<void> _disposeTestApp(ft.WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

Future<void> _pumpUntilFound(
  ft.WidgetTester tester,
  ft.Finder finder,
) async {
  for (var attempt = 0; attempt < 30; attempt += 1) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }

  ft.fail('Expected to find widget before timeout.');
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
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

void _registerServices() {
  getIt
    ..registerSingleton(SettingsController()..settings = const AppSettings())
    ..registerSingleton(ProfileController()..user.value = _user())
    ..registerSingleton(GameLobbyController());
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

SocketIoGameJoinEventPayload _gameData(
  PlayerRole currentUserRole, {
  bool includePlayer = true,
  List<int> readyPlayers = const [3],
}) {
  return SocketIoGameJoinEventPayload(
    meta: const SocketIoGameJoinMeta(title: 'Friday Quiz'),
    players: [
      _player(id: 1, name: 'Mira', role: currentUserRole),
      _player(id: 2, name: 'Dana', role: PlayerRole.showman),
      if (includePlayer)
        _player(id: 3, name: 'Dan', role: PlayerRole.player, slot: 0),
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
    score: 0,
    status: status,
    slot: slot,
  );
}
