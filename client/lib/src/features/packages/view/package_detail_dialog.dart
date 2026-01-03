import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/view/widgets/media_preview_widget.dart';

typedef MediaReferenceProvider = MediaFileReference Function(String url);

@RoutePage(deferredLoading: false)
class PackageDetailDialog extends StatefulWidget {
  const PackageDetailDialog({required this.packageId, super.key});

  final int packageId;

  @override
  State<PackageDetailDialog> createState() => _PackageDetailDialogState();
}

class _PackageDetailDialogState extends State<PackageDetailDialog> {
  late final Future<OqPackage> _packageFuture;
  final _mediaReferences = <String, MediaFileReference>{};

  @override
  void initState() {
    super.initState();
    _packageFuture = Api.I.api.packages.getV1PackagesId(id: widget.packageId);
  }

  @override
  void dispose() {
    for (final ref in _mediaReferences.values) {
      unawaited(ref.disposeController());
    }
    super.dispose();
  }

  MediaFileReference _getMediaReference(String url) {
    return _mediaReferences.putIfAbsent(
      url,
      () => MediaFileReference(
        platformFile: PlatformFile(name: 'remote', size: 0),
        url: url,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdaptiveDialog(
      builder: (context) => Card(
        elevation: 0,
        child: FutureBuilder<OqPackage>(
          future: _packageFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return _buildLoadingState(context);
            }
            if (snapshot.hasError) {
              return _buildErrorState(context, snapshot.error!);
            }
            if (snapshot.hasData) {
              return _buildContent(context, snapshot.data!);
            }
            return _buildLoadingState(context);
          },
        ),
      ),
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    ).paddingAll(48);
  }

  Widget _buildErrorState(BuildContext context, Object error) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        spacing: 16,
        children: [
          Icon(
            Icons.error_outline,
            size: 48,
            color: context.theme.colorScheme.error,
          ),
          Text(
            LocaleKeys.something_went_wrong.tr(),
            style: context.textTheme.titleMedium,
          ),
        ],
      ).paddingAll(48),
    );
  }

  Widget _buildContent(BuildContext context, OqPackage package) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PackageDetailHeader(package: package),
        Flexible(
          child: SingleChildScrollView(
            padding: 16.all,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 20,
              children: [
                _PackageBasicInfo(package: package),
                _PackageRoundsSection(
                  package: package,
                  mediaProvider: _getMediaReference,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PackageDetailHeader extends StatelessWidget {
  const _PackageDetailHeader({required this.package});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: 16.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.primaryContainer.withValues(
          alpha: 0.3,
        ),
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(12),
        ),
      ),
      child: Row(
        children: [
          if (package.logo != null)
            Container(
              width: 56,
              height: 56,
              margin: const EdgeInsets.only(right: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: context.theme.colorScheme.surfaceContainerHighest,
              ),
              child: const Icon(Icons.image, size: 32),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(
                  package.title,
                  style: context.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  LocaleKeys.created_by.tr(args: [package.author.username]),
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: context.theme.colorScheme.onSurface.withValues(
                      alpha: 0.7,
                    ),
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            onPressed: () async {
              await context.maybePop(
                PackageListItem(
                  id: package.id,
                  title: package.title,
                  description: package.description,
                  createdAt: package.createdAt,
                  author: package.author,
                  ageRestriction: package.ageRestriction,
                  language: package.language,
                  logo: package.logo,
                  tags: package.tags,
                ),
              );
            },
            icon: const Icon(Icons.add_task_rounded),
            label: Text(LocaleKeys.select.tr()),
          ),
        ],
      ),
    );
  }
}

class _PackageBasicInfo extends StatelessWidget {
  const _PackageBasicInfo({required this.package});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        if (!package.description.isEmptyOrNull)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 4,
            children: [
              Text(
                LocaleKeys.oq_editor_package_description.tr(),
                style: context.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                package.description!,
                style: context.textTheme.bodyMedium,
              ),
            ],
          ),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            _PackageInfoChip(
              icon: Icons.calendar_today,
              text: DateFormat.yMMMd().format(package.createdAt),
            ),
            if (package.language != null)
              _PackageInfoChip(
                icon: Icons.language,
                text: package.language!,
              ),
            if (package.ageRestriction != AgeRestriction.none)
              _PackageInfoChip(
                icon: Icons.shield_outlined,
                text: package.ageRestriction.format(context)?.$1 ?? '',
              ),
            _PackageInfoChip(
              icon: Icons.view_module_outlined,
              text: LocaleKeys.rounds.plural(package.rounds.length),
            ),
            _PackageInfoChip(
              icon: Icons.quiz_outlined,
              text: LocaleKeys.questions.plural(_getTotalQuestions(package)),
            ),
          ],
        ),
        if (package.tags?.isNotEmpty ?? false)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              Text(
                LocaleKeys.oq_editor_package_tags.tr(),
                style: context.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: package.tags!
                    .map(
                      (tag) => Chip(
                        label: Text(tag.tag),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
      ],
    );
  }

  int _getTotalQuestions(OqPackage package) {
    return package.rounds.fold<int>(
      0,
      (sum, round) =>
          sum +
          round.themes.fold<int>(
            0,
            (themeSum, theme) => themeSum + theme.questions.length,
          ),
    );
  }
}

