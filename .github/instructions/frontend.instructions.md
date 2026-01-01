---
applyTo: "client/**/*
---

# Frontend Coding Standards - Flutter/Dart

## Project Architecture

### Directory Structure

- `lib/src/core/` - Core application logic, DI, routing, theme
- `lib/src/features/` - Feature-based modules (one feature per directory)
- `lib/src/data/` - Data models and DTOs
- `lib/src/ui/` - Shared UI components
- `lib/src/utils/` - Utility functions and extensions
- `lib/src/connection/` - API, socket, auth, storage
- `packages/` - Local packages (oq_shared, oq_editor, etc.)

### Feature Structure

Each feature should follow this pattern:

```
features/feature_name/
├── controller/          # Business logic controllers
├── data/               # DTOs, models specific to feature
├── view/               # UI components and screens
└── utils/              # Feature-specific utilities
```

## Coding Style

### Project-Specific Components

- **Adaptive Dialog**: When referring to "adaptive dialog", use the `AdaptiveDialog` widget (`lib/src/features/dialog/view/adaptive_dialog.dart`), not Flutter's `showAdaptiveDialog`. This custom widget automatically adapts to show as a dialog on wide screens and a bottom sheet on mobile.

### Imports and Exports

- Use `openquester/common_imports.dart` for common dependencies
- Prefer explicit imports over wildcard exports
- Group imports: Flutter SDK, third-party packages, local imports
- Use relative imports for files within the same package

### Naming Conventions

- Classes: `PascalCase` (e.g., `GamePreviewController`)
- Files: `snake_case` (e.g., `game_preview_controller.dart`)
- Variables/functions: `camelCase` (e.g., `createGame`)
- Constants: `camelCase` with `const` or `final`
- Private members: prefix with `_`

### Widget Patterns

#### StatefulWidget Structure

```dart
class MyWidget extends StatefulWidget {
  const MyWidget({required this.param, super.key});

  final String param;

  @override
  State<MyWidget> createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  @override
  void initState() {
    // Use unawaited() for fire-and-forget async calls
    unawaited(_init());
    super.initState();
  }

  Future<void> _init() async {
    // Initialization logic
  }

  @override
  Widget build(BuildContext context) {
    return const Placeholder();
  }
}
```

#### WatchingWidget Pattern

```dart
class MyWatchingWidget extends WatchingWidget {
  const MyWatchingWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<MyController>();
    final value = watchValue((MyController m) => m.someValue);

    return Container(
      child: Text('$value'),
    );
  }
}
```

### Dependency Injection

#### Controller Registration

```dart
@singleton
class MyController {
  // Controller logic
}

// In get_it.dart
@InjectableInit()
void configureDependencies() => getIt.init();
```

#### Controller Usage

```dart
// In widgets
final controller = getIt<MyController>();
final controller = watchIt<MyController>(); // For reactive widgets

// Lifecycle management
final controller = createOnce(
  MyController.new,
  dispose: (e) => e.dispose(),
);
```

### State Management

#### ValueNotifier Pattern

```dart
class MyController {
  final ValueNotifier<MyState> state = ValueNotifier(MyState.initial());

  void updateState(MyState newState) {
    state.value = newState;
  }

  void dispose() {
    state.dispose();
  }
}
```

#### Stream Controllers

```dart
class MyController {
  final _streamController = StreamController<MyData>.broadcast();
  Stream<MyData> get stream => _streamController.stream;

  void addData(MyData data) {
    _streamController.add(data);
  }

  void dispose() {
    _streamController.close();
  }
}
```

### UI Components

#### Theme and Styling

```dart
// Use context extensions for theme access
Widget build(BuildContext context) {
  return Container(
    decoration: BoxDecoration(
      color: context.theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(
        color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
      ),
    ),
    child: Text(
      'Hello',
      style: context.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w500,
      ),
    ),
  );
}
```

#### Responsive Design

