import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class PackagePublicOverview extends StatelessWidget {
  const PackagePublicOverview({required this.package, super.key});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
    final rounds = package.sortedRounds();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: [
        _PackageHeader(package: package),
        if (rounds.isNotEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 8,
            children: [
              for (final round in rounds)
                _RoundOverview(
                  round,
                  key: ValueKey('${round.order}:${round.name}'),
                ),
            ],
          ),
      ],
    );
  }
}

class _PackageHeader extends StatelessWidget {
  const _PackageHeader({required this.package});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
    final totalQuestions = _totalQuestions(package);
    final ageRestriction = package.ageRestriction.format(context);
    final description = _trimDescription(package.description);
    final badges = [
      _Badge(
        text: packageOverviewCountLabel(
          PackageOverviewCountKind.round,
          package.rounds.length,
        ),
      ),
      _Badge(
        text: packageOverviewCountLabel(
          PackageOverviewCountKind.question,
          totalQuestions,
        ),
      ),
      if (ageRestriction != null)
        _Badge(text: ageRestriction.$1, color: ageRestriction.$2),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final inlineBadges = constraints.maxWidth >= 900;
        final title = Tooltip(
          message: package.title,
          child: Semantics(
            label: package.title,
            header: true,
            child: Text(
              key: const Key('package_public_overview_title'),
              package.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        );
        final badgesWrap = Wrap(
          spacing: 6,
          runSpacing: 6,
          children: badges,
        );

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 8,
          children: [
            if (inlineBadges)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: title),
                  if (badges.isNotEmpty) const SizedBox(width: 8),
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: constraints.maxWidth * .44,
                    ),
                    child: badgesWrap,
                  ),
                ],
              )
            else ...[
              title,
              if (badges.isNotEmpty) badgesWrap,
            ],
            if (description != null)
              Text(
                description,
                maxLines: 7,
                overflow: TextOverflow.ellipsis,
                style: context.textTheme.bodyMedium?.copyWith(
                  color: context.theme.colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _RoundOverview extends StatefulWidget {
  const _RoundOverview(this.round, {super.key});

  final PackageRound round;

  @override
  State<_RoundOverview> createState() => _RoundOverviewState();
}

class _RoundOverviewState extends State<_RoundOverview> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final themes = widget.round.sortedThemes();
    final questionCount = _roundQuestionCount(widget.round);
    final questionTypeCounts = _questionTypeCounts(widget.round);
    final badges = [
      _Badge(
        text: _roundTypeLabel(widget.round.type),
        color: _roundTypeColor(context, widget.round.type),
      ),
      _Badge(
        text: packageOverviewCountLabel(
          PackageOverviewCountKind.theme,
          themes.length,
        ),
      ),
      _Badge(
        text: packageOverviewCountLabel(
          PackageOverviewCountKind.question,
          questionCount,
        ),
      ),
      if (questionTypeCounts.textQuestions > 0)
        _Badge(
          text: packageOverviewCountLabel(
            PackageOverviewCountKind.textQuestion,
            questionTypeCounts.textQuestions,
          ),
        ),
      if (questionTypeCounts.mediaQuestions > 0)
        _Badge(
          text: packageOverviewCountLabel(
            PackageOverviewCountKind.mediaQuestion,
            questionTypeCounts.mediaQuestions,
          ),
        ),
      if (questionTypeCounts.mixedQuestions > 0)
        _Badge(
          text: packageOverviewCountLabel(
            PackageOverviewCountKind.mixedQuestion,
            questionTypeCounts.mixedQuestions,
          ),
        ),
    ];

    return Semantics(
      button: true,
      expanded: _expanded,
      label: widget.round.name,
      child: Material(
        color: context.theme.colorScheme.surfaceContainer,
        shape: RoundedRectangleBorder(
          borderRadius: 8.circular,
          side: BorderSide(color: context.theme.colorScheme.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              borderRadius: _headerBorderRadius,
              customBorder: RoundedRectangleBorder(
                borderRadius: _headerBorderRadius,
              ),
              onTap: _toggleExpanded,
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 12, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 8,
                        children: [
                          Tooltip(
                            message: widget.round.name,
                            child: Text(
                              widget.round.name,
                              style: context.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: badges,
                          ),
                        ],
                      ),
                    ),
                    Tooltip(
                      message: _expanded
                          ? LocaleKeys.close.tr()
                          : LocaleKeys.select.tr(),
                      child: AnimatedRotation(
                        turns: _expanded ? .5 : 0,
                        duration: Durations.short3,
                        child: const SizedBox.square(
                          dimension: 40,
                          child: Center(
                            child: Icon(Icons.keyboard_arrow_down),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded && themes.isNotEmpty)
              Divider(
                height: 1,
                color: context.theme.colorScheme.outlineVariant,
              ).paddingSymmetric(horizontal: 16),
            AnimatedSize(
              duration: Durations.short3,
              alignment: Alignment.topCenter,
              child: _expanded
                  ? _RoundThemes(themes: themes)
                  : const SizedBox(width: double.infinity),
            ),
          ],
        ),
      ),
    );
  }

  BorderRadius get _headerBorderRadius {
    const radius = Radius.circular(8);
    return _expanded
        ? const BorderRadius.vertical(top: radius)
        : const BorderRadius.all(radius);
  }

  void _toggleExpanded() => setState(() => _expanded = !_expanded);
}

class _RoundThemes extends StatelessWidget {
  const _RoundThemes({required this.themes});

  final List<PackageTheme> themes;

  @override
  Widget build(BuildContext context) {
    if (themes.isEmpty) return const SizedBox.shrink();

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final maxChipWidth = (constraints.maxWidth - 32)
              .clamp(120, 280)
              .toDouble();

          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final theme in themes)
                Chip(
                  label: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: maxChipWidth),
                    child: Text(theme.name, softWrap: true),
                  ),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ).paddingOnly(left: 16, top: 10, right: 16, bottom: 12);
        },
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final foreground = color ?? context.theme.colorScheme.onSurfaceVariant;
    final background =
        color?.withValues(alpha: .12) ??
        context.theme.colorScheme.surfaceContainerHighest;
    final borderColor =
        color?.withValues(alpha: .34) ??
        context.theme.colorScheme.outlineVariant;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: 999.circular,
        border: Border.all(color: borderColor),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: context.textTheme.labelSmall?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _QuestionTypeCounts {
  const _QuestionTypeCounts({
    required this.textQuestions,
    required this.mediaQuestions,
    required this.mixedQuestions,
  });

  final int textQuestions;
  final int mediaQuestions;
  final int mixedQuestions;
}

