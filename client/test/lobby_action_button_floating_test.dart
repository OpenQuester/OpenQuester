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

  ft.testWidgets('renders action button in floating mode', (tester) async {
    getIt<GameLobbyController>().gameData.value = _gameData(PlayerRole.player);
    ft.expect(
      shouldShowLobbyActionButton(getIt<GameLobbyController>().gameData.value),
      ft.isTrue,
    );

    await _pumpTestApp(tester, const LobbyActionButton(floating: true));

    ft.expect(
      ft.find.byKey(const Key('lobby_action_button_bottom_area')),
      ft.findsNothing,
    );
    ft.expect(
      ft.find.byKey(const Key('lobby_action_button_floating_area')),
      ft.findsOneWidget,
    );
    ft.expect(_filledButton(), ft.findsOneWidget);
    await _disposeTestApp(tester);
  });

  ft.testWidgets('does not render floating action for spectators', (
    tester,
  ) async {
    getIt<GameLobbyController>().gameData.value = _gameData(
      PlayerRole.spectator,
    );

    await _pumpTestApp(tester, const LobbyActionButton(floating: true));

    ft.expect(
      ft.find.byKey(const Key('lobby_action_button_floating_area')),
      ft.findsNothing,
    );
    ft.expect(_filledButton(), ft.findsNothing);
    await _disposeTestApp(tester);
  });
}

ft.Finder _filledButton() {
  return ft.find.byWidgetPredicate((widget) => widget is FilledButton);
}

Future<void> _pumpTestApp(ft.WidgetTester tester, Widget child) async {
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

SocketIoGameJoinEventPayload _gameData(PlayerRole currentUserRole) {
  return SocketIoGameJoinEventPayload(
    meta: const SocketIoGameJoinMeta(title: 'Friday Quiz'),
    players: [
      _player(id: 1, name: 'Mira', role: currentUserRole),
      _player(id: 2, name: 'Dana', role: PlayerRole.showman),
      _player(id: 3, name: 'Dan', role: PlayerRole.player, slot: 0),
    ],
    gameState: const GameState(
      isPaused: false,
      readyPlayers: [3],
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
