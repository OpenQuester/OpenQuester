import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

/// Dashboard/overview screen showing package statistics and structure
class EditorDashboard extends WatchingWidget {
  const EditorDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final editorController = GetIt.I<OqEditorController>();
    final navController = GetIt.I<EditorNavigationController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = editorController.translations;
    final isWide = UiModeUtils.wideModeOn(context);

    // Calculate statistics
    final stats = _calculateStats(package);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Package title and description
          _PackageHeader(package: package, translations: translations),

          const SizedBox(height: 24),

          // Statistics cards
          _StatisticsSection(
            stats: stats,
            translations: translations,
            isWide: isWide,
          ),

          const SizedBox(height: 24),

          // Quick actions
          _QuickActionsSection(
            navController: navController,
            translations: translations,
          ),

          const SizedBox(height: 24),

          // Completion indicators
          _CompletionSection(
            package: package,
            stats: stats,
            translations: translations,
          ),

          const SizedBox(height: 24),

          // Structure overview
          _StructureOverview(
            package: package,
            navController: navController,
            translations: translations,
          ),
        ],
      ),
    );
  }

  _PackageStats _calculateStats(OqPackage package) {
    var totalThemes = 0;
    var totalQuestions = 0;
    var questionsWithMedia = 0;
    var emptyThemes = 0;
    var incompleteQuestions = 0;

    for (final round in package.rounds) {
      totalThemes += round.themes.length;

      for (final theme in round.themes) {
        if (theme.questions.isEmpty) {
          emptyThemes++;
        }
        totalQuestions += theme.questions.length;

        for (final question in theme.questions) {
          // Check for media
          final hasMedia = _questionHasMedia(question);
          if (hasMedia) questionsWithMedia++;

          // Check if incomplete
          final isIncomplete = _questionIsIncomplete(question);
          if (isIncomplete) incompleteQuestions++;
        }
      }
    }

    return _PackageStats(
      rounds: package.rounds.length,
      themes: totalThemes,
      questions: totalQuestions,
      questionsWithMedia: questionsWithMedia,
      emptyThemes: emptyThemes,
      incompleteQuestions: incompleteQuestions,
    );
  }

  bool _questionHasMedia(PackageQuestionUnion q) {
    final questionFiles = q.map(
      simple: (s) => s.questionFiles,
      stake: (s) => s.questionFiles,
      secret: (s) => s.questionFiles,
      noRisk: (s) => s.questionFiles,
      choice: (s) => s.questionFiles,
      hidden: (s) => s.questionFiles,
    );
    final answerFiles = q.map(
      simple: (s) => s.answerFiles,
      stake: (s) => s.answerFiles,
      secret: (s) => s.answerFiles,
      noRisk: (s) => s.answerFiles,
      choice: (s) => s.answerFiles,
      hidden: (s) => s.answerFiles,
    );
    return (questionFiles?.isNotEmpty ?? false) ||
        (answerFiles?.isNotEmpty ?? false);
  }

  bool _questionIsIncomplete(PackageQuestionUnion q) {
    final text = q.map(
      simple: (s) => s.text,
      stake: (s) => s.text,
      secret: (s) => s.text,
      noRisk: (s) => s.text,
      choice: (s) => s.text,
      hidden: (s) => s.text,
    );
    final answer = q.map(
      simple: (s) => s.answerText,
      stake: (s) => s.answerText,
      secret: (s) => s.answerText,
      noRisk: (s) => s.answerText,
      choice: (_) => 'has_choices',
      hidden: (s) => s.answerText,
    );
    return (text?.isEmpty ?? true) || (answer?.isEmpty ?? true);
  }
}

class _PackageStats {
  const _PackageStats({
    required this.rounds,
    required this.themes,
    required this.questions,
    required this.questionsWithMedia,
    required this.emptyThemes,
    required this.incompleteQuestions,
  });

  final int rounds;
  final int themes;
  final int questions;
  final int questionsWithMedia;
  final int emptyThemes;
  final int incompleteQuestions;
}

class _PackageHeader extends StatelessWidget {
  const _PackageHeader({
    required this.package,
    required this.translations,
  });

