import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('allows package title to use two lines at medium widths', (
    tester,
  ) async {
    const longTitle =
        'Knowledge Pack With A Long Title That Must Stay '
        'Readable At Medium Widths';

    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en', 'US')],
        path: 'assets/localization',
        fallbackLocale: const Locale('en', 'US'),
        startLocale: const Locale('en', 'US'),
        child: Builder(
          builder: (context) => MaterialApp(
            theme: ThemeData(
              extensions: const [
                ExtraColors(
                  success: Color(0xFF0B6B2B),
                  successDark: Color(0xFF0B6B2B),
                  warning: Color(0xFF755100),
                  warningDark: Color(0xFF755100),
                  gold: Color(0xFF6F5A00),
                  goldDark: Color(0xFF6F5A00),
                  silver: Color(0xFF5F6670),
                  silverDark: Color(0xFF5F6670),
                  bronze: Color(0xFF7A4A1D),
                  bronzeDark: Color(0xFF7A4A1D),
                ),
              ],
            ),
            locale: context.locale,
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            home: Scaffold(
              body: SizedBox(
                width: 780,
                child: PackagePublicOverview(
                  package: _package(title: longTitle),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    final title = tester.widget<Text>(
      find.byKey(const Key('package_public_overview_title')),
    );

    expect(title.data, longTitle);
    expect(title.maxLines, 2);
    expect(title.overflow, TextOverflow.ellipsis);
    expect(tester.takeException(), isNull);
  });
}

OqPackage _package({required String title}) {
  return OqPackage(
    id: 1,
    title: title,
    createdAt: DateTime(2026),
    author: const ShortUserInfo(id: 2, username: 'Author'),
    ageRestriction: AgeRestriction.a16,
    description: 'Friendly package for mixed groups.',
    language: 'en',
    tags: const [],
    rounds: const [],
  );
}
