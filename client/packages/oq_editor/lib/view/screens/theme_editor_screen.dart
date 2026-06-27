import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/view/utils/editor_layout_metrics.dart';
import 'package:oq_shared/ui/max_size_container.dart';
import 'package:watch_it/watch_it.dart';

/// Edit a specific theme
@RoutePage()
class ThemeEditorScreen extends WatchingWidget {
  const ThemeEditorScreen({
    @pathParam required this.roundIndex,
    @pathParam required this.themeIndex,
    super.key,
  });

  final int roundIndex;
  final int themeIndex;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);

    final translations = controller.translations;
    callOnce((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) controller.selectTheme(roundIndex, themeIndex);
      });
    });

    if (roundIndex >= package.rounds.length) {
      return Center(child: Text(translations.invalidTheme));
    }

    final round = package.rounds[roundIndex];
    if (themeIndex >= round.themes.length) {
      return Center(child: Text(translations.invalidTheme));
    }

    final theme = round.themes[themeIndex];

    return MaxSizeContainer(
      maxWidth: EditorLayoutMetrics.formMaxWidth,
      child: SingleChildScrollView(
        padding: EditorLayoutMetrics.pagePadding(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    translations.editTheme,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            TextFormField(
              initialValue: theme.name,
              decoration: InputDecoration(
                labelText: translations.themeName,
                border: const OutlineInputBorder(),
              ),
              onChanged: (value) {
                controller.updateTheme(
                  roundIndex,
                  themeIndex,
                  theme.copyWith(name: value),
                );
              },
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return translations.fieldRequired;
                }
                return null;
              },
              maxLength: 100,
            ),
            const SizedBox(height: 16),

            TextFormField(
              initialValue: theme.description,
              decoration: InputDecoration(
                labelText: translations.themeDescription,
                border: const OutlineInputBorder(),
              ),
              onChanged: (value) {
                controller.updateTheme(
                  roundIndex,
                  themeIndex,
                  theme.copyWith(description: value),
                );
              },
              maxLines: 3,
              maxLength: 300,
            ),
            const SizedBox(height: 24),

            Card(
              elevation: 0,
              color: Theme.of(
                context,
              ).colorScheme.primaryContainer.withValues(alpha: .28),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(
                      Icons.quiz_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        translations.questionsInTheme(theme.questions.length),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            FilledButton.icon(
              onPressed: () => context.router.push(
                QuestionsListRoute(
                  roundIndex: roundIndex,
                  themeIndex: themeIndex,
                ),
              ),
              icon: const Icon(Icons.list),
              label: Text(translations.questions),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
