import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameListItemWidget extends WatchingWidget {
  const GameListItemWidget({
    required this.item,
    required this.onTap,
    super.key,
    this.expanded = false,
    this.bottom,
    this.trailing,
  });
  final GameListItem item;
  final VoidCallback? onTap;
  final bool expanded;
  final Widget? bottom;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final timeController = watchIt<TimeController>();

    final children = [
      _GameListItemBadges(item),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            title: _title(context),
            subtitle: _subtitle(context),
            titleAlignment: ListTileTitleAlignment.top,
            contentPadding: 4.left + 16.right,
            mouseCursor: MouseCursor.defer,
            minVerticalPadding: 4,
          ).expand(),
          Text(
            _gameInfo(timeController),
            overflow: TextOverflow.ellipsis,
            style: context.textTheme.bodySmall?.copyWith(
              color: context.theme.colorScheme.outline,
            ),
          ).paddingSymmetric(vertical: 8, horizontal: 4),
        ],
      ).expand(),
      if (trailing != null)
        Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [trailing!],
        ).paddingRight(16),
    ];

    return Hero(
      tag: item,
      child: Material(
        color: Colors.transparent,
        borderRadius: 16.circular,
        child: InkWell(
          onTap: onTap,
          borderRadius: 16.circular,
          child: Card(
            color: context.theme.colorScheme.surfaceContainer,
            elevation: 4,
            child: Column(
              mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
              children: [
                Row(
                  spacing: 4,
                  children: children,
                ).paddingSymmetric(horizontal: 2).withHeight(120),
                if (bottom != null) bottom!.flexible(),
              ],
            ),
          ),
        ),
      ).paddingSymmetric(horizontal: 6),
    );
  }

  Widget _subtitle(BuildContext context) {
    return Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: '${LocaleKeys.package.tr()}: ',
                style: TextStyle(color: context.theme.colorScheme.outline),
              ),
              TextSpan(text: item.package.title),
            ],
          ),
          style: context.textTheme.bodyMedium?.copyWith(
            color: context.theme.colorScheme.onSurfaceVariant,
          ),
          overflow: TextOverflow.ellipsis,
          maxLines: 2,
        )
        .constrained(const BoxConstraints(minHeight: 42))
        .withTooltip(msg: LocaleKeys.game_tile_tooltips_packages_title.tr())
        .paddingTop(4)
        .shrink();
  }

  Widget _title(BuildContext context) {
    final ageRestriction = item.ageRestriction.format(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 8,
      children: [
        Text(
          item.title,
          overflow: TextOverflow.ellipsis,
          maxLines: 2,
        ).flexible(),
        if (item.isPrivate) const Icon(Icons.lock, size: 16),
        if (ageRestriction != null)
          Text(ageRestriction.$1, style: TextStyle(color: ageRestriction.$2)),
      ],
    ).withTooltip(msg: LocaleKeys.game_tile_tooltips_game_title.tr()).shrink();
  }

  String _gameInfo(TimeController timeController) {
    final startedAt = item.startedAt;
    return [
      [
        LocaleKeys.game_status_started.tr(),
        if (startedAt != null) timeController.current.difference(startedAt).f(),
        LocaleKeys.hosted_by.tr(args: [item.createdBy.username]),
      ].join(' • '),
    ].join('\n');
  }
}

class _GameListItemBadges extends StatelessWidget {
  const _GameListItemBadges(this.item);
  final GameListItem item;

  @override
  Widget build(BuildContext context) {
    final dividerColor = context.theme.colorScheme.outline.withValues(
      alpha: .15,
    );

    return Container(
      decoration: BoxDecoration(
        border: Border(right: BorderSide(color: dividerColor)),
      ),
      constraints: const BoxConstraints(maxWidth: 90),
      // [IntrinsicWidth] used to set all _Badge width to widest one of them
      // so borders can be as dividers which dont expand width to infinity
      child: IntrinsicWidth(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _Badge(
              icon: Icons.person_outline,
              tooltip: LocaleKeys.game_tile_tooltips_players.tr(),
              label: [item.players.length, item.maxPlayers].join('/'),
            ),
            _Badge(
              icon: Icons.check,
              tooltip: LocaleKeys.game_tile_tooltips_rounds.tr(),
              dividerColor: dividerColor,
              label: [
                item.currentRound ?? 0,
                item.package.roundsCount,
              ].join('/'),
            ),
            _Badge(
              icon: Icons.question_mark,
              tooltip: LocaleKeys.game_tile_tooltips_questions.tr(),
              dividerColor: dividerColor,
              label: [
                item.playedQuestions ?? 0,
                item.package.questionsCount,
              ].join('/'),
            ),
          ].map((e) => e.expand()).toList(),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.icon,
    required this.label,
    required this.tooltip,
    this.dividerColor,
  });
  final IconData icon;
  final String label;
  final String? tooltip;
  final Color? dividerColor;

  @override
  Widget build(BuildContext context) {
    final tooltipMsg = [
      tooltip ?? '',
      // Show long label in tooltip
      if (label.length > 6) label,
    ].join('\n');

    return Container(
      padding: 2.all + 6.right,
      decoration: BoxDecoration(
        border: dividerColor == null
            ? null
            : Border(top: BorderSide(color: dividerColor!)),
      ),
      child: Row(
        spacing: 4,
        children: [
          Icon(icon, size: 16),
          Text(
            label,
            style: context.textTheme.labelSmall,
            overflow: TextOverflow.ellipsis,
          ).flexible(),
        ],
      ),
    ).withTooltip(msg: tooltipMsg);
  }
}