  final OqPackage package;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.inventory_2_outlined,
                    size: 28,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        package.title.isEmpty
                            ? 'Untitled Package'
                            : package.title,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                      ),
                      if (package.description?.isNotEmpty ?? false)
                        Text(
                          package.description!,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (package.language.isNotEmpty)
                  Chip(
                    avatar: const Icon(Icons.language, size: 16),
                    label: Text(package.language),
                    visualDensity: VisualDensity.compact,
                  ),
                Chip(
                  avatar: const Icon(Icons.person, size: 16),
                  label: Text(_formatAgeRestriction(package.ageRestriction)),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatAgeRestriction(AgeRestriction restriction) {
    return switch (restriction) {
      AgeRestriction.a18 => '18+',
      AgeRestriction.a16 => '16+',
      AgeRestriction.a12 => '12+',
      AgeRestriction.none => 'All ages',
      AgeRestriction.$unknown => 'Unknown',
    };
  }
}

class _StatisticsSection extends StatelessWidget {
  const _StatisticsSection({
    required this.stats,
    required this.translations,
    required this.isWide,
  });

  final _PackageStats stats;
  final dynamic translations;
  final bool isWide;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Statistics',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _StatCard(
              icon: Icons.layers_outlined,
              label: translations.rounds as String,
              value: stats.rounds.toString(),
              color: Theme.of(context).colorScheme.primary,
            ),
            _StatCard(
              icon: Icons.category_outlined,
              label: translations.themes as String,
              value: stats.themes.toString(),
              color: Theme.of(context).colorScheme.secondary,
            ),
            _StatCard(
              icon: Icons.quiz_outlined,
              label: translations.questions as String,
              value: stats.questions.toString(),
              color: Theme.of(context).colorScheme.tertiary,
            ),
            _StatCard(
              icon: Icons.perm_media_outlined,
              label: 'With Media',
              value: stats.questionsWithMedia.toString(),
              color: Colors.orange,
            ),
          ],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          width: 140,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 20, color: color),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                value,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActionsSection extends StatelessWidget {
  const _QuickActionsSection({
    required this.navController,
    required this.translations,
  });

  final EditorNavigationController navController;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              onPressed: () =>
                  navController.navigateTo(const PackageInfoLocation()),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Edit Package Info'),
            ),
            FilledButton.tonalIcon(
              onPressed: () =>
                  navController.navigateTo(const RoundsListLocation()),
              icon: const Icon(Icons.layers_outlined),
              label: Text('Manage ${translations.rounds}'),
            ),
            OutlinedButton.icon(
              onPressed: () {
                // Add new round
                final controller = GetIt.I<OqEditorController>();
                controller.addRound(PackageRound(
                  id: null,
                  order: 0,
                  name: translations.newRound as String,
                  description: '',
                  type: PackageRoundType.simple,
                  themes: [],
                ));
              },
              icon: const Icon(Icons.add),
              label: Text('Add ${translations.rounds}'),
            ),
          ],
        ),
      ],
    );
  }
}

class _CompletionSection extends StatelessWidget {
  const _CompletionSection({
    required this.package,
    required this.stats,
    required this.translations,
  });

  final OqPackage package;
  final _PackageStats stats;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    final hasIssues =
        stats.emptyThemes > 0 || stats.incompleteQuestions > 0;

    if (!hasIssues) {
      return Card(
        color: Colors.green.withValues(alpha: 0.1),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.green),
              const SizedBox(width: 12),
              Text(
                'Package is complete! All questions have content.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.green.shade700,
                    ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Completion Status',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        if (stats.emptyThemes > 0)
          _IssueCard(
            icon: Icons.warning_amber_outlined,
            color: Colors.orange,
            title: '${stats.emptyThemes} empty themes',
            subtitle: 'Themes without any questions',
          ),
        if (stats.incompleteQuestions > 0)
          _IssueCard(
            icon: Icons.edit_note,
            color: Colors.amber,
            title: '${stats.incompleteQuestions} incomplete questions',
            subtitle: 'Questions missing text or answer',
          ),
      ],
    );
  }
}

class _IssueCard extends StatelessWidget {
  const _IssueCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color.withValues(alpha: 0.1),
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StructureOverview extends StatelessWidget {
  const _StructureOverview({
    required this.package,
    required this.navController,
    required this.translations,
  });

  final OqPackage package;
  final EditorNavigationController navController;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    if (package.rounds.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Structure Overview',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        ...package.rounds.asMap().entries.map((entry) {
          final roundIndex = entry.key;
          final round = entry.value;

          return _RoundOverviewCard(
            round: round,
            roundIndex: roundIndex,
            navController: navController,
            translations: translations,
          );
        }),
      ],
    );
  }
}

class _RoundOverviewCard extends StatelessWidget {
  const _RoundOverviewCard({
    required this.round,
    required this.roundIndex,
    required this.navController,
    required this.translations,
  });

  final PackageRound round;
  final int roundIndex;
  final EditorNavigationController navController;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    final totalQuestions =
        round.themes.fold<int>(0, (sum, t) => sum + t.questions.length);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => navController.navigateTo(
          ThemesGridLocation(roundIndex: roundIndex),
        ),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${roundIndex + 1}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color:
                            Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      round.name,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    Text(
                      '${round.themes.length} themes • $totalQuestions questions',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: Theme.of(context).colorScheme.outline,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
