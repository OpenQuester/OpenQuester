# Editor Redesign - Integration Guide

## Quick Start

This guide helps you complete the integration of the redesigned editor screens.

## Prerequisites

- Flutter SDK installed
- Project dependencies installed (`flutter pub get`)
- Build runner available

## Integration Steps

### Step 1: Generate Router Code

The new screens need to be registered in the auto_router generated code.

```bash
cd /home/runner/work/OpenQuester/OpenQuester/client/packages/oq_editor
flutter pub run build_runner build --delete-conflicting-outputs
```

This command will:
- Scan for `@RoutePage()` annotations
- Generate `router.gr.dart` with new route classes
- Create type-safe route parameters

Expected new routes:
- `RoundsListRouteNew`
- `ThemesGridRouteNew`  
- `QuestionsListRouteNew`

### Step 2: Generate Locale Keys

Translation keys need to be regenerated to include new strings.

```bash
cd /home/runner/work/OpenQuester/OpenQuester/client
flutter pub run easy_localization:generate -f keys -o locale_keys.g.dart -S assets/localization/
```

This will generate `LocaleKeys` class with all translation strings including:
- `oq_editor_search_placeholder`
- `oq_editor_compact_view`
- `oq_editor_detailed_view`
- And 50+ other new keys

### Step 3: Update Main Router

In `/home/runner/work/OpenQuester/OpenQuester/client/packages/oq_editor/lib/router/router.dart`:

The router has already been updated to use:
- `RoundsListRouteNew.page`
- `ThemesGridRouteNew.page`
- `QuestionsListRouteNew.page`

After generation, these will resolve correctly.

### Step 4: Test the Integration

Run the application and test:

#### Navigation Flow Test
1. Open Package Editor
2. Click "Rounds" (should open RoundsListScreenNew)
3. Click a round card (should open ThemesGridScreenNew)
4. Click a theme card (should open QuestionsListScreenNew)
5. Click breadcrumb segments (should navigate back)

#### Search Test
1. Click search icon in any screen
2. Type "question" or any content
3. Should see results with context paths
4. Click a result (should navigate to that item)

#### View Toggle Test
1. Go to questions list
2. Click view toggle icon
3. Should switch between compact/detailed views

#### CRUD Operations Test
1. Add new round/theme/question
2. Edit existing items
3. Delete items (with confirmation)
4. Reorder items (drag and drop)

### Step 5: Replace Old Screens (Optional)

Once everything works, you can replace the old screens:

1. **Backup old files** (or keep in git history):
   ```bash
   mv rounds_list_screen.dart rounds_list_screen.old.dart
   mv themes_grid_screen.dart themes_grid_screen.old.dart
   mv questions_list_screen.dart questions_list_screen.old.dart
   ```

2. **Rename new files**:
   ```bash
   mv rounds_list_screen_new.dart rounds_list_screen.dart
   mv themes_grid_screen_new.dart themes_grid_screen.dart
   mv questions_list_screen_new.dart questions_list_screen.dart
   ```

3. **Update router.dart** to remove "_new" suffixes:
   ```dart
   AutoRoute(page: RoundsListRoute.page, ...),
   AutoRoute(page: ThemesGridRoute.page, ...),
   AutoRoute(page: QuestionsListRoute.page, ...),
   ```

4. **Regenerate router**:
   ```bash
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

## Troubleshooting

### Issue: Router generation fails

**Error**: "No route found for RoundsListRouteNew"

**Solution**:
- Ensure `@RoutePage()` annotation is present on each screen class
- Run `flutter clean` then `flutter pub get`
- Try generation again

### Issue: Translation keys not found

**Error**: "LocaleKeys.oq_editor_search_placeholder doesn't exist"

**Solution**:
- Verify `en-US.json` has all new keys
- Run locale generation command
- Check `lib/generated/locale_keys.g.dart` was created
- Restart IDE/hot reload

### Issue: WatchItMixin errors

**Error**: "The getter 'watchValue' isn't defined"

**Solution**:
- Ensure `watch_it` package is imported
- Use `with WatchItMixin` on StatelessWidget
- Use `with WatchItStatefulWidgetMixin` on State classes

### Issue: Build errors after generation

**Error**: Various compilation errors

**Solution**:
```bash
flutter clean
flutter pub get
cd packages/oq_editor
flutter pub get
cd ../..
flutter pub run build_runner clean
flutter pub run build_runner build --delete-conflicting-outputs
```

## File Structure After Integration

```
client/packages/oq_editor/lib/
├── view/
│   ├── widgets/
│   │   ├── editor_breadcrumb.dart          ✅ NEW
│   │   ├── editor_item_card.dart           ✅ NEW
│   │   ├── editor_badges.dart              ✅ NEW
│   │   ├── package_search_delegate.dart    ✅ NEW
│   │   └── ...
│   └── screens/
│       ├── rounds_list_screen_new.dart     ✅ NEW (or renamed)
│       ├── themes_grid_screen_new.dart     ✅ NEW (or renamed)
│       ├── questions_list_screen_new.dart  ✅ NEW (or renamed)
│       ├── rounds_list_screen.dart         ⚠️  OLD (keep or remove)
│       ├── themes_grid_screen.dart         ⚠️  OLD (keep or remove)
│       ├── questions_list_screen.dart      ⚠️  OLD (keep or remove)
│       └── ...
├── router/
│   ├── router.dart                         ✅ UPDATED
│   └── router.gr.dart                      🔄 REGENERATE
└── models/
    └── oq_editor_translations.dart         ✅ UPDATED
```

## Verification Checklist

After completing integration:

### Code Generation
- [ ] `router.gr.dart` contains new route classes
- [ ] `locale_keys.g.dart` contains new translation keys
- [ ] No compilation errors
- [ ] Hot reload works

### Functionality
- [ ] All screens load without errors
- [ ] Breadcrumb navigation works
- [ ] Search finds content correctly
- [ ] View toggle works (questions screen)
- [ ] Add/edit/delete operations work
- [ ] Reordering works

### UI/UX
- [ ] Color coding is visible and consistent
- [ ] Badges render correctly
- [ ] Spacing and alignment look good
- [ ] No text overflow
- [ ] Icons are clear
- [ ] Empty states show correctly

### Performance
- [ ] Large packages (30+ questions) load quickly
- [ ] Scrolling is smooth
- [ ] Search is fast (<500ms)
- [ ] No memory leaks during navigation

## Rollback Plan

If you need to revert to old screens:

1. **Restore old router configuration**:
   ```bash
   git checkout HEAD -- client/packages/oq_editor/lib/router/router.dart
   ```

2. **Remove new files** (if not working):
   ```bash
   rm rounds_list_screen_new.dart
   rm themes_grid_screen_new.dart
   rm questions_list_screen_new.dart
   ```

3. **Regenerate router**:
   ```bash
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

4. **Hot reload** or restart app

## Next Steps

After successful integration:

1. **Gather User Feedback**
   - How does search feel?
   - Is information density better?
   - Any confusion with navigation?

2. **Monitor Performance**
   - Track load times with large packages
   - Check memory usage
   - Profile search performance

3. **Plan Phase 2**
   - Implement filter chips
   - Add package structure sidebar
   - Build dashboard view
   - Add batch operations

4. **Documentation**
   - Update user guide with search tips
   - Document keyboard shortcuts
   - Create video walkthrough

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review `EDITOR_REDESIGN_SUMMARY.md` for architecture details
3. Check git history for recent changes
4. Open an issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Console errors
