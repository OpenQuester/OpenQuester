import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';

/// Breadcrumb navigation component for the package editor
/// Shows the current location in the package hierarchy
/// Each segment is tappable to navigate back to that level
class EditorBreadcrumb extends StatelessWidget {
  const EditorBreadcrumb({
    required this.translations,
    this.package,
    this.roundIndex,
    this.themeIndex,
    this.onNavigateToPackage,
    this.onNavigateToRound,
    this.onNavigateToTheme,
    super.key,
  });

  final OqEditorTranslations translations;
  final OqPackage? package;
  final int? roundIndex;
  final int? themeIndex;
  final VoidCallback? onNavigateToPackage;
  final VoidCallback? onNavigateToRound;
  final VoidCallback? onNavigateToTheme;

  @override
  Widget build(BuildContext context) {
    final segments = <_BreadcrumbSegment>[];

    // Always add package root
    segments.add(
      _BreadcrumbSegment(
        label: package?.title ?? translations.packageInfo,
        icon: Icons.folder_open,
        onTap: onNavigateToPackage,
      ),
    );

    // Add round if present
    if (roundIndex != null && package != null) {
      if (roundIndex! < package!.rounds.length) {
        final round = package!.rounds[roundIndex!];
        segments.add(
          _BreadcrumbSegment(
            label: round.name,
            icon: Icons.interests_outlined,
            onTap: onNavigateToRound,
          ),
        );
      }
    }

    // Add theme if present
    if (roundIndex != null &&
        themeIndex != null &&
        package != null &&
        roundIndex! < package!.rounds.length) {
      final round = package!.rounds[roundIndex!];
      if (themeIndex! < round.themes.length) {
        final theme = round.themes[themeIndex!];
        segments.add(
          _BreadcrumbSegment(
            label: theme.name,
            icon: Icons.dashboard_outlined,
            onTap: onNavigateToTheme,
          ),
        );
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.home_outlined,
            size: 20,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var i = 0; i < segments.length; i++) ...[
                    if (i > 0) _BreadcrumbSeparator(),
                    _BreadcrumbItem(
                      segment: segments[i],
                      isLast: i == segments.length - 1,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BreadcrumbSegment {
  _BreadcrumbSegment({
    required this.label,
    required this.icon,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
}

class _BreadcrumbItem extends StatelessWidget {
  const _BreadcrumbItem({
    required this.segment,
    required this.isLast,
  });

  final _BreadcrumbSegment segment;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
      fontWeight: isLast ? FontWeight.w600 : FontWeight.normal,
      color: isLast
          ? Theme.of(context).colorScheme.onSurface
          : Theme.of(context).colorScheme.onSurfaceVariant,
    );

    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          segment.icon,
          size: 16,
          color: isLast
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 200),
          child: Text(
            segment.label,
            style: textStyle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );

    if (segment.onTap == null || isLast) {
      return child;
    }

    return InkWell(
      onTap: segment.onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: child,
      ),
    );
  }
}

class _BreadcrumbSeparator extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Icon(
        Icons.chevron_right,
        size: 16,
        color: Theme.of(context).colorScheme.outlineVariant,
      ),
    );
  }
}
