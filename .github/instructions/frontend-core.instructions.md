---
applyTo: "client/**/*"
---

# Frontend Core - Flutter/Dart

## Architecture
`core/` - DI, routing, theme | `features/` - modules (controller/, data/, view/, utils/) | `data/` - Models | `ui/` - Shared | `connection/` - API, socket

## Imports & Naming
Use `common_imports.dart` | Files: `snake_case` | Classes: `PascalCase` | Variables: `camelCase` | Private: `_prefix`

## Widgets
```dart
// StatefulWidget
class MyWidget extends StatefulWidget {
  const MyWidget({required this.param, super.key});
  final String param;
  @override
  State<MyWidget> createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  @override
  void initState() { unawaited(_init()); super.initState(); }
  Future<void> _init() async {}
  @override
  Widget build(BuildContext context) => Placeholder();
}

// WatchingWidget
class MyWatchingWidget extends WatchingWidget {
  const MyWatchingWidget({super.key});
  @override
  Widget build(BuildContext context) {
    final value = watchValue((MyController m) => m.someValue);
    return Text("$value");
  }
}
```

## DI
```dart
@singleton class MyController {}
final c = getIt<MyController>();  // or watchIt<MyController>() for reactive
final c = createOnce(MyController.new, dispose: (e) => e.dispose());
```

## State
```dart
class MyController {
  final ValueNotifier<MyState> state = ValueNotifier(MyState.initial());
  void updateState(MyState newState) => state.value = newState;
  void dispose() => state.dispose();
}
// Or use StreamController for streams
final _streamController = StreamController<MyData>.broadcast();
Stream<MyData> get stream => _streamController.stream;
void dispose() => _streamController.close();
```

## UI
```dart
// Use custom AdaptiveDialog widget (not Flutter's showAdaptiveDialog)
// Theme access
Container(
  decoration: BoxDecoration(
    color: context.theme.colorScheme.surface,
    borderRadius: BorderRadius.circular(12),
    border: Border.all(color: context.theme.colorScheme.outline.withValues(alpha: 0.2)),
  ),
  child: Text('Hello', style: context.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w500)),
)

// Responsive
final isWide = UiModeUtils.wideModeOn(context);
MaxSizeContainer(maxWidth: UiModeUtils.maximumDialogWidth, child: isWide ? _WideLayout() : _NarrowLayout())

// Spacing
Container(padding: 16.all, margin: 8.vertical, child: Column(spacing: 12, children: widgets))
```

See: `.github/instructions/frontend-patterns.instructions.md` for localization, animations, navigation, forms, testing
