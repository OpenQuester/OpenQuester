# OQ Editor - Quick Start Guide

## Visual Navigation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PACKAGE EDITOR                           │
└─────────────────────────────────────────────────────────────────┘

Step 1: PACKAGE INFO
┌──────────────────────┐
│ • Title              │
│ • Description        │  ──→ Next ──→
│ • Language           │
│ • Age Restriction    │
└──────────────────────┘

Step 2: ROUNDS LIST
┌──────────────────────────────────────┐
│  [+] Add Round                       │
│  ┌────────────────────────────────┐  │
│  │ 🎯 Round 1           [Edit] [X]│  │  ──→ Edit Round ──→
│  │    5 themes                    │  │
│  │    [View Themes →]             │  │  ──→ View Themes ──→
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 🎯 Round 2           [Edit] [X]│  │
│  │    3 themes                    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

Step 3: ROUND EDITOR
┌──────────────────────┐
│ ← Back               │
│ • Round Name         │  ──→ View Themes ──→
│ • Description        │
│ • Type: ○ Simple     │
│         ○ Final      │
└──────────────────────┘

Step 4: THEMES GRID
┌─────────────────────────────────────────────┐
│  Round 1                        [+] Add     │
│  ┌────────────┐  ┌────────────┐            │
│  │  Theme 1   │  │  Theme 2   │  [Edit] ──→│
│  │  ▓▓▓▓▓▓▓▓  │  │  ▓▓▓▓▓▓▓▓  │            │
│  │  8 questions│  │  5 questions│           │
│  │ [Questions→]│  │ [Questions→] ──→       │
│  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────┘

Step 5: THEME EDITOR
┌──────────────────────┐
│ ← Back               │
│ • Theme Name         │  ──→ View Questions ──→
│ • Description        │
│ ℹ️ 8 questions       │
└──────────────────────┘

Step 6: QUESTIONS LIST
┌──────────────────────────────────────┐
│  Theme: Geography        [+] Add     │
│  ┌────────────────────────────────┐  │
│  │ ☰ ① New Question    [Simple] [X]│  │
│  │      100 pts                   │  │
│  ├────────────────────────────────┤  │
│  │ ☰ ② Capital of...  [Secret] [X]│  │
│  │      200 pts                   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Controller Quick Reference

### Initialize

```dart
final controller = OqEditorController(
  translations: MyTranslations(),
  initialPackage: package, // or null
);
```

### Navigate

```dart
// Forward navigation
controller.navigateToRoundsList();
controller.navigateToRoundEditor(0);
controller.navigateToThemesGrid(0);
controller.navigateToThemeEditor(0, 1);
controller.navigateToQuestionsList(0, 1);

// Backward navigation
controller.navigateBack();
```

### Modify Package

```dart
// Update package info
controller.updatePackageInfo(
  title: 'My Quiz',
  ageRestriction: AgeRestriction.a16,
);

// Add entities
controller.addRound(newRound);
controller.addTheme(roundIndex, newTheme);
controller.addQuestion(roundIndex, themeIndex, newQuestion);

// Update entities
controller.updateRound(index, updatedRound);
controller.updateTheme(roundIndex, themeIndex, updatedTheme);
controller.updateQuestion(roundIndex, themeIndex, questionIndex, updatedQuestion);

// Delete entities
controller.deleteRound(index);
controller.deleteTheme(roundIndex, themeIndex);
controller.deleteQuestion(roundIndex, themeIndex, questionIndex);

// Reorder entities
controller.reorderRounds(oldIndex, newIndex);
controller.reorderThemes(roundIndex, oldIndex, newIndex);
controller.reorderQuestions(roundIndex, themeIndex, oldIndex, newIndex);
```

### Watch State

```dart
// In a WatchingWidget
final package = watchValue((OqEditorController c) => c.package);
final step = watchValue((OqEditorController c) => c.currentStep);
final navContext = watchValue((OqEditorController c) => c.navigationContext);

// Or with listeners
controller.package.addListener(() {
  print('Package changed: ${controller.package.value}');
});
```

### Cleanup

```dart
@override
void dispose() {
  controller.dispose();
  super.dispose();
}
```

## Example: Creating a Simple Package

```dart
// 1. Create controller
final controller = OqEditorController(
  translations: MyTranslations(),
);

// 2. Set package info
controller.updatePackageInfo(
  title: 'Geography Quiz',
  description: 'Test your geography knowledge',
  language: 'en',
  ageRestriction: AgeRestriction.none,
);

// 3. Add a round
final round = PackageRound(
  id: null,
  order: 0,
  name: 'Countries',
  description: 'Questions about countries',
  type: PackageRoundType.simple,
  themes: [],
);
controller.addRound(round);

// 4. Add a theme
final theme = PackageTheme(
  id: null,
  order: 0,
  name: 'European Capitals',
  description: 'Capital cities of Europe',
  questions: [],
);
controller.addTheme(0, theme);

// 5. Add a question
final question = PackageQuestionUnion.simple(
  id: null,
  order: 0,
  price: 100,
  text: 'What is the capital of France?',
  answerText: 'Paris',
  answerHint: null,
  questionComment: null,
  type: SimpleQuestionType.simple,
);
controller.addQuestion(0, 0, question);

// 6. Get final package
final package = controller.package.value;
final json = package.toJson();
// Save to backend or local storage
```

