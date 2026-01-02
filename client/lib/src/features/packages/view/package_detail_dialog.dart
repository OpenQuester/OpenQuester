import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/view/dialogs/media_preview_dialog.dart';
import 'package:oq_editor/view/widgets/media_preview_widget.dart';

@RoutePage(deferredLoading: false)
class PackageDetailDialog extends StatefulWidget {
  const PackageDetailDialog({required this.packageId, super.key});

  final int packageId;

  @override
  State<PackageDetailDialog> createState() => _PackageDetailDialogState();
}

class _PackageDetailDialogState extends State<PackageDetailDialog> {
  late Future<OqPackage> _packageFuture;

  @override
  void initState() {
    super.initState();
    _packageFuture = _loadPackage();
  }

  Future<OqPackage> _loadPackage() async {
    return Api.I.api.packages.getV1PackagesId(id: widget.packageId);
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
              return const Center(
                child: CircularProgressIndicator(),
              ).paddingAll(48);
            }

            if (snapshot.hasError) {
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

            final package = snapshot.data!;
            return _buildContent(context, package);
          },
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, OqPackage package) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildHeader(context, package),
        Flexible(
          child: SingleChildScrollView(
            padding: 16.all,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 20,
              children: [
                _buildBasicInfo(context, package),
                _buildRoundsSection(context, package),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader(BuildContext context, OqPackage package) {
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
        ],
      ),
    );
  }

  Widget _buildBasicInfo(BuildContext context, OqPackage package) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        if (package.description?.isNotEmpty ?? false)
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
            _buildInfoChip(
              context,
              Icons.calendar_today,
              DateFormat.yMMMd().format(package.createdAt),
            ),
            if (package.language != null)
              _buildInfoChip(
                context,
                Icons.language,
                package.language!,
              ),
            if (package.ageRestriction != AgeRestriction.none)
              _buildInfoChip(
                context,
                Icons.shield_outlined,
                package.ageRestriction.format(context)?.$1 ?? '',
              ),
            _buildInfoChip(
              context,
              Icons.view_module_outlined,
              LocaleKeys.rounds.plural(package.rounds.length),
            ),
            _buildInfoChip(
              context,
              Icons.quiz_outlined,
              LocaleKeys.questions.plural(_getTotalQuestions(package)),
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

  Widget _buildInfoChip(BuildContext context, IconData icon, String text) {
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
          Text(
            text,
            style: context.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildRoundsSection(BuildContext context, OqPackage package) {
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
          (round) => _buildRoundCard(context, round, package),
        ),
      ],
    );
  }

  Widget _buildRoundCard(
    BuildContext context,
    PackageRound round,
    OqPackage package,
  ) {
    final themeCount = round.themes.length;
    final questionCount = round.themes.fold<int>(
      0,
      (sum, theme) => sum + theme.questions.length,
    );

    return Card(
      elevation: 0,
      color: context.theme.colorScheme.surfaceContainer,
      child: ExpansionTile(
        initiallyExpanded:
            package.rounds.length == 1 || round.themes.length == 1,
        title: Text(
          round.name,
          style: context.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          '$themeCount themes • $questionCount questions',
          style: context.textTheme.bodySmall,
        ),
        children: round.themes
            .map((theme) => _buildThemeItem(context, theme))
            .toList(),
      ),
    );
  }

  Widget _buildThemeItem(BuildContext context, PackageTheme theme) {
    return ExpansionTile(
      dense: true,
      tilePadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      childrenPadding: const EdgeInsets.only(bottom: 8, right: 8, left: 8),
      title: Text(
        theme.name,
        style: context.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: theme.description?.isNotEmpty ?? false
          ? Text(
              theme.description!,
              style: context.textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            )
          : null,
      trailing: Chip(
        label: Text(
          '${theme.questions.length}',
          style: context.textTheme.labelSmall,
        ),
        visualDensity: VisualDensity.compact,
      ),
      children: theme.questions
          .map((question) => _buildQuestionItem(context, question))
          .toList(),
    );
  }

  Widget _buildQuestionItem(
    BuildContext context,
    PackageQuestionUnion question,
  ) {
    final hasQuestionFiles = question.questionFiles?.isNotEmpty ?? false;
    final hasAnswerFiles = question.answerFiles?.isNotEmpty ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: 12.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerHigh.withValues(
          alpha: 0.5,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: context.theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${question.price}',
                  style: context.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: context.theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (question.type?.name != QuestionType.simple.name)
                Chip(
                  label: Text(
                    question.type?.name ?? '-',
                    style: context.textTheme.labelSmall,
                  ),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          if (!question.text.isEmptyOrNull)
            Text(
              question.text!,
              style: context.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          if (hasQuestionFiles)
            _buildMediaSection(
              context,
              LocaleKeys.oq_editor_question_media.tr(),
              question.questionFiles!,
            ),
          if (!question.answerText.isEmptyOrNull)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: context.theme.colorScheme.tertiaryContainer.withValues(
                  alpha: 0.3,
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle_outline,
                    size: 16,
                    color: context.theme.colorScheme.tertiary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      question.answerText!,
                      style: context.textTheme.bodySmall?.copyWith(
                        color: context.theme.colorScheme.onTertiaryContainer,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (hasAnswerFiles)
            _buildMediaSection(
              context,
              LocaleKeys.oq_editor_answer_media.tr(),
              question.answerFiles!,
            ),
        ],
      ),
    );
  }

  Widget _buildMediaSection(
    BuildContext context,
    String title,
    List<PackageQuestionFile> files,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 6,
      children: [
        Text(
          title,
          style: context.textTheme.labelSmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: context.theme.colorScheme.onSurface.withValues(alpha: 0.7),
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: files
              .map((file) => _buildMediaPreview(context, file))
              .toList(),
        ),
      ],
    );
  }

  Widget _buildMediaPreview(BuildContext context, PackageQuestionFile file) {
    final mediaUrl = file.file.link;
    if (mediaUrl == null) {
      return _buildMediaError(context);
    }

    return GestureDetector(
      onTap: () {
        MediaPreviewDialog.showFromUrl(
          context,
          mediaUrl,
          file.file.type,
          fileName: file.file.name,
        );
      },
      child: MediaPreviewWidget.fromUrl(
        url: mediaUrl,
        type: file.file.type,
      ),
    );
  }

  Widget _buildMediaError(BuildContext context) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(
        child: Icon(
          Icons.broken_image,
          size: 32,
          color: context.theme.colorScheme.error,
        ),
      ),
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
