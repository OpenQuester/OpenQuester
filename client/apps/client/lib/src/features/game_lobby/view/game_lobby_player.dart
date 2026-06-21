import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameLobbyPlayer extends WatchingWidget {
  const GameLobbyPlayer({
    required this.player,
    required this.settings,
    this.customIcon,
    this.actionButton,
    this.constraints,
    this.playerTextStyle,
    super.key,
  });

  final PlayerData player;
  final PlayerTileSettings settings;
  final Widget? customIcon;
  final Widget? actionButton;
  final BoxConstraints? constraints;
  final TextStyle? playerTextStyle;

  @override
  Widget build(BuildContext context) {
    final extraColors = ExtraColors.of(context);
    final foregroundColor = Colors.black.withValues(alpha: .4);
    final borderColor = switch (settings.playerAnswerState) {
      PlayerAnswerState.wrong => Colors.red,
      PlayerAnswerState.correct => extraColors.success,
      PlayerAnswerState.none => context.theme.colorScheme.surfaceContainerHigh,
      PlayerAnswerState.skip => null,
    };
    final playerSkipped = settings.playerAnswerState == PlayerAnswerState.skip;
    final playerTextStyle =
        this.playerTextStyle ?? GameLobbyStyles.playerTextStyle(context);

    final child = Container(
      decoration: BoxDecoration(
        border: borderColor == null ? null : Border.all(color: borderColor),
        borderRadius: GameLobbyStyles.playerTileRadius.circular,
        color: context.theme.colorScheme.surface,
      ),
      padding: borderColor == null ? null : 4.all,
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
                  child: ImageWidget(url: player.meta.avatar),
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
                      if (player.isPlayer)
                        ScoreText(
                          score: player.score,
                          textStyle: playerTextStyle,
                        )
                      else if (player.isShowman)
                        Text(LocaleKeys.showman.tr()),
                    ],
                  ),
                ],
              ),
              if (player.isShowman)
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
              Align(
                alignment: Alignment.topLeft,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ?customIcon,
                    if (player.status == PlayerDataStatus.disconnected)
                      const Icon(Icons.signal_wifi_off),
                    _MediaDownloadIndicator(player: player),
                  ],
                ).paddingAll(2),
              ),
              Align(
                alignment: Alignment.bottomRight,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ?actionButton,
                    if (settings.hasTurn)
                      Icon(
                        settings.picking
                            ? Icons.star_border_rounded
                            : Icons.more_horiz,
                      ).paddingAll(2),
                  ],
                ),
              ),
              if (!{
                PlayerAnswerState.skip,
                PlayerAnswerState.none,
              }.contains(settings.playerAnswerState))
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Icon(
                    settings.playerAnswerState == PlayerAnswerState.correct
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

class PlayerTileSettings {
  const PlayerTileSettings({
    required this.answering,
    required this.picking,
    required this.hasTurn,
    required this.playerAnswerState,
  });

  const PlayerTileSettings.empty({
    this.answering = false,
    this.picking = false,
    this.hasTurn = false,
    this.playerAnswerState = PlayerAnswerState.none,
  });

  final bool answering;
  final bool picking;
  final bool hasTurn;
  final PlayerAnswerState playerAnswerState;
}

class _MediaDownloadIndicator extends WatchingWidget {
  const _MediaDownloadIndicator({required this.player});

  final PlayerData player;

  @override
  Widget build(BuildContext context) {
    final questionData = watchValue(
      (GameQuestionController e) => e.questionData,
    );
    final waitingForPlayers = watchValue(
      (GameQuestionController e) => e.waitingForPlayers,
    );

    final hasMedia = questionData?.file != null;
    final mediaDownloaded = player.mediaDownloaded;
    if (!hasMedia || mediaDownloaded || !waitingForPlayers) {
      return const SizedBox.shrink();
    }

    // Show loader if not downloaded yet
    return const CircularProgressIndicator(strokeWidth: 1, color: Colors.white)
        .withSize(width: 16, height: 16)
        .withTooltip(msg: LocaleKeys.question_waiting_for_all_players.tr());
  }
}
