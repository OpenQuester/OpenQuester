# OQ Editor - Parent App Integration Guide

## Step 1: Create Translation Implementation

Create a new file in your parent app (e.g., `lib/integrations/oq_editor_translations.dart`):

```dart
import 'package:easy_localization/easy_localization.dart';
import 'package:oq_editor/oq_editor_package.dart';

/// Bridges oq_editor package with parent app's easy_localization
class OqEditorEasyLocalizationTranslations implements OqEditorTranslations {
  const OqEditorEasyLocalizationTranslations();

  @override
  String get editorTitle => 'editor.title'.tr();

  @override
  String get saveButton => 'editor.save'.tr();

  @override
  String get cancelButton => 'editor.cancel'.tr();

  @override
  String get closeButton => 'editor.close'.tr();
}
```

## Step 2: Add Translation Keys

Add to your localization JSON files (e.g., `assets/localization/en.json`):

```json
{
  "editor": {
    "title": "Quiz Editor",
    "save": "Save",
    "cancel": "Cancel",
    "close": "Close"
  }
}
```

Add corresponding translations in other language files (e.g., `ru.json`, `de.json`, etc.).

## Step 3: Use in Parent App

```dart
import 'package:oq_editor/oq_editor_package.dart';
import 'package:your_app/integrations/oq_editor_translations.dart';

// Create controller
final controller = OqEditorController(
  translations: const OqEditorEasyLocalizationTranslations(),
);

// Navigate to editor
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => OqEditorScreen(controller: controller),
  ),
);
```

## Architecture Benefits

✅ **Package Independence**: `oq_editor` doesn't depend on `easy_localization`  
✅ **Testability**: Use `MockOqEditorTranslations` in tests  
✅ **Flexibility**: Parent app controls all translation logic  
✅ **Type Safety**: Compile-time checks for missing translations  
✅ **Clean Architecture**: Clear boundary between package and app

## Adding New Translation Keys

When the package needs new translations:

1. Add new getter to `OqEditorTranslations` interface
2. Update `MockOqEditorTranslations` with English fallback
3. Update parent app implementation
4. Add keys to localization files
5. Bump package version (semver)

## Testing in Parent App

```dart
// Use mock for widget tests
testWidgets('editor screen shows title', (tester) async {
  final controller = OqEditorController(
    translations: const MockOqEditorTranslations(),
  );

  await tester.pumpWidget(
    MaterialApp(
      home: OqEditorScreen(controller: controller),
    ),
  );

  expect(find.text('Quiz Editor'), findsOneWidget);
});
```
