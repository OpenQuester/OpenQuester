import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class PackageEditorScreen extends StatefulWidget {
  const PackageEditorScreen({super.key});

  @override
  State<PackageEditorScreen> createState() => _PackageEditorScreenState();
}

class _PackageEditorScreenState extends State<PackageEditorScreen> {
  late final PackageEditorController controller;

  @override
  void initState() {
    super.initState();
    controller = PackageEditorController(
      packageService: getIt<PackageService>(),
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final wide = MediaQuery.sizeOf(context).width >= 1000;
        return PopScope(
          canPop: !controller.dirty,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) unawaited(_confirmLeave(context));
          },
          child: Scaffold(
            appBar: _EditorAppBar(controller: controller, wide: wide),
            drawer: wide
                ? null
                : Drawer(child: _PackageOutline(controller: controller)),
            body: Column(
              children: [
                if (controller.busy ||
                    controller.uploadState.phase ==
                        PackageUploadPhase.uploading)
                  LinearProgressIndicator(
                    value:
                        controller.uploadState.phase ==
                            PackageUploadPhase.uploading
                        ? controller.uploadState.progress
                        : null,
                  ),
                _BreadcrumbBar(controller: controller),
                if (controller.selectedQuestions.isNotEmpty)
                  _BatchToolbar(controller: controller),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (wide)
                        SizedBox(
                          width: 300,
                          child: _PackageOutline(controller: controller),
                        ),
                      Expanded(child: _EditorContent(controller: controller)),
                      if (wide && controller.location.questionIndex != null)
                        SizedBox(
                          width: 420,
                          child: _QuestionEditorPanel(controller: controller),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _confirmLeave(BuildContext context) async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(LocaleKeys.oq_editor_leave_warning.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(LocaleKeys.oq_editor_continue_editing.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(LocaleKeys.oq_editor_leave.tr()),
          ),
        ],
      ),
    );
    if (leave ?? false) {
      unawaited(AppRouter.I.maybePop());
    }
  }
}

class _EditorAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _EditorAppBar({required this.controller, required this.wide});

  final PackageEditorController controller;
  final bool wide;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      titleSpacing: wide ? 16 : null,
      title: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${LocaleKeys.package_editor.tr()}'
                '${controller.dirty ? ' •' : ''}',
              ),
              Text(
                controller.lastSavedAt == null
                    ? LocaleKeys.oq_editor_not_saved.tr()
                    : LocaleKeys.oq_editor_saved.tr(),
                style: context.textTheme.labelSmall,
              ),
            ],
          ),
          if (wide) ...[
            const SizedBox(width: 24),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: SearchBar(
                  hintText: LocaleKeys.oq_editor_search_all.tr(),
                  leading: const Icon(Icons.search),
                  trailing: controller.searchQuery.isEmpty
                      ? null
                      : [
                          IconButton(
                            onPressed: () => controller.setSearch(''),
                            icon: const Icon(Icons.close),
                          ),
                        ],
                  onChanged: controller.setSearch,
                ),
              ),
            ),
          ],
        ],
      ),
      actions: [
        if (!wide)
          IconButton(
            tooltip: LocaleKeys.oq_editor_search_all.tr(),
            onPressed: () => showSearch<void>(
              context: context,
              delegate: _EditorSearchDelegate(controller),
            ),
            icon: const Icon(Icons.search),
          ),
        IconButton(
          tooltip: LocaleKeys.oq_editor_import_package.tr(),
          onPressed: controller.busy
              ? null
              : () => _guard(context, controller.importPackage),
          icon: const Icon(Icons.file_open_outlined),
        ),
        IconButton(
          tooltip: LocaleKeys.oq_editor_export_package.tr(),
          onPressed: controller.busy
              ? null
              : () => _guard(context, controller.exportPackage),
          icon: const Icon(Icons.download_outlined),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: FilledButton.icon(
            onPressed:
                controller.busy || controller.health == PackageHealth.broken
                ? null
                : () => _save(context),
            icon: const Icon(Icons.cloud_upload_outlined),
            label: wide
                ? Text(LocaleKeys.oq_editor_save_to_server.tr())
                : const SizedBox.shrink(),
          ),
        ),
      ],
    );
  }

  Future<void> _save(BuildContext context) async {
    await _guard(context, () async {
      await const ProfileDialog().showIfUnauthorized(context);
      await controller.saveToServer();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(LocaleKeys.oq_editor_upload_complete.tr())),
        );
      }
    });
  }

  Future<void> _guard(
    BuildContext context,
    Future<void> Function() action,
  ) async {
    try {
      await action();
    } catch (error, stackTrace) {
      logger.e(
        'Package editor action failed',
        error: error,
        stackTrace: stackTrace,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${LocaleKeys.oq_editor_error_generic.tr()}: $error'),
          ),
        );
      }
    }
  }
}