enum _QuestionContentType { text, media, mixed }

enum PackageOverviewCountKind {
  round,
  theme,
  question,
  textQuestion,
  mediaQuestion,
  mixedQuestion,
}

String packageOverviewCountLabel(PackageOverviewCountKind kind, int count) {
  return switch (kind) {
    PackageOverviewCountKind.round => LocaleKeys.rounds.plural(count),
    PackageOverviewCountKind.theme => LocaleKeys.package_themes.plural(count),
    PackageOverviewCountKind.question => LocaleKeys.questions.plural(count),
    PackageOverviewCountKind.textQuestion =>
      LocaleKeys.package_text_questions.plural(count),
    PackageOverviewCountKind.mediaQuestion =>
      LocaleKeys.package_media_questions.plural(count),
    PackageOverviewCountKind.mixedQuestion =>
      LocaleKeys.package_mixed_questions.plural(count),
  };
}

String? _trimDescription(String? description) {
  if (description.isEmptyOrNull) return null;

  const maxDescriptionChars = 750;
  final trimmed = description!.trim();
  if (trimmed.length <= maxDescriptionChars) return trimmed;

  return '${trimmed.substring(0, maxDescriptionChars).trimRight()}...';
}

int _totalQuestions(OqPackage package) {
  return package.rounds.fold<int>(
    0,
    (sum, round) => sum + _roundQuestionCount(round),
  );
}