class _PackageInfoChip extends StatelessWidget {
  const _PackageInfoChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 6,
        children: [
          Icon(icon, size: 16),
          Text(text, style: context.textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _PackageRoundsSection extends StatelessWidget {
  const _PackageRoundsSection({
    required this.package,
    required this.mediaProvider,
  });

  final OqPackage package;
  final MediaReferenceProvider mediaProvider;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        Text(
          LocaleKeys.rounds.plural(package.rounds.length),
          style: context.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        ...package.rounds.map(
          (round) => _PackageRoundCard(
            round: round,
            mediaProvider: mediaProvider,
          ),
        ),
      ],
    );
  }
}

class _PackageRoundCard extends StatelessWidget {
  const _PackageRoundCard({
    required this.round,
    required this.mediaProvider,
  });

  final PackageRound round;
  final MediaReferenceProvider mediaProvider;

  @override
  Widget build(BuildContext context) {
    final themeCount = round.themes.length;
    final questionCount = round.themes.fold<int>(
      0,
      (sum, theme) => sum + theme.questions.length,
    );
    final isFinalRound = round.type == PackageRoundType.valueFinal;

    return Card(
      elevation: 0,
      color: context.theme.colorScheme.surfaceContainer,
      child: ExpansionTile(
        title: Text(
          round.name,
          style: context.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          isFinalRound
              ? LocaleKeys.themes_count.tr(args: [themeCount.toString()])
              : '${LocaleKeys.themes_count.tr(args: [themeCount.toString()])}'
                    ' • '
                    '${LocaleKeys.questions.plural(questionCount)}',
          style: context.textTheme.bodySmall,
        ),
        children: round.themes
            .map(
              (theme) => _PackageThemeItem(
                theme: theme,
                mediaProvider: mediaProvider,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _PackageThemeItem extends StatelessWidget {
  const _PackageThemeItem({
    required this.theme,
    required this.mediaProvider,
  });

  final PackageTheme theme;
  final MediaReferenceProvider mediaProvider;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: context.theme.colorScheme.surfaceContainerLow,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding: const EdgeInsets.only(bottom: 8),
        title: Text(
          theme.name,
          style: context.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        subtitle: !theme.description.isEmptyOrNull
            ? Text(
                theme.description!,
                style: context.textTheme.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: ScoreText(
          score: theme.questions.length,
          textStyle: context.textTheme.labelSmall,
        ),
        children: theme.questions
            .map(
              (question) => _PackageQuestionItem(
                question: question,
                mediaProvider: mediaProvider,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _PackageQuestionItem extends StatelessWidget {
  const _PackageQuestionItem({
    required this.question,
    required this.mediaProvider,
  });

  final PackageQuestionUnion question;
  final MediaReferenceProvider mediaProvider;

  @override
  Widget build(BuildContext context) {
    // Extract common question properties using pattern matching
    final price = question.map(
      simple: (q) => q.price,
      stake: (q) => q.price,
      secret: (q) => q.price,
      noRisk: (q) => q.price,
      choice: (q) => q.price,
      hidden: (q) => q.price,
    );
    final order = question.map(
      simple: (q) => q.order,
      stake: (q) => q.order,
      secret: (q) => q.order,
      noRisk: (q) => q.order,
      choice: (q) => q.order,
      hidden: (q) => q.order,
    );
    final text = question.map(
      simple: (q) => q.text,
      stake: (q) => q.text,
      secret: (q) => q.text,
      noRisk: (q) => q.text,
      choice: (q) => q.text,
      hidden: (q) => q.text,
    );
    final questionFiles = question.map(
      simple: (q) => q.questionFiles,
      stake: (q) => q.questionFiles,
      secret: (q) => q.questionFiles,
      noRisk: (q) => q.questionFiles,
      choice: (q) => q.questionFiles,
      hidden: (q) => q.questionFiles,
    );
    final answerText = question.map(
      simple: (q) => q.answerText,
      stake: (q) => q.answerText,
      secret: (q) => q.answerText,
      noRisk: (q) => q.answerText,
      choice: (q) => q.answerText,
      hidden: (q) => q.answerText,
    );
    final answerFiles = question.map(
      simple: (q) => q.answerFiles,
      stake: (q) => q.answerFiles,
      secret: (q) => q.answerFiles,
      noRisk: (q) => q.answerFiles,
      choice: (q) => q.answerFiles,
      hidden: (q) => q.answerFiles,
    );
    const mediaSize = 200.0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: 12.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          // Question header with price
          Row(
            children: [
              if (price != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: context.theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    price.toString(),
                    style: context.textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: context.theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                ).paddingRight(8),
              Expanded(
                child: Text(
                  '${LocaleKeys.oq_editor_question_text.tr()} #${order + 1}',
                  style: context.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          // Question text
          if (!text.isEmptyOrNull)
            Text(
              text!,
              style: context.textTheme.bodyMedium,
            ),
          // Question files
          if (questionFiles?.isNotEmpty ?? false)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: questionFiles!
                  .map(
                    (file) => MediaPreviewWidget(
                      mediaFile: mediaProvider(file.file.link ?? ''),
                      type: file.file.type,
                      size: mediaSize,
                      enablePlayback: true,
                    ),
                  )
                  .toList(),
            ),
          // Answer section (hidden by default to avoid spoilers)
          if (answerText != null || (answerFiles?.isNotEmpty ?? false))
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                backgroundColor: context.theme.colorScheme.secondaryContainer
                    .withValues(
                      alpha: 0.3,
                    ),
                collapsedBackgroundColor: context
                    .theme
                    .colorScheme
                    .secondaryContainer
                    .withValues(
                      alpha: 0.3,
                    ),
                title: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.visibility_outlined,
                      size: 16,
                      color: context.theme.colorScheme.secondary,
                    ).paddingRight(4),
                    Text(
                      LocaleKeys.oq_editor_answer.tr(),
                      style: context.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: context.theme.colorScheme.secondary,
                      ),
                    ),
                  ],
                ),
                expandedAlignment: Alignment.centerLeft,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 8,
                    children: [
                      if (answerText != null)
                        Text(
                          answerText,
                          style: context.textTheme.bodyMedium,
                        ),
                      if (answerFiles?.isNotEmpty ?? false)
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: answerFiles!
                              .map(
                                (file) => MediaPreviewWidget(
                                  mediaFile: mediaProvider(
                                    file.file.link ?? '',
                                  ),
                                  type: file.file.type,
                                  size: mediaSize,
                                  enablePlayback: true,
                                ),
                              )
                              .toList(),
                        ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