```dart
Widget build(BuildContext context) {
  final isWideMode = UiModeUtils.wideModeOn(context);
  final maxWidth = UiModeUtils.maximumDialogWidth;

  return MaxSizeContainer(
    maxWidth: maxWidth,
    child: isWideMode ? _WideLayout() : _NarrowLayout(),
  );
}
```

#### Spacing and Padding

```dart
// Use extension methods for consistent spacing
Container(
  padding: 16.all,           // EdgeInsets.all(16)
  margin: 8.vertical,        // EdgeInsets.symmetric(vertical: 8)
  child: Column(
    spacing: 12,             // Use spacing parameter for consistent gaps
    children: widgets,
  ),
)
```

### Animation Patterns

#### AnimationController Usage

```dart
class _MyWidgetState extends State<MyWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _animation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
```

#### Gesture Handling

```dart
GestureDetector(
  onTapDown: (_) => unawaited(_controller.forward()),
  onTapUp: (_) => unawaited(_controller.reverse()),
  onTapCancel: () => unawaited(_controller.reverse()),
  child: AnimatedBuilder(
    animation: _animation,
    builder: (context, child) => Transform.scale(
      scale: _animation.value,
      child: child,
    ),
    child: widget.child,
  ),
)
```

### Navigation

#### Auto Route Usage

```dart
@RoutePage()
class MyScreen extends StatelessWidget {
  const MyScreen({@PathParam() required this.id, super.key});

  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ElevatedButton(
        onPressed: () => const NextRoute().push<void>(context),
        child: const Text('Navigate'),
      ),
    );
  }
}
```

#### Route Navigation

```dart
// Push route
const MyRoute(param: 'value').push<void>(context);

// Replace route
await AppRouter.I.replace(MyRoute(param: 'value'));

// Pop
context.maybePop();
```

### Error Handling

#### Async Error Handling

```dart
Future<void> performAction() async {
  try {
    final result = await Api.I.api.someEndpoint();
    // Handle success
  } catch (e) {
    await getIt<ToastController>().show(
      LocaleKeys.error_generic.tr(),
    );
    ErrorHandler.logError(e);
  }
}
```

#### Authorization Checks

```dart
Future<void> performAuthorizedAction() async {
  if (!getIt<AuthController>().authorized) {
    await getIt<ToastController>().show(
      LocaleKeys.login_user_unauthorized.tr(),
    );
    return;
  }

  // Proceed with action
}
```

### Localization

OpenQuester uses `easy_localization` package for internationalization with auto-generated type-safe keys.

#### Project Setup

- **Translation files**: `assets/localization/*.json` (currently `en-US.json`)
- **Generated keys**: `lib/generated/locale_keys.g.dart` (auto-generated, do not edit)
- **Configuration**: `lib/src/core/localization.dart`
- **Build command**: `make gen_locale` (generates LocaleKeys from JSON)

#### Supported Locales

```dart
// Currently supported (in localization.dart)
const List<Locale> supportedLocales = [Locale('en', 'US')];

// App wrapper (in main.dart)
runApp(localizationWrapper(const App()));
```

#### JSON Structure

Organize translations hierarchically in `assets/localization/en-US.json`:

```json
{
  "home_tabs": {
    "games": "Games",
    "packages": "Packages"
  },
  "login": {
    "user_unauthorized": "Please log in to continue",
    "with_discord": "Login with Discord",
    "as_guest": "Continue as Guest"
  },
  "error": {
    "generic": "Something went wrong",
    "network": "Network error occurred"
  },
  "validation": {
    "required": "This field is required",
    "email_invalid": "Please enter a valid email"
  }
}
```

#### String Usage Patterns

##### Basic Translation

```dart
// Simple string
Text(LocaleKeys.profile.tr())

// Nested keys
Text(LocaleKeys.home_tabs_games.tr())
```

##### Parameters and Pluralization

