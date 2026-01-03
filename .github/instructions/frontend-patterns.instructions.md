---
applyTo: "client/**/*"
---

# Frontend Patterns - Flutter/Dart

## Localization (easy_localization)

**Build:** `make gen_locale` | **JSON:** `assets/localization/*.json` → `locale_keys.g.dart`

```dart
Text(LocaleKeys.home_tabs_games.tr())
Text(LocaleKeys.created_by.tr(namedArgs: {'author': name}))
Text(LocaleKeys.rounds.plural(count))  // JSON: "rounds": {"one": "{} round", "other": "{} rounds"}
TextFormField(validator: (v) => v?.isEmpty == true ? LocaleKeys.validation_required.tr() : null)
await getIt<ToastController>().show(LocaleKeys.error_network.tr());
if (!getIt<AuthController>().authorized) { await getIt<ToastController>().show(LocaleKeys.login_unauthorized.tr()); return; }
```

**JSON Organization:** `{feature: {title, actions: {}, errors: {}, validation: {}}}`
**Workflow:** Edit JSON → `make gen_locale` → Use `LocaleKeys.*`

## Animation

```dart
class _S extends State<W> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  @override
  void initState() { super.initState(); _c = AnimationController(duration: Duration(milliseconds: 300), vsync: this); }
  @override
  void dispose() { _c.dispose(); super.dispose(); }
}
GestureDetector(onTapDown: (_) => unawaited(_c.forward()), onTapUp: (_) => unawaited(_c.reverse()), child: AnimatedBuilder(animation: _c, builder: (ctx, ch) => Transform.scale(scale: _c.value, child: ch)))
```

## Navigation (Auto Route)

```dart
@RoutePage()
class MyScreen extends StatelessWidget {
  const MyScreen({@PathParam() required this.id, super.key});
  final String id;
  @override
  Widget build(BuildContext context) => Scaffold(body: ElevatedButton(onPressed: () => NextRoute().push(context), child: Text('Go')));
}
// Usage: MyRoute(param: 'value').push(context) | AppRouter.I.replace(MyRoute(...)) | context.maybePop()
```

## Error Handling

```dart
try { await Api.I.api.endpoint(); } catch (e) { await getIt<ToastController>().show(LocaleKeys.error_generic.tr()); ErrorHandler.logError(e); }
```

## Forms

```dart
final formKey = GlobalKey<FormState>();
void _submit() { if (!(formKey.currentState?.validate() ?? false)) return; /* process */ }
Form(key: formKey, child: Column(children: [TextFormField(validator: (v) => v?.isEmpty == true ? LocaleKeys.error_required.tr() : null)]))
```

## Testing

```dart
testWidgets('test', (t) async { await t.pumpWidget(MaterialApp(home: MyWidget(p: 'x'))); expect(find.text('x'), findsOneWidget); });
group('Controller', () { late MyController c; setUp(() => c = MyController()); tearDown(() => c.dispose()); test('t', () {}); });
```

## Performance

Use `const` | Prefer `WatchingWidget` for reactive | Extract complex widgets | `createOnce` for expensive | Dispose controllers, close streams

## Quality

`very_good_analysis` | Fix linting before commit | Document public APIs | Conventional commits | Max 300-400 lines/file
