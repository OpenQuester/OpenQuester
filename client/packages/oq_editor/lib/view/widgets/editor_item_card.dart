import 'package:flutter/material.dart';

/// Unified card component for editor items (rounds, themes, questions)
/// Provides consistent visual styling with customizable content slots
class EditorItemCard extends StatelessWidget {
  const EditorItemCard({
    required this.title,
    this.subtitle,
    this.index,
    this.trailing,
    this.leading,
    this.footer,
    this.onTap,
    this.onLongPress,
    this.selected = false,
    this.depthLevel = 0,
    super.key,
  });

  final String title;
  final String? subtitle;
  final int? index;
  final Widget? trailing;
  final Widget? leading;
  final Widget? footer;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool selected;
  
  /// Depth level for color coding (0=round, 1=theme, 2=question)
  final int depthLevel;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    
    // Color-code by depth level with subtle tints
    Color? backgroundColor;
    if (selected) {
      backgroundColor = colorScheme.primaryContainer;
    } else {
      switch (depthLevel) {
        case 0: // Rounds - blue tint
          backgroundColor = colorScheme.primaryContainer.withValues(alpha: 0.1);
        case 1: // Themes - green tint
          backgroundColor =
              colorScheme.tertiaryContainer.withValues(alpha: 0.1);
        case 2: // Questions - orange tint
          backgroundColor =
              colorScheme.secondaryContainer.withValues(alpha: 0.1);
        default:
          backgroundColor = null;
      }
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: backgroundColor,
      elevation: selected ? 2 : 0,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  // Leading (drag handle, checkbox, or custom widget)
                  if (leading != null) ...[
                    leading!,
                    const SizedBox(width: 8),
                  ] else if (index != null) ...[
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: colorScheme.primaryContainer,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '${index! + 1}',
                          style: TextStyle(
                            color: colorScheme.onPrimaryContainer,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  // Content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            subtitle!,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Trailing (actions, badges, etc.)
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing!,
                  ],
                ],
              ),
            ),
            // Optional footer (buttons, stats, etc.)
            if (footer != null)
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: colorScheme.outlineVariant.withValues(alpha: 0.5),
                    ),
                  ),
                ),
                child: footer,
              ),
          ],
        ),
      ),
    );
  }
}

/// Compact row variant for dense information display
class EditorItemRow extends StatelessWidget {
  const EditorItemRow({
    required this.title,
    this.subtitle,
    this.index,
    this.leading,
    this.trailing,
    this.badges,
    this.onTap,
    this.onLongPress,
    this.selected = false,
    super.key,
  });

  final String title;
  final String? subtitle;
  final int? index;
  final Widget? leading;
  final Widget? trailing;
  final List<Widget>? badges;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? colorScheme.primaryContainer.withValues(alpha: 0.3)
              : null,
          border: Border(
            bottom: BorderSide(
              color: colorScheme.outlineVariant.withValues(alpha: 0.5),
            ),
          ),
        ),
        child: Row(
          children: [
            // Leading (index or custom)
            if (leading != null) ...[
              leading!,
              const SizedBox(width: 8),
            ] else if (index != null) ...[
              SizedBox(
                width: 32,
                child: Text(
                  '${index! + 1}.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(width: 4),
            ],
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            // Badges
            if (badges != null && badges!.isNotEmpty) ...[
              const SizedBox(width: 8),
              Wrap(
                spacing: 4,
                children: badges!,
              ),
            ],
            // Trailing
            if (trailing != null) ...[
              const SizedBox(width: 8),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}
