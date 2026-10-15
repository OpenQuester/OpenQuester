import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

String _questionTypeLabel(EditorQuestionFilter type) => switch (type) {
  EditorQuestionFilter.all => LocaleKeys.oq_editor_question_type_all.tr(),
  EditorQuestionFilter.simple => LocaleKeys.oq_editor_question_type_simple.tr(),
  EditorQuestionFilter.stake => LocaleKeys.oq_editor_question_type_stake.tr(),
  EditorQuestionFilter.secret => LocaleKeys.oq_editor_question_type_secret.tr(),
  EditorQuestionFilter.noRisk =>
    LocaleKeys.oq_editor_question_type_no_risk.tr(),
  EditorQuestionFilter.choice => LocaleKeys.oq_editor_question_type_choice.tr(),
  EditorQuestionFilter.hidden => LocaleKeys.oq_editor_question_type_hidden.tr(),
};

String _stakeSubTypeLabel(StakeQuestionSubType type) => switch (type) {
  StakeQuestionSubType.simple => LocaleKeys.oq_editor_subtype_simple.tr(),
  StakeQuestionSubType.forEveryone =>
    LocaleKeys.oq_editor_subtype_for_everyone.tr(),
  StakeQuestionSubType.$unknown =>
    LocaleKeys.oq_editor_question_type_unknown.tr(),
};

String _secretSubTypeLabel(SecretQuestionSubType type) => switch (type) {
  SecretQuestionSubType.simple => LocaleKeys.oq_editor_subtype_simple.tr(),
  SecretQuestionSubType.customPrice =>
    LocaleKeys.oq_editor_subtype_custom_price.tr(),
  SecretQuestionSubType.$unknown =>
    LocaleKeys.oq_editor_question_type_unknown.tr(),
};

String _noRiskSubTypeLabel(NoRiskQuestionSubType type) => switch (type) {
  NoRiskQuestionSubType.simple => LocaleKeys.oq_editor_subtype_simple.tr(),
  NoRiskQuestionSubType.forEveryone =>
    LocaleKeys.oq_editor_subtype_for_everyone.tr(),
  NoRiskQuestionSubType.$unknown =>
    LocaleKeys.oq_editor_question_type_unknown.tr(),
};

String _transferTypeLabel(QuestionTransferType type) => switch (type) {
  QuestionTransferType.any => LocaleKeys.oq_editor_transfer_any.tr(),
  QuestionTransferType.exceptCurrent =>
    LocaleKeys.oq_editor_transfer_except_current.tr(),
  QuestionTransferType.$unknown =>
    LocaleKeys.oq_editor_question_type_unknown.tr(),
};

String _ageRestrictionLabel(AgeRestriction age) => switch (age) {
  AgeRestriction.a18 => '18+',
  AgeRestriction.a16 => '16+',
  AgeRestriction.a12 => '12+',
  AgeRestriction.none => LocaleKeys.oq_editor_age_none.tr(),
  AgeRestriction.$unknown => LocaleKeys.oq_editor_question_type_unknown.tr(),
};

String _roundTypeLabel(PackageRoundType type) => switch (type) {
  PackageRoundType.simple => LocaleKeys.oq_editor_round_type_simple.tr(),
  PackageRoundType.valueFinal => LocaleKeys.oq_editor_round_type_final.tr(),
  PackageRoundType.$unknown => LocaleKeys.oq_editor_round_type_unknown.tr(),
};

