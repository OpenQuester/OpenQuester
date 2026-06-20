import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
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
    await EasyLocalization.ensureInitialized();
  });

  setUp(() async {
    await getIt.reset();
    getIt
      ..registerSingleton(SettingsController()..settings = const AppSettings())
      ..registerSingleton(TimeController())
      ..registerSingleton<PackageController>(_VisualPackageController());
  });

  tearDown(() async {
    await getIt.reset();
  });

  testWidgets('capture expanded game preview card', (tester) async {
    await binding.setSurfaceSize(const Size(700, 900));
    tester.view.devicePixelRatio = 1;

    final captureKey = GlobalKey();
    await tester.pumpWidget(_VisualApp(captureKey: captureKey));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    final boundary =
        captureKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final outFile = File(
        '$_visualDebugDirectory/game_preview_join_button_700x900.png',
      );
      await outFile.parent.create(recursive: true);
      await outFile.writeAsBytes(bytes!.buffer.asUint8List());
    });

    await binding.setSurfaceSize(null);
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
    throw StateError('No readable text font found for preview capture.');
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
      throw StateError('No readable Material Icons font found.');
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

ThemeData _themeWithCaptureFont(ThemeData theme) {
  return theme.copyWith(
    textTheme: theme.textTheme.apply(fontFamily: _captureFontFamily),
    primaryTextTheme: theme.primaryTextTheme.apply(
      fontFamily: _captureFontFamily,
    ),
  );
}

class _VisualApp extends StatelessWidget {
  const _VisualApp({required this.captureKey});

  final GlobalKey captureKey;

  @override
  Widget build(BuildContext context) {
    return EasyLocalization(
      supportedLocales: const [Locale('en', 'US')],
      path: 'assets/localization',
      fallbackLocale: const Locale('en', 'US'),
      startLocale: const Locale('en', 'US'),
      child: Builder(
        builder: (context) => MaterialApp(
          theme: _themeWithCaptureFont(
            AppTheme.build(Colors.indigo, Brightness.light),
          ),
          locale: context.locale,
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          debugShowCheckedModeBanner: false,
          home: AnimationConfigurationClass.synchronized(
            duration: Durations.short2,
            child: Scaffold(
              body: Center(
                child: RepaintBoundary(
                  key: captureKey,
                  child: SizedBox(
                    width: 640,
                    height: 760,
                    child: GameListItemWidget(
                      item: _game,
                      expanded: true,
                      onTap: null,
                      trailing: const GamePreviewPlayButton(),
                      bottom: GamePreviewBottom(game: _game),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _VisualPackageController extends PackageController {
  @override
  Future<OqPackage> getPackage(int id) async => _package;
}

final _game = GameListItem(
  id: 'game-id',
  createdBy: const ShortUserInfo(id: 1, username: 'Dana'),
  title: 'asdasdsadsa',
  createdAt: DateTime(2026),
  startedAt: DateTime(2026),
  ageRestriction: AgeRestriction.none,
  isPrivate: false,
  players: const [],
  maxPlayers: 10,
  package: PackageItem(
    id: 10,
    title: 'Knowledge Pack With A Long Title That Must Stay Readable',
    createdAt: DateTime(2026),
    author: const ShortUserInfo(id: 2, username: 'Author'),
    ageRestriction: AgeRestriction.none,
    roundsCount: 9,
    questionsCount: 25,
    tags: const [],
  ),
);

final _package = OqPackage(
  id: 10,
  title: 'Knowledge Pack With A Long Title That Must Stay Readable',
  createdAt: DateTime(2026),
  author: const ShortUserInfo(id: 2, username: 'Author'),
  ageRestriction: AgeRestriction.none,
  description:
      'A visual check package that keeps public metadata visible without '
      'showing private question text.',
  language: 'en',
  tags: const [],
  rounds: const [],
);
