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
    getIt
      ..registerSingleton(SettingsController()..settings = const AppSettings())
      ..registerSingleton(TimeController())
      ..registerSingleton(GamePreviewController())
      ..registerSingleton<PackageController>(_TestPackageController());
  });

  tearDown(() async {
    await getIt.reset();
  });

  testWidgets('keeps expanded preview join button inside the card header', (
    tester,
  ) async {
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
      tester.view.resetDevicePixelRatio();
    });

    await tester.binding.setSurfaceSize(const Size(700, 900));
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(
      _TestApp(
        child: GamePreviewScreen(
          gameId: _game.id,
          item: (_game, const Size(320, 120)),
        ),
      ),
    );
    await _pumpUntilFound(tester, find.text('Join game'));

    final buttonFinder = find.ancestor(
      of: find.text('Join game'),
      matching: find.byWidgetPredicate(
        (widget) => widget is ButtonStyleButton,
      ),
    );
    expect(buttonFinder, findsOneWidget);

    final buttonRect = tester.getRect(buttonFinder);
    final cardRect = tester.getRect(find.byType(Card).first);

    expect(buttonRect.width, lessThan(220));
    expect(buttonRect.bottom, lessThanOrEqualTo(cardRect.top + 128));
    expect(cardRect.right - buttonRect.right, lessThan(32));

    await _disposeTestApp(tester);
  });

  testWidgets('does not render the join button in package details', (
    tester,
  ) async {
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
      tester.view.resetDevicePixelRatio();
    });

    await tester.binding.setSurfaceSize(const Size(600, 800));
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_TestApp(child: GamePreviewBottom(game: _game)));
    await tester.pumpAndSettle();

    expect(find.text('Join game'), findsNothing);

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
          home: AnimationConfigurationClass.synchronized(
            duration: Durations.short2,
            child: Scaffold(body: child),
          ),
        ),
      ),
    );
  }
}

class _TestPackageController extends PackageController {
  @override
  Future<OqPackage> getPackage(int id) async => _package;
}

final _game = GameListItem(
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

final _package = OqPackage(
  id: 10,
  title: 'General knowledge',
  createdAt: DateTime(2026),
  author: const ShortUserInfo(id: 2, username: 'Author'),
  ageRestriction: AgeRestriction.none,
  description: 'Short package used by the preview test.',
  language: 'en',
  tags: const [],
  rounds: const [],
);