String _mediaMimeType(String? extension, PackageFileType type) {
  return switch (extension?.toLowerCase()) {
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'mp3' => 'audio/mpeg',
    'wav' => 'audio/wav',
    'ogg' => 'audio/ogg',
    'mp4' => 'video/mp4',
    'webm' => 'video/webm',
    _ =>
      type == PackageFileType.audio
          ? 'audio/mpeg'
          : type == PackageFileType.video
          ? 'video/mp4'
          : 'image/png',
  };
}

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
                const SizedBox(height: 12),
                DropdownButtonFormField<AgeRestriction>(
                  initialValue: controller.package.ageRestriction,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_package_age_restriction
                        .tr(),
                  ),
                  items: [
                    for (final age in AgeRestriction.$valuesDefined)
                      DropdownMenuItem(
                        value: age,
                        child: Text(_ageRestrictionLabel(age)),
                      ),
                  ],
                  onChanged: (age) =>
                      controller.updatePackageInfo(ageRestriction: age),
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
                const SizedBox(height: 12),
                DropdownButtonFormField<PackageRoundType>(
                  initialValue: round.type == PackageRoundType.$unknown
                      ? PackageRoundType.simple
                      : round.type,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_round_type.tr(),
                  ),
                  items: [
                    for (final type in PackageRoundType.$valuesDefined)
                      DropdownMenuItem(
                        value: type,
                        child: Text(_roundTypeLabel(type)),
                      ),
                  ],
                  onChanged: (type) => controller.updateRound(
                    r,
                    name: round.name,
                    description: round.description,
                    type: type,
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
                            label: Text(_questionTypeLabel(filter)),
                            onSelected: (_) => controller.setFilter(filter),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              if (MediaQuery.sizeOf(context).width >= 700)
                OutlinedButton.icon(
                  onPressed: () => _addFromFiles(context, r, t),
                  icon: const Icon(Icons.auto_awesome_outlined),
                  label: Text(
                    LocaleKeys.oq_editor_add_question_from_files.tr(),
                  ),
                )
              else
                IconButton(
                  tooltip: LocaleKeys.oq_editor_add_question_from_files_hint
                      .tr(),
                  onPressed: () => _addFromFiles(context, r, t),
                  icon: const Icon(Icons.auto_awesome_outlined),
                ),
              const SizedBox(width: 8),
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
                        controller: controller,
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

  Future<void> _addFromFiles(
    BuildContext context,
    int roundIndex,
    int themeIndex,
  ) async {
    final result = await controller.addQuestionFromMediaPair(
      roundIndex,
      themeIndex,
    );
    if (!context.mounted || result == MediaPairImportResult.cancelled) return;
    final message = switch (result) {
      MediaPairImportResult.added => LocaleKeys.oq_editor_media_pair_added.tr(),
      MediaPairImportResult.requiresTwoFiles =>
        LocaleKeys.oq_editor_media_pair_requires_two.tr(),
      MediaPairImportResult.unreadableFile =>
        LocaleKeys.oq_editor_media_pair_unreadable.tr(),
      MediaPairImportResult.cancelled => '',
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

class _QuestionRow extends StatelessWidget {
  const _QuestionRow({
    required this.controller,
    required this.question,
    required this.index,
    required this.compact,
    required this.selected,
    required this.active,
    required this.onSelected,
    required this.onTap,
    required this.onDelete,
  });

  final PackageEditorController controller;
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
    final questionFiles = question.questionFiles;
    final answerFiles = question.answerFiles;
    final previewFile = questionFiles?.isNotEmpty ?? false
        ? questionFiles!.first
        : answerFiles?.isNotEmpty ?? false
        ? answerFiles!.first
        : null;
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
                      if (previewFile != null) ...[
                        SizedBox(height: compact ? 4 : 10),
                        _EditorMediaPreview(
                          controller: controller,
                          file: previewFile,
                          size: compact ? 52 : 140,
                          enablePlayback: !compact,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            Chip(
              label: Text(
                _questionTypeLabel(
                  PackageEditorController.questionFilter(question),
                ),
              ),
            ),
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
    var showAnswerDuration = question.showAnswerDuration;
    var answerDelay = question.answerDelay;
    var isHidden = question.isHidden;
    var answerHint = question.answerHint ?? '';
    var questionComment = question.questionComment ?? '';
    void update() => controller.updateQuestionDetails(
      r,
      t,
      q,
      text: text,
      answer: answer,
      price: price,
      showAnswerDuration: showAnswerDuration,
      answerDelay: answerDelay,
      isHidden: isHidden,
      answerHint: answerHint,
      questionComment: questionComment,
    );

    return Material(
      color: context.theme.colorScheme.surface,
      elevation: 3,
      child: ListView(
        key: ValueKey(
          '${location.key}-'
          '${PackageEditorController.questionType(question)}',
        ),
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
          DropdownButtonFormField<EditorQuestionFilter>(
            initialValue: PackageEditorController.questionFilter(question),
            decoration: InputDecoration(
              labelText: LocaleKeys.oq_editor_question_type_label.tr(),
            ),
            items: [
              for (final type in EditorQuestionFilter.values.skip(1))
                DropdownMenuItem(
                  value: type,
                  child: Text(_questionTypeLabel(type)),
                ),
            ],
            onChanged: (type) {
              if (type != null) {
                controller.changeQuestionType(r, t, q, type);
              }
            },
          ),
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
          Card(
            margin: EdgeInsets.zero,
            child: ExpansionTile(
              title: Text(LocaleKeys.oq_editor_advanced_settings.tr()),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              children: [
                TextFormField(
                  initialValue: answerHint,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_question_hint.tr(),
                    helperText: LocaleKeys.oq_editor_question_hint_helper.tr(),
                  ),
                  onChanged: (value) {
                    answerHint = value;
                    update();
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: questionComment,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_question_comment.tr(),
                    helperText: LocaleKeys.oq_editor_question_comment_helper
                        .tr(),
                  ),
                  onChanged: (value) {
                    questionComment = value;
                    update();
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: showAnswerDuration?.toString(),
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_show_answer_duration.tr(),
                    suffixText: LocaleKeys.oq_editor_ms.tr(),
                  ),
                  onChanged: (value) {
                    showAnswerDuration = int.tryParse(value);
                    update();
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: answerDelay?.toString(),
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: LocaleKeys.oq_editor_answer_delay.tr(),
                    helperText: LocaleKeys.oq_editor_answer_delay_hint.tr(),
                    suffixText: LocaleKeys.oq_editor_ms.tr(),
                  ),
                  onChanged: (value) {
                    answerDelay = int.tryParse(value);
                    update();
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(LocaleKeys.oq_editor_is_hidden.tr()),
                  subtitle: Text(LocaleKeys.oq_editor_is_hidden_desc.tr()),
                  value: isHidden,
                  onChanged: (value) {
                    isHidden = value;
                    update();
                  },
                ),
                _QuestionTypeSettings(
                  controller: controller,
                  question: question,
                  roundIndex: r,
                  themeIndex: t,
                  questionIndex: q,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _EditorMediaSection(
            controller: controller,
            title: LocaleKeys.oq_editor_question_media.tr(),
            files: question.questionFiles ?? const [],
            roundIndex: r,
            themeIndex: t,
            questionIndex: q,
            answerMedia: false,
          ),
          const SizedBox(height: 16),
          _EditorMediaSection(
            controller: controller,
            title: LocaleKeys.oq_editor_answer_media.tr(),
            files: question.answerFiles ?? const [],
            roundIndex: r,
            themeIndex: t,
            questionIndex: q,
            answerMedia: true,
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

class _QuestionTypeSettings extends StatelessWidget {
  const _QuestionTypeSettings({
    required this.controller,
    required this.question,
    required this.roundIndex,
    required this.themeIndex,
    required this.questionIndex,
  });

  final PackageEditorController controller;
  final PackageQuestionUnion question;
  final int roundIndex;
  final int themeIndex;
  final int questionIndex;

  @override
  Widget build(BuildContext context) => switch (question) {
    final PackageQuestionUnionStake question => _stake(context, question),
    final PackageQuestionUnionSecret question => _secret(context, question),
    final PackageQuestionUnionNoRisk question => _noRisk(context, question),
    final PackageQuestionUnionChoice question => _choice(context, question),
    _ => const SizedBox.shrink(),
  };

  Widget _stake(
    BuildContext context,
    PackageQuestionUnionStake question,
  ) {
    return Column(
      children: [
        DropdownButtonFormField<StakeQuestionSubType>(
          initialValue: question.subType == StakeQuestionSubType.$unknown
              ? null
              : question.subType,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_stake_sub_type.tr(),
          ),
          items: [
            for (final type in StakeQuestionSubType.$valuesDefined)
              DropdownMenuItem(
                value: type,
                child: Text(_stakeSubTypeLabel(type)),
              ),
          ],
          onChanged: (type) {
            if (type != null) {
              controller.updateStakeSettings(
                roundIndex,
                themeIndex,
                questionIndex,
                subType: type,
                maxPrice: question.maxPrice,
              );
            }
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: question.maxPrice?.toString(),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_stake_max_price.tr(),
            helperText: LocaleKeys.oq_editor_stake_max_price_hint.tr(),
          ),
          onChanged: (value) => controller.updateStakeSettings(
            roundIndex,
            themeIndex,
            questionIndex,
            subType: question.subType,
            maxPrice: int.tryParse(value),
          ),
        ),
      ],
    );
  }

  Widget _secret(
    BuildContext context,
    PackageQuestionUnionSecret question,
  ) {
    return Column(
      children: [
        DropdownButtonFormField<SecretQuestionSubType>(
          initialValue: question.subType == SecretQuestionSubType.$unknown
              ? null
              : question.subType,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_secret_sub_type.tr(),
          ),
          items: [
            for (final type in SecretQuestionSubType.$valuesDefined)
              DropdownMenuItem(
                value: type,
                child: Text(_secretSubTypeLabel(type)),
              ),
          ],
          onChanged: (type) {
            if (type != null) {
              controller.updateSecretSettings(
                roundIndex,
                themeIndex,
                questionIndex,
                subType: type,
                transferType: question.transferType,
                allowedPrices: question.allowedPrices,
              );
            }
          },
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<QuestionTransferType>(
          initialValue: question.transferType == QuestionTransferType.$unknown
              ? null
              : question.transferType,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_secret_transfer_type.tr(),
          ),
          items: [
            for (final type in QuestionTransferType.$valuesDefined)
              DropdownMenuItem(
                value: type,
                child: Text(_transferTypeLabel(type)),
              ),
          ],
          onChanged: (type) {
            if (type != null) {
              controller.updateSecretSettings(
                roundIndex,
                themeIndex,
                questionIndex,
                subType: question.subType,
                transferType: type,
                allowedPrices: question.allowedPrices,
              );
            }
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: question.allowedPrices?.join(', '),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_allowed_prices.tr(),
            helperText: LocaleKeys.oq_editor_no_prices_set_defaults.tr(),
          ),
          onChanged: (value) => controller.updateSecretSettings(
            roundIndex,
            themeIndex,
            questionIndex,
            subType: question.subType,
            transferType: question.transferType,
            allowedPrices: _parsePrices(value),
          ),
        ),
      ],
    );
  }

  Widget _noRisk(
    BuildContext context,
    PackageQuestionUnionNoRisk question,
  ) {
    return Column(
      children: [
        DropdownButtonFormField<NoRiskQuestionSubType>(
          initialValue: question.subType == NoRiskQuestionSubType.$unknown
              ? null
              : question.subType,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_no_risk_sub_type.tr(),
          ),
          items: [
            for (final type in NoRiskQuestionSubType.$valuesDefined)
              DropdownMenuItem(
                value: type,
                child: Text(_noRiskSubTypeLabel(type)),
              ),
          ],
          onChanged: (type) {
            if (type != null) {
              controller.updateNoRiskSettings(
                roundIndex,
                themeIndex,
                questionIndex,
                subType: type,
                priceMultiplier: question.priceMultiplier,
              );
            }
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: question.priceMultiplier,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_price_multiplier.tr(),
            helperText: LocaleKeys.oq_editor_price_multiplier_hint.tr(),
          ),
          onChanged: (value) {
            if (value.trim().isNotEmpty) {
              controller.updateNoRiskSettings(
                roundIndex,
                themeIndex,
                questionIndex,
                subType: question.subType,
                priceMultiplier: value,
              );
            }
          },
        ),
      ],
    );
  }

  Widget _choice(
    BuildContext context,
    PackageQuestionUnionChoice question,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          initialValue: question.showDelay.toString(),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: LocaleKeys.oq_editor_show_delay.tr(),
            helperText: LocaleKeys.oq_editor_show_delay_hint.tr(),
            suffixText: LocaleKeys.oq_editor_ms.tr(),
          ),
          onChanged: (value) {
            final delay = int.tryParse(value);
            if (delay != null) {
              controller.updateChoiceShowDelay(
                roundIndex,
                themeIndex,
                questionIndex,
                delay,
              );
            }
          },
        ),
        const SizedBox(height: 12),
        Text(
          LocaleKeys.oq_editor_choice_answers.tr(),
          style: context.textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < question.answers.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: TextFormField(
                    key: ValueKey('choice-$questionIndex-$i'),
                    initialValue: question.answers[i].text,
                    decoration: InputDecoration(
                      labelText:
                          '${LocaleKeys.oq_editor_answer_text.tr()} ${i + 1}',
                    ),
                    onChanged: (value) => controller.updateChoiceAnswer(
                      roundIndex,
                      themeIndex,
                      questionIndex,
                      i,
                      value,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: LocaleKeys.oq_editor_delete.tr(),
                  onPressed: question.answers.length <= 2
                      ? null
                      : () => controller.removeChoiceAnswer(
                          roundIndex,
                          themeIndex,
                          questionIndex,
                          i,
                        ),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
              ],
            ),
          ),
        OutlinedButton.icon(
          onPressed: question.answers.length >= 8
              ? null
              : () => controller.addChoiceAnswer(
                  roundIndex,
                  themeIndex,
                  questionIndex,
                ),
          icon: const Icon(Icons.add),
          label: Text(LocaleKeys.oq_editor_add_choice_answer.tr()),
        ),
      ],
    );
  }

  List<int>? _parsePrices(String value) {
    final prices = value
        .split(RegExp(r'[,;\s]+'))
        .map(int.tryParse)
        .whereType<int>()
        .take(5)
        .toList();
    return prices.isEmpty ? null : prices;
  }
}

class _EditorMediaSection extends StatelessWidget {
  const _EditorMediaSection({
    required this.controller,
    required this.title,
    required this.files,
    required this.roundIndex,
    required this.themeIndex,
    required this.questionIndex,
    required this.answerMedia,
  });

  final PackageEditorController controller;
  final String title;
  final List<PackageQuestionFile> files;
  final int roundIndex;
  final int themeIndex;
  final int questionIndex;
  final bool answerMedia;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(title, style: context.textTheme.titleSmall),
            ),
            OutlinedButton.icon(
              onPressed: () => controller.addMedia(
                roundIndex,
                themeIndex,
                questionIndex,
                answerMedia: answerMedia,
              ),
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: Text(LocaleKeys.oq_editor_add_media_file.tr()),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (files.isEmpty)
          Text(
            LocaleKeys.oq_editor_no_media_files.tr(),
            style: context.textTheme.bodySmall,
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < files.length; i++)
                Stack(
                  children: [
                    _EditorMediaPreview(
                      controller: controller,
                      file: files[i],
                      size: 160,
                      enablePlayback: true,
                    ),
                    Positioned(
                      right: 4,
                      top: 4,
                      child: IconButton.filled(
                        tooltip: LocaleKeys.oq_editor_remove_file.tr(),
                        onPressed: () => controller.removeMedia(
                          roundIndex,
                          themeIndex,
                          questionIndex,
                          answerMedia: answerMedia,
                          mediaIndex: i,
                        ),
                        icon: const Icon(Icons.close, size: 18),
                      ),
                    ),
                  ],
                ),
            ],
          ),
      ],
    );
  }
}

class _EditorMediaPreview extends StatelessWidget {
  const _EditorMediaPreview({
    required this.controller,
    required this.file,
    required this.size,
    required this.enablePlayback,
  });

  final PackageEditorController controller;
  final PackageQuestionFile file;
  final double size;
  final bool enablePlayback;

  @override
  Widget build(BuildContext context) {
    final local = controller.mediaFilesByHash[file.file.md5];
    final immediateBytes = local?.platformFile.bytes;
    if (immediateBytes != null) {
      return MediaPreviewWidget.fromBytes(
        key: ValueKey('${file.file.md5}-$size'),
        bytes: immediateBytes,
        type: file.file.type,
        size: size,
        enablePlayback: enablePlayback,
        mimeType: _mediaMimeType(
          local?.platformFile.extension,
          file.file.type,
        ),
      );
    }
    if (local != null) {
      return FutureBuilder(
        future: local.readBytes(),
        builder: (context, snapshot) {
          final bytes = snapshot.data;
          if (bytes == null) {
            return SizedBox.square(
              dimension: size,
              child: const Card(
                child: Center(child: CircularProgressIndicator()),
              ),
            );
          }
          return MediaPreviewWidget.fromBytes(
            key: ValueKey('${file.file.md5}-$size'),
            bytes: bytes,
            type: file.file.type,
            size: size,
            enablePlayback: enablePlayback,
            mimeType: _mediaMimeType(
              local.platformFile.extension,
              file.file.type,
            ),
          );
        },
      );
    }
    final url = file.file.link;
    if (url != null && url.isNotEmpty) {
      return MediaPreviewWidget(
        key: ValueKey('${file.file.md5}-$size'),
        url: url,
        type: file.file.type,
        size: size,
        enablePlayback: enablePlayback,
      );
    }
    return SizedBox.square(
      dimension: size,
      child: Card(
        child: Center(
          child: Icon(
            Icons.broken_image_outlined,
            color: context.theme.colorScheme.error,
          ),
        ),
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
