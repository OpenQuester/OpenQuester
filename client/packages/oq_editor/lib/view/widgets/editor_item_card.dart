import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';

/// Unified card component for editor items (rounds, themes, questions)
/// Provides consistent styling and interaction patterns across the editor
class EditorItemCard extends StatelessWidget {
  const EditorItemCard({
    required this.title,
    required this.onTap,
    this.subtitle,
    this.leadingIcon,
    this.leadingWidget,
    this.trailingWidget,
    this.typeChip,
    this.accentColor,
    this.badges = const [],
    this.isSelected = false,
    this.showCheckbox = false,
    this.onCheckboxChanged,
    this.onEdit,
    this.onDelete,
    this.isCompact = false,
    this.showDragHandle = false,
    super.key,
  });

  final String title;
  final String? subtitle;
  final IconData? leadingIcon;
  final Widget? leadingWidget;
  final Widget? trailingWidget;
  final Widget? typeChip;
  final Color? accentColor;
  final List<EditorBadge> badges;
  final bool isSelected;
  final bool showCheckbox;
  final ValueChanged<bool?>? onCheckboxChanged;
  final VoidCallback onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final bool isCompact;
  final bool showDragHandle;

  @override
  Widget build(BuildContext context) {
    final cardContent = isCompact
        ? _buildCompactContent(context)
        : _buildDetailedContent(context);

    return Card(
      margin: EdgeInsets.only(bottom: isCompact ? 4 : 8),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: accentColor != null
              ? BoxDecoration(
                  border: Border(
                    left: BorderSide(color: accentColor!, width: 4),
                  ),
                )
              : null,
          child: cardContent,
        ),
      ),
    );
  }

  Widget _buildCompactContent(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          if (showCheckbox)
            Checkbox(
              value: isSelected,
              onChanged: onCheckboxChanged,
              visualDensity: VisualDensity.compact,
            ),
          if (showDragHandle) ...[
            Icon(
              Icons.drag_handle,
              size: 20,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(width: 8),
          ],
          if (leadingWidget != null) ...[
            leadingWidget!,
            const SizedBox(width: 12),
          ] else if (leadingIcon != null) ...[
            Icon(
              leadingIcon,
              size: 18,
              color: accentColor ?? Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          ...badges.map((badge) => Padding(
                padding: const EdgeInsets.only(left: 4),
                child: _BadgeWidget(badge: badge, isCompact: true),
              )),
          if (typeChip != null) ...[
            const SizedBox(width: 8),
            typeChip!,
          ],
          if (subtitle != null) ...[
            const SizedBox(width: 8),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                  ),
            ),
          ],
          if (trailingWidget != null) ...[
            const SizedBox(width: 8),
            trailingWidget!,
          ],
          _buildActions(context, isCompact: true),
        ],
      ),
    );
  }

  Widget _buildDetailedContent(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          if (showCheckbox)
            Checkbox(
              value: isSelected,
              onChanged: onCheckboxChanged,
            ),
          if (showDragHandle) ...[
            Icon(
              Icons.drag_handle,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(width: 12),
          ],
          if (leadingWidget != null) ...[
            leadingWidget!,
            const SizedBox(width: 16),
          ] else if (leadingIcon != null) ...[
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: (accentColor ?? Theme.of(context).colorScheme.primary)
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                leadingIcon,
                color: accentColor ?? Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(width: 16),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    ...badges.map((badge) => Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: _BadgeWidget(badge: badge, isCompact: false),
                        )),
                  ],
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (typeChip != null) ...[
                  const SizedBox(height: 8),
                  typeChip!,
                ],
              ],
            ),
          ),
          if (trailingWidget != null) ...[
            const SizedBox(width: 12),
            trailingWidget!,
          ],
          _buildActions(context, isCompact: false),
        ],
      ),
    );
  }

  Widget _buildActions(BuildContext context, {required bool isCompact}) {
    if (onEdit == null && onDelete == null) {
      return const SizedBox.shrink();
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (onEdit != null)
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            iconSize: isCompact ? 18 : 20,
            visualDensity: VisualDensity.compact,
            onPressed: onEdit,
            tooltip: 'Edit',
          ),
        if (onDelete != null)
          IconButton(
            icon: const Icon(Icons.delete_outline),
            iconSize: isCompact ? 18 : 20,
            visualDensity: VisualDensity.compact,
            onPressed: onDelete,
            color: Theme.of(context).colorScheme.error,
            tooltip: 'Delete',
          ),
      ],
    );
  }
}

/// Badge data for EditorItemCard
class EditorBadge {
  const EditorBadge({
    required this.icon,
    this.label,
    this.color,
    this.tooltip,
  });

  final IconData icon;
  final String? label;
  final Color? color;
  final String? tooltip;
}

class _BadgeWidget extends StatelessWidget {
  const _BadgeWidget({
    required this.badge,
    required this.isCompact,
  });

  final EditorBadge badge;
  final bool isCompact;

  @override
  Widget build(BuildContext context) {
    final color = badge.color ?? Theme.of(context).colorScheme.outline;
    final widget = Container(
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 4 : 6,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(badge.icon, size: isCompact ? 12 : 14, color: color),
          if (badge.label != null && !isCompact) ...[
            const SizedBox(width: 4),
            Text(
              badge.label!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ],
        ],
      ),
    );

    if (badge.tooltip != null) {
      return Tooltip(message: badge.tooltip!, child: widget);
    }
    return widget;
  }
}

/// Question type chip with color coding
class QuestionTypeChip extends StatelessWidget {
  const QuestionTypeChip({
    required this.type,
    required this.label,
    this.isCompact = false,
    super.key,
  });

  final QuestionType type;
  final String label;
  final bool isCompact;

  @override
  Widget build(BuildContext context) {
    final (color, icon) = _getTypeStyle(context);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 6 : 8,
        vertical: isCompact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: isCompact ? 12 : 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }

  (Color, IconData) _getTypeStyle(BuildContext context) {
    return switch (type) {
      QuestionType.simple => (Colors.blue, Icons.help_outline),
      QuestionType.stake => (Colors.amber.shade700, Icons.monetization_on_outlined),
      QuestionType.secret => (Colors.purple, Icons.visibility_off_outlined),
      QuestionType.noRisk => (Colors.green, Icons.shield_outlined),
      QuestionType.choice => (Colors.orange, Icons.list_alt_outlined),
      QuestionType.hidden => (Colors.grey, Icons.lock_outline),
      QuestionType.$unknown => (Colors.grey, Icons.help_outline),
    };
  }
}

/// Helper to get accent color for question type
Color getQuestionTypeColor(QuestionType type) {
  return switch (type) {
    QuestionType.simple => Colors.blue,
    QuestionType.stake => Colors.amber.shade700,
    QuestionType.secret => Colors.purple,
    QuestionType.noRisk => Colors.green,
    QuestionType.choice => Colors.orange,
    QuestionType.hidden => Colors.grey,
    QuestionType.$unknown => Colors.grey,
  };
}

/// Helper to get question type from PackageQuestionUnion
QuestionType getQuestionType(PackageQuestionUnion question) {
  return question.map(
    simple: (_) => QuestionType.simple,
    stake: (_) => QuestionType.stake,
    secret: (_) => QuestionType.secret,
    noRisk: (_) => QuestionType.noRisk,
    choice: (_) => QuestionType.choice,
    hidden: (_) => QuestionType.hidden,
  );
}