```dart
// Named parameters
Text(LocaleKeys.created_by.tr(namedArgs: {'author': authorName}))

// Positional parameters
Text(LocaleKeys.welcome_user.tr(args: [userName]))

// Pluralization (using ICU format in JSON)
Text(LocaleKeys.rounds.plural(roundCount))

// JSON example for pluralization:
// "rounds": {
//   "one": "{} round",
//   "other": "{} rounds"
// }
```

##### Error Messages and Validation

```dart
// Form validation
TextFormField(
  validator: (value) => value?.isEmpty == true
      ? LocaleKeys.validation_required.tr()
      : null,
)

// Error handling
await getIt<ToastController>().show(
  LocaleKeys.error_network.tr(),
);

// Authorization errors
if (!getIt<AuthController>().authorized) {
  await getIt<ToastController>().show(
    LocaleKeys.login_user_unauthorized.tr(),
  );
  return;
}
```

##### Complex UI Text

```dart
// Button labels
ElevatedButton(
  onPressed: () => _login(),
  child: Text(LocaleKeys.login_with_discord.tr()),
)

// App bar titles
AppBar(
  title: Text(LocaleKeys.package_editor.tr()),
)

// Dialog content
AlertDialog(
  title: Text(LocaleKeys.dialog_confirm_title.tr()),
  content: Text(LocaleKeys.dialog_confirm_message.tr(
    namedArgs: {'action': actionName},
  )),
)
```

#### Key Naming Conventions

Follow hierarchical dot notation for generated keys:

```dart
// JSON structure determines key names
{
  "feature": {
    "action": "Text",
    "error": {
      "type": "Error message"
    }
  }
}

// Generated LocaleKeys
LocaleKeys.feature_action          // "feature.action"
LocaleKeys.feature_error_type      // "feature.error.type"
```

#### Development Workflow

##### Adding New Translations

1. **Add to JSON**: Update `assets/localization/en-US.json`
2. **Generate keys**: Run `make gen_locale` or `dart run easy_localization:generate`
3. **Use in code**: Import from `common_imports.dart` and use `LocaleKeys.*`

##### Key Organization Best Practices

```json
{
  "feature_name": {
    "title": "Feature Title",
    "subtitle": "Feature subtitle",
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    },
    "errors": {
      "save_failed": "Failed to save",
      "load_failed": "Failed to load"
    },
    "validation": {
      "name_required": "Name is required",
      "name_too_short": "Name must be at least {min} characters"
    }
  }
}
```

#### Context and Gender Support

```dart
// Context-aware translations (if needed)
Text(LocaleKeys.greeting.tr(context: context))

// Gender support (for languages that require it)
Text(LocaleKeys.welcome_message.tr(
  gender: user.gender, // 'male', 'female', 'other'
))
```

#### Dynamic Locale Switching

```dart
// Change locale at runtime (for future multi-language support)
await context.setLocale(const Locale('es', 'ES'));

// Get current locale
final currentLocale = context.locale;
```

#### Common Patterns

##### Loading States

```dart
// Loading messages
if (loading) {
  return Column(
    children: [
      const CircularProgressIndicator(),
      Text(LocaleKeys.loading_please_wait.tr()),
    ],
  );
}
```

##### Empty States

```dart
// Empty list messages
if (items.isEmpty) {
  return Center(
    child: Text(LocaleKeys.nothing_found.tr()),
  );
}
```

##### Confirmation Dialogs

```dart
showDialog<bool>(
  context: context,
  builder: (context) => AlertDialog(
    title: Text(LocaleKeys.dialog_delete_title.tr()),
    content: Text(LocaleKeys.dialog_delete_confirm.tr(
      namedArgs: {'item': itemName},
    )),
    actions: [
      TextButton(
        onPressed: () => Navigator.of(context).pop(false),
        child: Text(LocaleKeys.cancel.tr()),
      ),
      TextButton(
        onPressed: () => Navigator.of(context).pop(true),
        child: Text(LocaleKeys.delete.tr()),
      ),
    ],
  ),
);
```