int _roundQuestionCount(PackageRound round) {
  return round.themes.fold<int>(
    0,
    (sum, theme) => sum + theme.questions.length,
  );
}

_QuestionTypeCounts _questionTypeCounts(PackageRound round) {
  var textQuestions = 0;
  var mediaQuestions = 0;
  var mixedQuestions = 0;

  for (final theme in round.themes) {
    for (final question in theme.questions) {
      switch (_questionContentType(question)) {
        case _QuestionContentType.text:
          textQuestions += 1;
        case _QuestionContentType.media:
          mediaQuestions += 1;
        case _QuestionContentType.mixed:
          mixedQuestions += 1;
      }
    }
  }

  return _QuestionTypeCounts(
    textQuestions: textQuestions,
    mediaQuestions: mediaQuestions,
    mixedQuestions: mixedQuestions,
  );
}

_QuestionContentType _questionContentType(PackageQuestionUnion question) {
  final hasText = _questionHasText(question);
  final hasMedia = _questionHasMedia(question);

  if (hasText && hasMedia) return _QuestionContentType.mixed;
  if (hasMedia) return _QuestionContentType.media;

  return _QuestionContentType.text;
}

bool _questionHasText(PackageQuestionUnion question) {
  final questionText = _questionText(question);
  final choiceAnswersHaveText = _choiceAnswers(
    question,
  ).any((answer) => !answer.text.isEmptyOrNull);

  return !questionText.isEmptyOrNull || choiceAnswersHaveText;
}

bool _questionHasMedia(PackageQuestionUnion question) {
  final questionFiles = _questionFiles(question);
  final hasQuestionMedia = questionFiles?.isNotEmpty ?? false;
  final choiceAnswersHaveMedia = _choiceAnswers(
    question,
  ).any((answer) => answer.file != null);

  return hasQuestionMedia || choiceAnswersHaveMedia;
}

String? _questionText(PackageQuestionUnion question) {
  return question.map(
    simple: (question) => question.text,
    stake: (question) => question.text,
    secret: (question) => question.text,
    noRisk: (question) => question.text,
    choice: (question) => question.text,
    hidden: (question) => question.text,
  );
}

List<PackageQuestionFile>? _questionFiles(PackageQuestionUnion question) {
  return question.map(
    simple: (question) => question.questionFiles,
    stake: (question) => question.questionFiles,
    secret: (question) => question.questionFiles,
    noRisk: (question) => question.questionFiles,
    choice: (question) => question.questionFiles,
    hidden: (question) => question.questionFiles,
  );
}

List<QuestionChoiceAnswers> _choiceAnswers(PackageQuestionUnion question) {
  return question.map(
    simple: (_) => const <QuestionChoiceAnswers>[],
    stake: (_) => const <QuestionChoiceAnswers>[],
    secret: (_) => const <QuestionChoiceAnswers>[],
    noRisk: (_) => const <QuestionChoiceAnswers>[],
    choice: (question) => question.answers,
    hidden: (_) => const <QuestionChoiceAnswers>[],
  );
}

String _roundTypeLabel(PackageRoundType type) {
  return switch (type) {
    PackageRoundType.simple => LocaleKeys.oq_editor_round_type_simple.tr(),
    PackageRoundType.valueFinal => LocaleKeys.oq_editor_round_type_final.tr(),
    PackageRoundType.$unknown => LocaleKeys.oq_editor_round_type_unknown.tr(),
  };
}

Color? _roundTypeColor(BuildContext context, PackageRoundType type) {
  return switch (type) {
    PackageRoundType.simple => context.theme.colorScheme.primary,
    PackageRoundType.valueFinal => context.theme.colorScheme.tertiary,
    PackageRoundType.$unknown => null,
  };
}
