import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
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

    if (roundIndex >= package.rounds.length) {
      return Center(child: Text(translations.invalidTheme));
    }

    final round = package.rounds[roundIndex];
    if (themeIndex >= round.themes.length) {
      return Center(child: Text(translations.invalidTheme));
    }

    final theme = round.themes[themeIndex];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with back button
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

          // Theme name field
          TextFormField(
            initialValue: theme.name,
            decoration: InputDecoration(
              labelText: translations.themeName,
              border: const OutlineInputBorder(),
              filled: true,
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

          // Description field
          TextFormField(
            initialValue: theme.description,
            decoration: InputDecoration(
              labelText: translations.themeDescription,
              border: const OutlineInputBorder(),
              filled: true,
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

          // Info card
          Card(
            color: Theme.of(
              context,
            ).colorScheme.primaryContainer.withValues(alpha: .3),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    Icons.quiz_outlined,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    translations.questionsInTheme(theme.questions.length),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Navigate to questions button
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
    );
  }
}
