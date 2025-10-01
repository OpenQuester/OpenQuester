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
    final extraColors = Theme.of(context).extension<ExtraColors>()!;
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
              Align(
                alignment: Alignment.topLeft,
                child:
                    customIcon ??
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (customIcon != null) customIcon!,
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
                    if (actionButton != null) actionButton!,
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

    // Only show indicator if there's an active question with media
    final hasMedia = questionData?.file != null;
    if (!hasMedia) return const SizedBox.shrink();

    // Show check icon if downloaded, loading icon if not
    final mediaDownloaded = player.mediaDownloaded ?? false;
    
    return Icon(
      mediaDownloaded ? Icons.check_circle : Icons.downloading,
      color: mediaDownloaded ? Colors.green : Colors.orange,
      size: 16,
    ).withTooltip(
      msg: mediaDownloaded 
          ? 'Media Downloaded'
          : 'Downloading Media...',
    );
  }
}