class _BreadcrumbBar extends StatelessWidget {
  const _BreadcrumbBar({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    final location = controller.location;
    final round = location.roundIndex == null
        ? null
        : controller.package.rounds[location.roundIndex!];
    final theme = location.themeIndex == null
        ? null
        : round!.themes[location.themeIndex!];
    return Material(
      color: context.theme.colorScheme.surfaceContainerLow,
      child: SizedBox(
        height: 48,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            _Crumb(
              label: controller.package.title.isEmpty
                  ? LocaleKeys.oq_editor_package_info.tr()
                  : controller.package.title,
              onTap: () => controller.select(const EditorLocation()),
            ),
            if (round != null) ...[
              const _Chevron(),
              _Crumb(
                label: round.name,
                onTap: () => controller.select(
                  EditorLocation(roundIndex: location.roundIndex),
                ),
              ),
            ],
            if (theme != null) ...[
              const _Chevron(),
              _Crumb(
                label: theme.name,
                onTap: () => controller.select(
                  EditorLocation(
                    roundIndex: location.roundIndex,
                    themeIndex: location.themeIndex,
                  ),
                ),
              ),
            ],
            if (location.questionIndex != null) ...[
              const _Chevron(),
              _Crumb(
                label:
                    '${LocaleKeys.oq_editor_questions.tr()} '
                    '${location.questionIndex! + 1}',
                onTap: () {},
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Crumb extends StatelessWidget {
  const _Crumb({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) =>
      TextButton(onPressed: onTap, child: Text(label));
}

class _Chevron extends StatelessWidget {
  const _Chevron();

  @override
  Widget build(BuildContext context) =>
      const Icon(Icons.chevron_right, size: 18);
}

class _PackageOutline extends StatelessWidget {
  const _PackageOutline({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.theme.colorScheme.surfaceContainerLow,
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: 12),
        children: [
          ListTile(
            leading: const Icon(Icons.dashboard_outlined),
            title: Text(LocaleKeys.oq_editor_overview.tr()),
            selected: controller.location.roundIndex == null,
            onTap: () => controller.select(const EditorLocation()),
          ),
          for (var r = 0; r < controller.package.rounds.length; r++)
            ExpansionTile(
              initiallyExpanded: controller.location.roundIndex == r,
              leading: const Icon(Icons.layers_outlined),
              title: Text(controller.package.rounds[r].name),
              subtitle: Text(
                LocaleKeys.oq_editor_themes_count.tr(
                  args: ['${controller.package.rounds[r].themes.length}'],
                ),
              ),
              onExpansionChanged: (expanded) {
                if (expanded) controller.select(EditorLocation(roundIndex: r));
              },
              children: [
                for (
                  var t = 0;
                  t < controller.package.rounds[r].themes.length;
                  t++
                )
                  ListTile(
                    dense: true,
                    contentPadding: const EdgeInsets.only(left: 48, right: 12),
                    leading: const Icon(Icons.topic_outlined, size: 20),
                    title: Text(controller.package.rounds[r].themes[t].name),
                    subtitle: Text(
                      LocaleKeys.oq_editor_questions_in_theme.tr(
                        args: [
                          controller
                              .package
                              .rounds[r]
                              .themes[t]
                              .questions
                              .length
                              .toString(),
                        ],
                      ),
                    ),
                    selected:
                        controller.location.roundIndex == r &&
                        controller.location.themeIndex == t,
                    onTap: () => controller.select(
                      EditorLocation(roundIndex: r, themeIndex: t),
                    ),
                  ),
              ],
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: OutlinedButton.icon(
              onPressed: controller.addRound,
              icon: const Icon(Icons.add),
              label: Text(LocaleKeys.oq_editor_add_round.tr()),
            ),
          ),
        ],
      ),
    );
  }
}

class _EditorContent extends StatelessWidget {
  const _EditorContent({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.searchQuery.trim().isNotEmpty) {
      return _SearchResults(controller: controller);
    }
    final location = controller.location;
    if (location.roundIndex == null) return _Dashboard(controller: controller);
    if (location.themeIndex == null) return _RoundView(controller: controller);
    if (location.questionIndex != null &&
        MediaQuery.sizeOf(context).width < 1000) {
      return _QuestionEditorPanel(controller: controller);
    }
    return _ThemeView(controller: controller);
  }
}

class _Dashboard extends StatelessWidget {
  const _Dashboard({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _StatCard(
              icon: Icons.layers_outlined,
              value: controller.roundCount,
              label: LocaleKeys.oq_editor_rounds.tr(),
            ),
            _StatCard(
              icon: Icons.topic_outlined,
              value: controller.themeCount,
              label: LocaleKeys.oq_editor_themes.tr(),
            ),
            _StatCard(
              icon: Icons.quiz_outlined,
              value: controller.questionCount,
              label: LocaleKeys.oq_editor_questions.tr(),
            ),
            _StatCard(
              icon: Icons.perm_media_outlined,
              value: controller.mediaFilesByHash.length,
              label: LocaleKeys.oq_editor_media_files.tr(),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  LocaleKeys.oq_editor_package_info.tr(),
                  style: context.textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: ValueKey('title-${controller.package.id}'),
                  initialValue: controller.package.title,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_package_title.tr(),
                  ),
                  onChanged: (value) =>
                      controller.updatePackageInfo(title: value),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: ValueKey('description-${controller.package.id}'),
                  initialValue: controller.package.description,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_package_description.tr(),
                  ),
                  onChanged: (value) =>
                      controller.updatePackageInfo(description: value),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: ValueKey('language-${controller.package.id}'),
                  initialValue: controller.package.language,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_package_language.tr(),
                  ),
                  onChanged: (value) =>
                      controller.updatePackageInfo(language: value),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        _ValidationCard(controller: controller),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, color: context.theme.colorScheme.primary),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$value', style: context.textTheme.headlineSmall),
                  Text(label),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ValidationCard extends StatelessWidget {
  const _ValidationCard({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    final issues = controller.validationIssues;
    final color = switch (controller.health) {
      PackageHealth.good => Colors.green,
      PackageHealth.needsAttention => Colors.amber,
      PackageHealth.broken => context.theme.colorScheme.error,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.health_and_safety_outlined, color: color),
                const SizedBox(width: 12),
                Text(
                  LocaleKeys.oq_editor_package_health.tr(),
                  style: context.textTheme.titleLarge,
                ),
                const Spacer(),
                Chip(
                  avatar: Icon(Icons.circle, size: 12, color: color),
                  label: Text(
                    switch (controller.health) {
                      PackageHealth.good =>
                        LocaleKeys.oq_editor_health_good.tr(),
                      PackageHealth.needsAttention =>
                        LocaleKeys.oq_editor_health_needs_attention.tr(),
                      PackageHealth.broken =>
                        LocaleKeys.oq_editor_health_broken.tr(),
                    },
                  ),
                ),
              ],
            ),
            if (issues.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(LocaleKeys.oq_editor_no_issues.tr()),
              )
            else
              for (final issue in issues)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    issue.critical ? Icons.error_outline : Icons.warning_amber,
                    color: issue.critical
                        ? context.theme.colorScheme.error
                        : Colors.amber,
                  ),
                  title: Text(issue.message.tr()),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => controller.select(issue.location),
                ),
          ],
        ),
      ),
    );
  }
}

