import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('shows package structure without question details', (
    tester,
  ) async {
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
            home: Scaffold(body: PackagePublicOverview(package: _package())),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Knowledge Pack'), findsOneWidget);
    expect(find.text('1 round'), findsOneWidget);
    expect(find.text('4 questions'), findsNWidgets(2));
    expect(find.text('16+'), findsOneWidget);
    expect(find.textContaining('Friendly package for mixed groups.'), findsOne);
    expect(find.text('Warmup'), findsOneWidget);
    expect(find.text('Simple'), findsOneWidget);
    expect(find.text('4 themes'), findsOneWidget);
    expect(find.text('1 text question'), findsOneWidget);
    expect(find.text('1 media question'), findsOneWidget);
    expect(find.text('2 mixed questions'), findsOneWidget);
    expect(find.text('History'), findsNothing);
    expect(find.text('Geography'), findsNothing);
    expect(find.text('Picture'), findsNothing);
    expect(find.text('Choices'), findsNothing);
    expect(find.text('What year did it happen?'), findsNothing);
    expect(find.text('Audio prompt'), findsNothing);
    expect(find.text('Pick the image'), findsNothing);
    expect(find.text('Secret answer'), findsNothing);
    expect(find.text('100'), findsNothing);

    await tester.tap(find.text('Warmup'));
    await tester.pumpAndSettle();

    expect(find.text('History'), findsOneWidget);
    expect(find.text('Geography'), findsOneWidget);
    expect(find.text('Picture'), findsOneWidget);
    expect(find.text('Choices'), findsOneWidget);
    expect(find.text('What year did it happen?'), findsNothing);
    expect(find.text('Audio prompt'), findsNothing);
    expect(find.text('Pick the image'), findsNothing);
    expect(find.text('Secret answer'), findsNothing);
    expect(find.text('100'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('uses singular count labels for one-item metadata', (
    tester,
  ) async {
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
            home: const SizedBox.shrink(),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      packageOverviewCountLabel(PackageOverviewCountKind.round, 1),
      '1 round',
    );
    expect(
      packageOverviewCountLabel(PackageOverviewCountKind.theme, 1),
      '1 theme',
    );
    expect(
      packageOverviewCountLabel(PackageOverviewCountKind.question, 1),
      '1 question',
    );
    expect(
      packageOverviewCountLabel(PackageOverviewCountKind.textQuestion, 1),
      '1 text question',
    );
    expect(
      packageOverviewCountLabel(PackageOverviewCountKind.mediaQuestion, 2),
      '2 media questions',
    );

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}

OqPackage _package({String title = 'Knowledge Pack'}) {
  return OqPackage(
    id: 1,
    title: title,
    createdAt: DateTime(2026),
    author: const ShortUserInfo(id: 2, username: 'Author'),
    ageRestriction: AgeRestriction.a16,
    description: 'Friendly package for mixed groups.',
    language: 'en',
    tags: const [PackageTag(id: 1, tag: 'classic')],
    rounds: const [
      PackageRound(
        order: 0,
        name: 'Warmup',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(
            order: 0,
            name: 'History',
            questions: [
              PackageQuestionUnion.simple(
                order: 0,
                price: 100,
                showAnswerDuration: 5000,
                text: 'What year did it happen?',
                answerText: 'Secret answer',
              ),
            ],
          ),
          PackageTheme(
            order: 1,
            name: 'Geography',
            questions: [
              PackageQuestionUnion.simple(
                order: 0,
                price: 200,
                showAnswerDuration: 5000,
                questionFiles: [
                  PackageQuestionFile(
                    order: 0,
                    file: FileItem(
                      md5: 'audio',
                      type: PackageFileType.audio,
                    ),
                    displayTime: 5000,
                  ),
                ],
                answerText: 'Audio answer',
              ),
            ],
          ),
          PackageTheme(
            order: 2,
            name: 'Picture',
            questions: [
              PackageQuestionUnion.simple(
                order: 0,
                price: 300,
                showAnswerDuration: 5000,
                text: 'Audio prompt',
                questionFiles: [
                  PackageQuestionFile(
                    order: 0,
                    file: FileItem(
                      md5: 'image',
                      type: PackageFileType.image,
                    ),
                    displayTime: 5000,
                  ),
                ],
                answerText: 'Image answer',
              ),
            ],
          ),
          PackageTheme(
            order: 3,
            name: 'Choices',
            questions: [
              PackageQuestionUnion.choice(
                order: 0,
                price: 400,
                showAnswerDuration: 5000,
                showDelay: 0,
                text: 'Pick the image',
                answers: [
                  QuestionChoiceAnswers(
                    order: 0,
                    text: 'Text option',
                  ),
                  QuestionChoiceAnswers(
                    order: 1,
                    file: FileItem(
                      md5: 'choice-image',
                      type: PackageFileType.image,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
