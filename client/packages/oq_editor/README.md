# OQ Editor

## Architecture

### Navigation Flow

```Text
PackageInfo → RoundsList → RoundEditor → ThemesGrid → ThemeEditor → QuestionsList
     ↓            ↓            ↓            ↓            ↓            ↓
  [Basic        [Manage     [Edit        [Grid        [Edit       [Manage
   Info]        Rounds]      Round]      Themes]       Theme]     Questions]
```

### Screens

1. **PackageInfoScreen** - Edit package metadata (title, description, age restriction, language)
2. **RoundsListScreen** - Manage rounds with reorderable list
3. **RoundEditorScreen** - Edit round details (name, description, type)
4. **ThemesGridScreen** - Visual grid of themes with question counts
5. **ThemeEditorScreen** - Edit theme details (name, description)
6. **QuestionsListScreen** - Manage questions with reorderable list

### State Management

- **Controller**: `OqEditorController` - single source of truth for all editor state
- **ValueNotifiers**: Reactive state for package, currentStep, navigationContext
- **watch_it**: Dependency injection and watching state changes

## Getting Started

### Basic Setup

```dart
import 'package:oq_editor/oq_editor.dart';

// 1. Implement translations interface
class MyTranslations implements OqEditorTranslations {
  @override
  String get editorTitle => 'Package Editor';

  @override
  String get saveButton => 'Save';

  @override
  String get packageInfo => 'Package Info';

  @override
  String minLengthError(int length) => 'Minimum length: $length';

  @override
  String deleteConfirmMessage(String itemName) => 'Delete $itemName?';

  // ... implement all required translations
}

// 2. Create controller
final controller = OqEditorController(
  translations: MyTranslations(),
  initialPackage: existingPackage, // or null for new package
);

// 3. Show editor
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => OqEditorScreen(controller: controller),
  ),
);

// 4. Don't forget to dispose
@override
void dispose() {
  controller.dispose();
  super.dispose();
}
```

### Controller API

#### Navigation

```dart
controller.navigateToPackageInfo()
controller.navigateToRoundsList()
controller.navigateToRoundEditor(int roundIndex)
controller.navigateToThemesGrid(int roundIndex)
controller.navigateToThemeEditor(int roundIndex, int themeIndex)
controller.navigateToQuestionsList(int roundIndex, int themeIndex)
controller.navigateBack()
```

#### Package Operations

```dart
controller.updatePackageInfo(
  title: 'New Title',
  description: 'Description',
  ageRestriction: AgeRestriction.a16,
  language: 'en',
)
```

#### Round CRUD

```dart
controller.addRound(PackageRound(...))
controller.updateRound(index, PackageRound(...))
controller.deleteRound(index)
controller.reorderRounds(oldIndex, newIndex)
```

#### Theme CRUD

```dart
controller.addTheme(roundIndex, PackageTheme(...))
controller.updateTheme(roundIndex, themeIndex, PackageTheme(...))
controller.deleteTheme(roundIndex, themeIndex)
controller.reorderThemes(roundIndex, oldIndex, newIndex)
```

#### Question CRUD

```dart
controller.addQuestion(roundIndex, themeIndex, PackageQuestionUnion(...))
controller.updateQuestion(roundIndex, themeIndex, questionIndex, question)
controller.deleteQuestion(roundIndex, themeIndex, questionIndex)
controller.reorderQuestions(roundIndex, themeIndex, oldIndex, newIndex)
```

### Watching State Changes

```dart
// Listen to package changes
controller.package.addListener(() {
  final package = controller.package.value;
  print('Package updated: ${package.title}');
});

// Listen to current step
controller.currentStep.addListener(() {
  print('Current step: ${controller.currentStep.value}');
});
```

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

### Usage

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