class _RoundView extends StatelessWidget {
  const _RoundView({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    final r = controller.location.roundIndex!;
    final round = controller.package.rounds[r];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SectionHeader(
          title: round.name,
          subtitle: round.description,
          onAdd: () => controller.addTheme(r),
          addLabel: LocaleKeys.oq_editor_add_theme.tr(),
          onDelete: () => controller.deleteRound(r),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextFormField(
                  initialValue: round.name,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_round_name.tr(),
                  ),
                  onChanged: (name) => controller.updateRound(
                    r,
                    name: name,
                    description: round.description,
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: round.description,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_round_description.tr(),
                  ),
                  onChanged: (description) => controller.updateRound(
                    r,
                    name: round.name,
                    description: description,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        for (var t = 0; t < round.themes.length; t++)
          _EditorItemCard(
            color: Colors.green,
            icon: Icons.topic_outlined,
            title: round.themes[t].name,
            subtitle:
                '${round.themes[t].questions.length} '
                '${LocaleKeys.oq_editor_questions.tr()}',
            onTap: () =>
                controller.select(EditorLocation(roundIndex: r, themeIndex: t)),
            onDelete: () => controller.deleteTheme(r, t),
          ),
      ],
    );
  }
}

class _ThemeView extends StatelessWidget {
  const _ThemeView({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    final r = controller.location.roundIndex!;
    final t = controller.location.themeIndex!;
    final theme = controller.package.rounds[r].themes[t];
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: _SectionHeader(
            title: theme.name,
            subtitle: theme.description,
            onAdd: () => controller.addQuestion(r, t),
            addLabel: LocaleKeys.oq_editor_add_question.tr(),
            onDelete: () => controller.deleteTheme(r, t),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final filter in EditorQuestionFilter.values)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            selected: controller.filter == filter,
                            label: Text(filter.name),
                            onSelected: (_) => controller.setFilter(filter),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              IconButton(
                tooltip: LocaleKeys.oq_editor_density.tr(),
                onPressed: controller.toggleDensity,
                icon: Icon(
                  controller.compact
                      ? Icons.view_agenda_outlined
                      : Icons.density_small,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: controller.questionsFor(r, t).isEmpty
              ? Center(child: Text(LocaleKeys.oq_editor_no_questions.tr()))
              : ReorderableListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  itemCount: controller.questionsFor(r, t).length,
                  onReorderItem: controller.filter == EditorQuestionFilter.all
                      ? (oldIndex, newIndex) => controller.reorderQuestion(
                          r,
                          t,
                          oldIndex,
                          newIndex,
                        )
                      : (_, _) {},
                  itemBuilder: (context, visibleIndex) {
                    final question = controller.questionsFor(
                      r,
                      t,
                    )[visibleIndex];
                    final questionIndex = theme.questions.indexOf(question);
                    final location = EditorLocation(
                      roundIndex: r,
                      themeIndex: t,
                      questionIndex: questionIndex,
                    );
                    return KeyedSubtree(
                      key: ValueKey('${location.key}-${question.id}'),
                      child: _QuestionRow(
                        question: question,
                        index: questionIndex,
                        compact: controller.compact,
                        selected: controller.selectedQuestions.contains(
                          location.key,
                        ),
                        active:
                            controller.location.questionIndex == questionIndex,
                        onSelected: () => controller.toggleQuestionSelection(
                          r,
                          t,
                          questionIndex,
                        ),
                        onTap: () => controller.select(location),
                        onDelete: () =>
                            controller.deleteQuestion(r, t, questionIndex),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _QuestionRow extends StatelessWidget {
  const _QuestionRow({
    required this.question,
    required this.index,
    required this.compact,
    required this.selected,
    required this.active,
    required this.onSelected,
    required this.onTap,
    required this.onDelete,
  });

  final PackageQuestionUnion question;
  final int index;
  final bool compact;
  final bool selected;
  final bool active;
  final VoidCallback onSelected;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final type = PackageEditorController.questionType(question);
    final answerLabel = LocaleKeys.oq_editor_answer.tr();
    final answerText =
        question.answerText ?? LocaleKeys.oq_editor_empty_answer.tr();
    final typeColor = switch (type) {
      'secret' => Colors.purple,
      'stake' => Colors.amber,
      'noRisk' => Colors.green,
      'choice' => Colors.blue,
      'hidden' => Colors.grey,
      _ => Colors.orange,
    };
    return Card(
      color: active ? context.theme.colorScheme.primaryContainer : null,
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          children: [
            Container(width: 5, color: typeColor),
            Checkbox(value: selected, onChanged: (_) => onSelected()),
            SizedBox(
              width: 36,
              child: Text('#${index + 1}', textAlign: TextAlign.center),
            ),
            Expanded(
              child: InkWell(
                onTap: onTap,
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: compact ? 10 : 16,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (question.text ?? '').isEmpty
                            ? LocaleKeys.oq_editor_untitled_question.tr()
                            : question.text!,
                        maxLines: compact ? 1 : 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$answerLabel: $answerText',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (question.questionFiles?.isNotEmpty ?? false)
              const Padding(
                padding: EdgeInsets.all(6),
                child: Icon(Icons.perm_media_outlined, size: 18),
              ),
            Chip(label: Text(type)),
            SizedBox(
              width: 72,
              child: Text(
                '${question.price ?? '—'} ${LocaleKeys.oq_editor_pts.tr()}',
              ),
            ),
            IconButton(onPressed: onTap, icon: const Icon(Icons.edit_outlined)),
            IconButton(
              onPressed: onDelete,
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuestionEditorPanel extends StatelessWidget {
  const _QuestionEditorPanel({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    final location = controller.location;
    final r = location.roundIndex!;
    final t = location.themeIndex!;
    final q = location.questionIndex!;
    final question = controller.package.rounds[r].themes[t].questions[q];
    var text = question.text ?? '';
    var answer = question.answerText ?? '';
    var price = question.price;
    void update() => controller.updateQuestion(
      r,
      t,
      q,
      text: text,
      answer: answer,
      price: price,
    );

    return Material(
      color: context.theme.colorScheme.surface,
      elevation: 3,
      child: ListView(
        key: ValueKey(location.key),
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  LocaleKeys.oq_editor_edit_question.tr(),
                  style: context.textTheme.titleLarge,
                ),
              ),
              IconButton(
                tooltip: LocaleKeys.oq_editor_back.tr(),
                onPressed: () => controller.select(
                  EditorLocation(roundIndex: r, themeIndex: t),
                ),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Chip(label: Text(PackageEditorController.questionType(question))),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: text,
            minLines: 3,
            maxLines: 8,
            decoration: InputDecoration(
              labelText: LocaleKeys.oq_editor_question_text.tr(),
            ),
            onChanged: (value) {
              text = value;
              update();
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: answer,
            minLines: 2,
            maxLines: 5,
            decoration: InputDecoration(
              labelText: LocaleKeys.oq_editor_question_answer.tr(),
            ),
            onChanged: (value) {
              answer = value;
              update();
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: price?.toString(),
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: LocaleKeys.oq_editor_question_price.tr(),
            ),
            onChanged: (value) {
              price = int.tryParse(value);
              update();
            },
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => controller.addMedia(
                  r,
                  t,
                  q,
                  answerMedia: false,
                ),
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: Text(LocaleKeys.oq_editor_question_media.tr()),
              ),
              OutlinedButton.icon(
                onPressed: () => controller.addMedia(
                  r,
                  t,
                  q,
                  answerMedia: true,
                ),
                icon: const Icon(Icons.add_to_photos_outlined),
                label: Text(LocaleKeys.oq_editor_answer_media.tr()),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${question.questionFiles?.length ?? 0} '
            '${LocaleKeys.oq_editor_question_media.tr()} • '
            '${question.answerFiles?.length ?? 0} '
            '${LocaleKeys.oq_editor_answer_media.tr()}',
            style: context.textTheme.bodySmall,
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => controller.deleteQuestion(r, t, q),
            icon: const Icon(Icons.delete_outline),
            label: Text(LocaleKeys.oq_editor_delete.tr()),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.subtitle,
    required this.onAdd,
    required this.addLabel,
    required this.onDelete,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onAdd;
  final String addLabel;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: context.textTheme.headlineSmall),
              if (subtitle?.isNotEmpty ?? false) Text(subtitle!),
            ],
          ),
        ),
        OutlinedButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add),
          label: Text(addLabel),
        ),
        IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline)),
      ],
    );
  }
}

class _EditorItemCard extends StatelessWidget {
  const _EditorItemCard({
    required this.color,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.onDelete,
  });

  final Color color;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .16),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color),
        ),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: IconButton(
          onPressed: onDelete,
          icon: const Icon(Icons.delete_outline),
        ),
        onTap: onTap,
      ),
    );
  }
}

class _BatchToolbar extends StatelessWidget {
  const _BatchToolbar({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.theme.colorScheme.secondaryContainer,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(
          children: [
            Text(
              '${controller.selectedQuestions.length} '
              '${LocaleKeys.oq_editor_selected.tr()}',
            ),
            const Spacer(),
            PopupMenuButton<EditorLocation>(
              tooltip: LocaleKeys.oq_editor_move.tr(),
              onSelected: (location) => controller.moveSelected(
                location.roundIndex!,
                location.themeIndex!,
              ),
              itemBuilder: (context) => [
                for (var r = 0; r < controller.package.rounds.length; r++)
                  for (
                    var t = 0;
                    t < controller.package.rounds[r].themes.length;
                    t++
                  )
                    PopupMenuItem(
                      value: EditorLocation(roundIndex: r, themeIndex: t),
                      child: Text(
                        '${controller.package.rounds[r].name} → '
                        '${controller.package.rounds[r].themes[t].name}',
                      ),
                    ),
              ],
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    const Icon(Icons.drive_file_move_outline),
                    const SizedBox(width: 6),
                    Text(LocaleKeys.oq_editor_move.tr()),
                  ],
                ),
              ),
            ),
            TextButton.icon(
              onPressed: controller.duplicateSelected,
              icon: const Icon(Icons.copy_outlined),
              label: Text(LocaleKeys.oq_editor_duplicate.tr()),
            ),
            TextButton.icon(
              onPressed: controller.deleteSelected,
              icon: const Icon(Icons.delete_outline),
              label: Text(LocaleKeys.oq_editor_delete.tr()),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchResults extends StatelessWidget {
  const _SearchResults({required this.controller});

  final PackageEditorController controller;

  @override
  Widget build(BuildContext context) {
    final results = controller.searchResults;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          LocaleKeys.oq_editor_search_results.tr(),
          style: context.textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        if (results.isEmpty) Text(LocaleKeys.oq_editor_no_search_results.tr()),
        for (final result in results)
          ListTile(
            leading: const Icon(Icons.search),
            title: Text(result.label),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              controller
                ..setSearch('')
                ..select(result.location);
            },
          ),
      ],
    );
  }
}

class _EditorSearchDelegate extends SearchDelegate<void> {
  _EditorSearchDelegate(this.controller);

  final PackageEditorController controller;

  @override
  List<Widget>? buildActions(BuildContext context) => [
    IconButton(onPressed: () => query = '', icon: const Icon(Icons.clear)),
  ];

  @override
  Widget? buildLeading(BuildContext context) => IconButton(
    onPressed: () => close(context, null),
    icon: const Icon(Icons.arrow_back),
  );

  @override
  Widget buildResults(BuildContext context) => _results(context);

  @override
  Widget buildSuggestions(BuildContext context) => _results(context);

  Widget _results(BuildContext context) {
    controller.setSearch(query);
    return ListView(
      children: [
        for (final result in controller.searchResults)
          ListTile(
            title: Text(result.label),
            onTap: () {
              controller
                ..setSearch('')
                ..select(result.location);
              close(context, null);
            },
          ),
      ],
    );
  }
}
