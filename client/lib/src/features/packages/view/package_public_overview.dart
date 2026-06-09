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
            children: rounds.map(_RoundOverview.new).toList(),
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
      _Badge(text: LocaleKeys.rounds.plural(package.rounds.length)),
      _Badge(text: LocaleKeys.questions.plural(totalQuestions)),
      if (ageRestriction != null)
        _Badge(text: ageRestriction.$1, color: ageRestriction.$2),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                package.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (badges.isNotEmpty) const SizedBox(width: 8),
            for (final badge in badges) badge.paddingRight(6),
          ],
        ),
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
  }
}

class _RoundOverview extends StatelessWidget {
  const _RoundOverview(this.round);

  final PackageRound round;

  @override
  Widget build(BuildContext context) {
    final themes = round.sortedThemes();
    final questionCount = _roundQuestionCount(round);
    final questionTypeCounts = _questionTypeCounts(round);
    final badges = [
      _Badge(
        text: _roundTypeLabel(round.type),
        color: _roundTypeColor(context, round.type),
      ),
      _Badge(
        text: LocaleKeys.themes_count.tr(args: [themes.length.toString()]),
      ),
      _Badge(text: LocaleKeys.questions.plural(questionCount)),
      if (questionTypeCounts.textQuestions > 0)
        _Badge(
          text: LocaleKeys.package_text_questions.plural(
            questionTypeCounts.textQuestions,
          ),
        ),
      if (questionTypeCounts.mediaQuestions > 0)
        _Badge(
          text: LocaleKeys.package_media_questions.plural(
            questionTypeCounts.mediaQuestions,
          ),
        ),
      if (questionTypeCounts.mixedQuestions > 0)
        _Badge(
          text: LocaleKeys.package_mixed_questions.plural(
            questionTypeCounts.mixedQuestions,
          ),
        ),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainer,
        borderRadius: 8.circular,
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: .12),
        ),
      ),
      child: ExpansionTile(
        title: Text(
          round.name,
          style: context.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Align(
          alignment: AlignmentDirectional.centerStart,
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: badges,
          ).paddingTop(8),
        ),
        children: [
          if (themes.isEmpty)
            const SizedBox.shrink()
          else
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final theme in themes)
                    Chip(
                      label: Text(theme.name),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ).paddingOnly(left: 16, right: 16, bottom: 12),
            ),
        ],
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
    final borderColor = color?.withValues(alpha: .34) ?? Colors.transparent;

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