#### Performance Considerations

- **Build-time generation**: LocaleKeys are generated at build time for type safety
- **Lazy loading**: Translations are loaded when needed
- **Caching**: easy_localization caches translations automatically
- **Hot reload**: Changes to JSON files require `make gen_locale` and restart

#### Testing Localization

```dart
// Widget tests with localization
testWidgets('displays localized text', (tester) async {
  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: supportedLocales,
      path: 'assets/localization',
      fallbackLocale: supportedLocales.first,
      child: MaterialApp(
        home: MyWidget(),
      ),
    ),
  );

  await tester.pumpAndSettle();
  expect(find.text(LocaleKeys.welcome.tr()), findsOneWidget);
});
```

#### Migration Guidelines

When adding new languages:

1. Create new JSON file: `assets/localization/[language-code].json`
2. Update `supportedLocales` in `localization.dart`
3. Translate all keys from `en-US.json`
4. Test with `context.setLocale()` switching
5. Update app configuration for locale detection

### Forms and Validation

#### Form Structure

```dart
class _MyFormState extends State<MyForm> {
  final formKey = GlobalKey<FormState>();

  void _submit() {
    final isValid = formKey.currentState?.validate() ?? false;
    if (!isValid) return;

    // Process form
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        children: [
          TextFormField(
            validator: (value) => value?.isEmpty == true
                ? LocaleKeys.error_field_required.tr()
                : null,
          ),
        ],
      ),
    );
  }
}
```

### Performance Best Practices

#### Widget Rebuilds

- Use `const` constructors wherever possible
- Prefer `WatchingWidget` over `StatefulWidget` for reactive UI
- Extract complex widgets into separate classes
- Use `createOnce` for expensive object creation

#### Memory Management

- Always dispose controllers in `dispose()` method
- Use `unawaited()` for fire-and-forget async operations
- Close streams and animation controllers properly

### Testing Patterns

#### Widget Tests

```dart
testWidgets('MyWidget displays correctly', (tester) async {
  await tester.pumpWidget(
    MaterialApp(home: MyWidget(param: 'test')),
  );

  expect(find.text('test'), findsOneWidget);
});
```

#### Controller Tests

```dart
group('MyController', () {
  late MyController controller;

  setUp(() {
    controller = MyController();
  });

  tearDown(() {
    controller.dispose();
  });

  test('should update state correctly', () {
    // Test logic
  });
});
```

### Code Organization

#### Private Widget Classes

- Use private classes (`_MyPrivateWidget`) for widgets used only within one file
- Prefer composition over inheritance
- Keep widgets small and focused on single responsibility

#### Controller Organization

- One controller per feature/screen
- Separate business logic from UI logic
- Use dependency injection for testability

#### File Organization

- Maximum 300-400 lines per file
- Split large files into multiple smaller files
- Use meaningful file names that reflect content

### Common Patterns to Follow

#### Loading States

```dart
Widget build(BuildContext context) {
  if (loading) {
    return const CircularProgressIndicator().center();
  }

  return actualContent;
}
```

#### Error States

```dart
Widget build(BuildContext context) {
  if (error != null) {
    return ErrorWidget(error: error);
  }

  return content;
}
```

#### Conditional Rendering

```dart
Column(
  children: [
    if (condition)
      SomeWidget(),
    AlwaysVisibleWidget(),
    ...otherWidgets,
  ],
)
```

### Code Quality Standards

#### Linting

- Follow `very_good_analysis` rules
- Fix all linting warnings before committing
- Use `// ignore: rule_name` sparingly and with justification

#### Documentation

- Document public APIs with `///` comments
- Use meaningful variable and function names
- Add TODO comments with context when needed

#### Version Control

- Use conventional commits for Flutter changes
- Keep commits atomic and focused
- Write descriptive commit messages
