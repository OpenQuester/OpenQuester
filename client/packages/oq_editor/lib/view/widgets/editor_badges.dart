import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';

/// Badge for displaying question type with color coding
class QuestionTypeBadge extends StatelessWidget {
  const QuestionTypeBadge({
    required this.question,
    required this.translations,
    this.compact = false,
    super.key,
  });

  final PackageQuestionUnion question;
  final OqEditorTranslations translations;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final typeInfo = _getTypeInfo(context);

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: typeInfo.color.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: typeInfo.color.withValues(alpha: 0.5),
            width: 1,
          ),
        ),
        child: Icon(
          typeInfo.icon,
          size: 14,
          color: typeInfo.color,
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: typeInfo.color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: typeInfo.color.withValues(alpha: 0.4),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            typeInfo.icon,
            size: 16,
            color: typeInfo.color,
          ),
          const SizedBox(width: 4),
          Text(
            typeInfo.label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: typeInfo.color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  _QuestionTypeInfo _getTypeInfo(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return question.map(
      simple: (_) => _QuestionTypeInfo(
        label: translations.questionTypeSimple,
        icon: Icons.help_outline,
        color: colorScheme.primary,
      ),
      stake: (_) => _QuestionTypeInfo(
        label: translations.questionTypeStake,
        icon: Icons.attach_money,
        color: const Color(0xFFFFB300), // Gold
      ),
      secret: (_) => _QuestionTypeInfo(
        label: translations.questionTypeSecret,
        icon: Icons.psychology_outlined,
        color: const Color(0xFF9C27B0), // Purple
      ),
      noRisk: (_) => _QuestionTypeInfo(
        label: translations.questionTypeNoRisk,
        icon: Icons.shield_outlined,
        color: const Color(0xFF4CAF50), // Green
      ),
      choice: (_) => _QuestionTypeInfo(
        label: translations.questionTypeChoice,
        icon: Icons.fact_check_outlined,
        color: colorScheme.tertiary,
      ),
      hidden: (_) => _QuestionTypeInfo(
        label: translations.questionTypeHidden,
        icon: Icons.visibility_off_outlined,
        color: colorScheme.secondary,
      ),
    );
  }
}

class _QuestionTypeInfo {
  const _QuestionTypeInfo({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;
}

/// Badge showing media file presence and count
class MediaIndicatorBadge extends StatelessWidget {
  const MediaIndicatorBadge({
    required this.hasImage,
    required this.hasVideo,
    required this.hasAudio,
    this.compact = false,
    super.key,
  });

  final bool hasImage;
  final bool hasVideo;
  final bool hasAudio;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final icons = <IconData>[];
    if (hasImage) icons.add(Icons.image_outlined);
    if (hasVideo) icons.add(Icons.videocam_outlined);
    if (hasAudio) icons.add(Icons.music_note_outlined);

    if (icons.isEmpty) return const SizedBox.shrink();

    if (compact) {
      return Wrap(
        spacing: 2,
        children: icons.map((icon) {
          return Icon(
            icon,
            size: 16,
            color: Theme.of(context).colorScheme.primary,
          );
        }).toList(),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < icons.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Icon(
              icons[i],
              size: 16,
              color: Theme.of(context).colorScheme.onPrimaryContainer,
            ),
          ],
        ],
      ),
    );
  }
}

/// Completion badge showing filled/total count
class CompletionBadge extends StatelessWidget {
  const CompletionBadge({
    required this.filled,
    required this.total,
    required this.label,
    super.key,
  });

  final int filled;
  final int total;
  final String label;

  @override
  Widget build(BuildContext context) {
    final percentage = total > 0 ? (filled / total) : 0.0;
    final isComplete = filled == total && total > 0;

    final color = isComplete
        ? const Color(0xFF4CAF50)
        : percentage > 0.5
            ? Theme.of(context).colorScheme.tertiary
            : Theme.of(context).colorScheme.outline;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: color.withValues(alpha: 0.4),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isComplete)
            Icon(
              Icons.check_circle_outline,
              size: 14,
              color: color,
            )
          else
            Icon(
              Icons.circle_outlined,
              size: 14,
              color: color,
            ),
          const SizedBox(width: 4),
          Text(
            '$filled/$total $label',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/// Price badge for questions
class PriceBadge extends StatelessWidget {
  const PriceBadge({
    required this.price,
    super.key,
  });

  final int price;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$price pts',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onTertiaryContainer,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
