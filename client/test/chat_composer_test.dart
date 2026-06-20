import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart' as chat_core;
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
    final controller = SocketChatController()
      ..chatController = chat_core.InMemoryChatController()
      ..user = const chat_core.User(id: '1', name: 'Mira');
    getIt.registerSingleton(controller);
  });

  tearDown(() async {
    await getIt.reset();
  });

  testWidgets('uses the production flutter chat composer', (tester) async {
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en', 'US')],
        path: 'assets/localization',
        fallbackLocale: const Locale('en', 'US'),
        startLocale: const Locale('en', 'US'),
        child: Builder(
          builder: (context) => MaterialApp(
            locale: context.locale,
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            home: const Scaffold(body: ChatScreen()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The production wrapper delegates to flutter_chat_ui's composer instead
    // of building a second lobby-specific composer.
    expect(find.byType(Composer), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