## Translations Implementation Example

```dart
class MyEditorTranslations implements OqEditorTranslations {
  @override
  String get editorTitle => 'Package Editor';

  @override
  String get saveButton => 'Save';

  @override
  String get cancelButton => 'Cancel';

  @override
  String get closeButton => 'Close';

  @override
  String get nextButton => 'Next';

  @override
  String get backButton => 'Back';

  @override
  String get addButton => 'Add';

  @override
  String get editButton => 'Edit';

  @override
  String get deleteButton => 'Delete';

  @override
  String get packageInfo => 'Package Info';

  @override
  String get packageTitle => 'Title';

  @override
  String get packageDescription => 'Description';

  @override
  String get packageLanguage => 'Language';

  @override
  String get packageAgeRestriction => 'Age Restriction';

  @override
  String get packageTags => 'Tags';

  @override
  String get rounds => 'Rounds';

  @override
  String get roundName => 'Round Name';

  @override
  String get roundDescription => 'Round Description';

  @override
  String get roundType => 'Round Type';

  @override
  String get addRound => 'Add Round';

  @override
  String get editRound => 'Edit Round';

  @override
  String get noRounds => 'No rounds yet. Add one to get started!';

  @override
  String get themes => 'Themes';

  @override
  String get themeName => 'Theme Name';

  @override
  String get themeDescription => 'Theme Description';

  @override
  String get addTheme => 'Add Theme';

  @override
  String get editTheme => 'Edit Theme';

  @override
  String get noThemes => 'No themes yet. Add one to get started!';

  @override
  String get questions => 'Questions';

  @override
  String get questionText => 'Question Text';

  @override
  String get questionPrice => 'Price';

  @override
  String get questionAnswer => 'Answer';

  @override
  String get addQuestion => 'Add Question';

  @override
  String get editQuestion => 'Edit Question';

  @override
  String get noQuestions => 'No questions yet. Add one to get started!';

  @override
  String get fieldRequired => 'This field is required';

  @override
  String minLengthError(int length) => 'Minimum length: $length characters';

  @override
  String maxLengthError(int length) => 'Maximum length: $length characters';

  @override
  String get deleteConfirmTitle => 'Confirm Delete';

  @override
  String deleteConfirmMessage(String itemName) =>
    'Are you sure you want to delete $itemName? This action cannot be undone.';
}
```

## Common Patterns

### Validation

```dart
TextFormField(
  validator: (value) {
    if (value == null || value.trim().isEmpty) {
      return translations.fieldRequired;
    }
    if (value.length < 3) {
      return translations.minLengthError(3);
    }
    return null;
  },
)
```

### Confirmation Dialog

```dart
final confirmed = await showDialog<bool>(
  context: context,
  builder: (context) => AlertDialog(
    title: Text(controller.translations.deleteConfirmTitle),
    content: Text(
      controller.translations.deleteConfirmMessage('this item'),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: Text(controller.translations.cancelButton),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, true),
        child: Text(controller.translations.deleteButton),
      ),
    ],
  ),
);

if (confirmed == true) {
  controller.deleteRound(index);
}
```

### Empty State

```dart
Center(
  child: Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(
        Icons.interests_outlined,
        size: 64,
        color: Theme.of(context).colorScheme.outline,
      ),
      const SizedBox(height: 16),
      Text(
        translations.noRounds,
        style: Theme.of(context).textTheme.titleMedium,
      ),
    ],
  ),
)
```

## Tips & Best Practices

1. **Always dispose the controller** when done editing
2. **Use watchValue** in widgets for efficient rebuilds
3. **Validate indices** before CRUD operations (controller does this)
4. **Show confirmations** for destructive actions (delete)
5. **Provide visual feedback** (animations, chips, badges)
6. **Handle empty states** gracefully with helpful messages
7. **Use const where possible** for performance
8. **Keep translations consistent** across all screens

## Troubleshooting

### Controller not found in GetIt

**Solution**: Ensure `OqEditorScreen` is rendered, it registers the controller automatically.

### State not updating

**Solution**: Check that you're using `watchValue` in your widgets, not direct access.

### Navigation not working

**Solution**: Verify indices are valid and within bounds.

### Reorder not saving

**Solution**: Reorder already updates the package state automatically.

## Next Steps

1. ✅ Implement translations in your app
2. ✅ Create controller instance
3. ✅ Show OqEditorScreen
4. 🚧 Add detailed question editor
5. 🚧 Implement save/load functionality
6. 🚧 Add file upload support
7. 🚧 Enhance validation rules

---

**Need help?** Check `IMPLEMENTATION_SUMMARY.md` for detailed architecture decisions and `README.md` for comprehensive API documentation.
