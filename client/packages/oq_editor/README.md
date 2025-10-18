# OQ Editor

A Flutter package for editing quiz content in OpenQuester.

## Features

- Quiz content editor screen
- Framework-agnostic translation interface
- Compatible with any i18n solution via dependency injection

## Translation Setup

The package uses an abstract `OqEditorTranslations` interface to stay independent from specific i18n frameworks.

### Implementation with easy_localization

In your parent app, create an implementation:

```dart
import 'package:easy_localization/easy_localization.dart';
import 'package:oq_editor/oq_editor_package.dart';

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

### Add translation keys to your localization files

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

## Usage

```dart
import 'package:oq_editor/oq_editor_package.dart';

// Create controller with translations
final controller = OqEditorController(
  translations: OqEditorEasyLocalizationTranslations(),
);

// Use in widget
OqEditorScreen(controller: controller);
```

## Testing

Use `MockOqEditorTranslations` for tests:

```dart
import 'package:oq_editor/oq_editor_package.dart';

final controller = OqEditorController(
  translations: const MockOqEditorTranslations(),
);
```
