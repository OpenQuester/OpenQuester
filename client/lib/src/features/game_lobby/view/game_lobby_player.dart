import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameLobbyPlayer extends WatchingWidget {
  const GameLobbyPlayer({
    required this.player,
    required this.playerAnswerState,
    required this.answering,
    required this.picking,
    this.customIcon,
    this.constraints,
    this.playerTextStyle,
    super.key,
  });

  final PlayerData player;
  final bool answering;
  final bool picking;
  final PlayerAnswerState playerAnswerState;
  final Widget? customIcon;
  final BoxConstraints? constraints;
  final TextStyle? playerTextStyle;

  @override
  Widget build(BuildContext context) {
    final extraColors = Theme.of(context).extension<ExtraColors>()!;
    final foregroundColor = Colors.black.withValues(alpha: .4);
    final borderColor = switch (playerAnswerState) {
      PlayerAnswerState.wrong => Colors.red,
      PlayerAnswerState.correct => extraColors.success,
      PlayerAnswerState.none => context.theme.colorScheme.surfaceContainerHigh,
      PlayerAnswerState.skip => null,
    };
    final playerSkipped = playerAnswerState == PlayerAnswerState.skip;
    final playerTextStyle =
        this.playerTextStyle ?? GameLobbyStyles.playerTextStyle(context);

    final child = Container(
      decoration: BoxDecoration(
        border: borderColor == null ? null : Border.all(color: borderColor),
        borderRadius: GameLobbyStyles.playerTileRadius.circular,
        color: context.theme.colorScheme.surface,
      ),
      padding: 4.all,
      constraints: constraints ?? GameLobbyStyles.playerTileConstrains(context),
      child: DefaultTextStyle(
        style: context.textTheme.bodySmall!.copyWith(
          color: Colors.white,
        ),
        child: IconTheme(
          data: const IconThemeData(size: 16, color: Colors.white),
          child: Stack(
            alignment: Alignment.center,
            fit: StackFit.expand,
            children: [
              Positioned.fill(
                child: Container(
                  foregroundDecoration: BoxDecoration(
                    color: foregroundColor,
                    borderRadius: 8.circular,
                  ),
                  decoration: BoxDecoration(borderRadius: 8.circular),
                  clipBehavior: Clip.antiAlias,
                  child: ImageWidget(
                    key: ValueKey(player.meta.avatar),
                    url: player.meta.avatar,
                  ),
                ),
              ),
              Stack(
                alignment: Alignment.topRight,
                fit: StackFit.expand,
                children: [
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        player.meta.username,
                        style: playerTextStyle,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (player.role == PlayerRole.player)
                        ScoreText(
                          score: player.score,
                          textStyle: playerTextStyle,
                        )
                      else if (player.role == PlayerRole.showman)
                        Text(LocaleKeys.showman.tr()),
                    ],
                  ),
                ],
              ),
              if (player.role == PlayerRole.showman)
                Align(
                  alignment: Alignment.topRight,
                  child: Assets.icons.crown
                      .svg(
                        width: 16,
                        height: 16,
                        colorFilter: const ColorFilter.mode(
                          Colors.white,
                          BlendMode.srcIn,
                        ),
                      )
                      .withTooltip(msg: LocaleKeys.showman.tr())
                      .paddingAll(2),
                ),
              if (player.status == PlayerDataStatus.disconnected ||
                  customIcon != null)
                Align(
                  alignment: Alignment.topLeft,
                  child:
                      customIcon ??
                      const Icon(Icons.signal_wifi_off).paddingAll(2),
                ),
              if (answering || picking)
                Align(
                  alignment: Alignment.bottomRight,
                  child: Icon(
                    picking ? Icons.star_border_rounded : Icons.more_horiz,
                  ).paddingAll(2),
                ),
              if (!{
                PlayerAnswerState.skip,
                PlayerAnswerState.none,
              }.contains(playerAnswerState))
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Icon(
                    playerAnswerState == PlayerAnswerState.correct
                        ? Icons.check
                        : Icons.close,
                  ).paddingAll(2),
                ),
            ],
          ).center(),
        ),
      ),
    );

    if (playerSkipped) {
      return DottedBorderWidget(
        color: context.theme.colorScheme.outline,
        radius: 12,
        child: child,
      );
    }

    return child;
  }
}
