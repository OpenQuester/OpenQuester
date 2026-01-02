import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// Screen displayed when game finishes, showing final scores
class GameFinishedScreen extends WatchingWidget {
  const GameFinishedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final players =
        gameData?.players.where((p) => p.role == PlayerRole.player).toList()
          ?..sort((a, b) => (b.score).compareTo(a.score));

    return SingleChildScrollView(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.emoji_events,
            size: 64,
            color: context.theme.colorScheme.primary,
          ).paddingBottom(16),
          Text(
            LocaleKeys.game_is_finished.tr(),
            style: context.textTheme.displayMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ).paddingBottom(8),
          Text(
            LocaleKeys.final_scores.tr(),
            style: context.textTheme.titleLarge?.copyWith(
              color: context.theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ).paddingBottom(32),
          if (players != null && players.isNotEmpty)
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Card.outlined(
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    for (var i = 0; i < players.length; i++)
                      _PlayerScoreItem(
                        player: players[i],
                        position: i + 1,
                        isFirst: i == 0,
                      ),
                  ],
                ),
              ),
            )
          else
            Text(
              LocaleKeys.no_players.tr(),
              style: context.textTheme.bodyLarge?.copyWith(
                color: context.theme.colorScheme.onSurfaceVariant,
              ),
            ),
        ],
      ).paddingAll(24),
    );
  }
}

class _PlayerScoreItem extends StatelessWidget {
  const _PlayerScoreItem({
    required this.player,
    required this.position,
    required this.isFirst,
  });

  final PlayerData player;
  final int position;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    final positionIcon = _getPositionIcon(position);

    return Container(
      decoration: BoxDecoration(
        color: isFirst
            ? context.theme.colorScheme.primaryContainer.withValues(alpha: 0.3)
            : null,
        border: position > 1
            ? Border(
                top: BorderSide(
                  color: context.theme.colorScheme.outline.withValues(
                    alpha: 0.2,
                  ),
                ),
              )
            : null,
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 8,
        ),
        leading: positionIcon != null
            ? Icon(
                positionIcon,
                size: 32,
                color: _getPositionColor(context, position),
              )
            : CircleAvatar(
                backgroundColor:
                    context.theme.colorScheme.surfaceContainerHighest,
                child: Text(
                  '$position',
                  style: context.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
        title: Row(
          children: [
            if (player.meta.avatar != null)
              ImageWidget(
                url: player.meta.avatar,
                avatarRadius: 16,
              ).paddingRight(12),
            Expanded(
              child: Text(
                player.meta.username,
                style: context.textTheme.titleMedium?.copyWith(
                  fontWeight: isFirst ? FontWeight.bold : FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        trailing: ScoreText(
          score: player.score,
          textStyle: context.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: isFirst
                ? context.theme.colorScheme.primary
                : context.theme.colorScheme.onSurface,
          ),
        ),
      ),
    );
  }

  IconData? _getPositionIcon(int position) {
    return switch (position) {
      1 => Icons.emoji_events,
      2 => Icons.workspace_premium,
      3 => Icons.military_tech,
      _ => null,
    };
  }

  Color _getPositionColor(BuildContext context, int position) {
    final extraColors = ExtraColors.of(context);
    return switch (position) {
      1 => extraColors.gold,
      2 => extraColors.silver,
      3 => extraColors.bronze,
      _ => context.theme.colorScheme.onSurface,
    };
  }
}
