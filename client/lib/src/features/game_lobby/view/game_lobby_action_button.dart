import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class LobbyActionButton extends WatchingWidget {
  const LobbyActionButton({this.floating = false, super.key});

  final bool floating;

  static const double _buttonHeight = 60;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameStarted = gameData?.gameStarted ?? false;
    final showActionArea = gameData != null && !gameStarted;

    if (!showActionArea) return const SizedBox.shrink();

    final actionButton = shouldShowLobbyActionButton(gameData)
        ? _LobbyActionButtonContent(
            gameData: gameData,
            floating: floating,
          )
        : null;

    if (floating) {
      if (actionButton == null) return const SizedBox.shrink();

      return _LobbyActionFloatingArea(child: actionButton);
    }

    return _LobbyActionBottomArea(child: actionButton);
  }
}

class _LobbyActionButtonContent extends StatelessWidget {
  const _LobbyActionButtonContent({
    required this.gameData,
    required this.floating,
  });

  final SocketIoGameJoinEventPayload gameData;
  final bool floating;

  @override
  Widget build(BuildContext context) {
    final readyPlayers = gameData.gameState.readyPlayers;
    final imReady = readyPlayers?.contains(gameData.me.meta.id) ?? false;
    final imShowman = gameData.me.role == PlayerRole.showman;
    final playerIds = gameData.players
        .where((player) => player.role == PlayerRole.player)
        .map((player) => player.meta.id)
        .toList();
    final readyPlayerCount =
        readyPlayers?.where(playerIds.contains).length ?? 0;
    final helperText = imShowman
        ? startGameButtonHelperText(
            playerCount: playerIds.length,
            readyPlayerCount: readyPlayerCount,
          )
        : null;
    final buttonIcon = imShowman
        ? Icons.play_arrow_rounded
        : imReady
        ? Icons.remove_circle_outline
        : Icons.check_circle_outline;
    final buttonLabel = imShowman
        ? startGameButtonLocaleKey(
            playerCount: playerIds.length,
            readyPlayerCount: readyPlayerCount,
          ).tr()
        : imReady
        ? LocaleKeys.game_lobby_editor_not_ready.tr()
        : LocaleKeys.game_lobby_editor_ready.tr();
    final baseButtonTextStyle = context.textTheme.labelLarge;
    final buttonTextStyle = baseButtonTextStyle?.copyWith(
      fontSize: (baseButtonTextStyle.fontSize ?? 14) * 1.35,
      fontWeight: FontWeight.w400,
    );

    final button = FilledButton.icon(
      onPressed: () {
        final controller = getIt<GameLobbyController>();
        if (imShowman) {
          controller.startGame();
        } else {
          controller.playerReady(ready: !imReady);
        }
      },
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(
          Size(240, LobbyActionButton._buttonHeight),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        ),
        textStyle: WidgetStatePropertyAll(buttonTextStyle),
        elevation: WidgetStatePropertyAll(floating ? 6 : 0),
        shadowColor: WidgetStatePropertyAll(
          context.theme.colorScheme.shadow.withValues(alpha: .24),
        ),
      ),
      icon: Icon(buttonIcon, size: 24),
      label: Text(
        buttonLabel,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );

    if (helperText == null) return button;

    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 6,
      children: [
        Text(
          helperText,
          textAlign: TextAlign.center,
          style: context.textTheme.bodySmall?.copyWith(
            color: context.theme.colorScheme.onSurfaceVariant,
          ),
        ),
        button,
      ],
    );
  }
}

class _LobbyActionBottomArea extends StatelessWidget {
  const _LobbyActionBottomArea({required this.child});

  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final layout = LobbyLayoutScope.maybeOf(context);
    final pagePadding =
        layout?.pagePadding ?? LobbyLayoutResolver.compactPagePadding;
    final trailingChatSpace = layout?.usesPersistentChat ?? false
        ? layout!.reservedChatWidth
        : 0.0;
    final maxButtonWidth = layout?.usesTwoMainColumns ?? false
        ? LobbyLayoutResolver.mobileActionMaxWidth
        : double.infinity;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          key: const Key('lobby_action_button_bottom_area'),
          type: MaterialType.transparency,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                pagePadding,
                LobbyLayoutResolver.bottomActionVerticalPadding,
                pagePadding,
                LobbyLayoutResolver.bottomActionVerticalPadding,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: LobbyActionButton._buttonHeight,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Align(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: maxButtonWidth),
                          child: SizedBox(
                            width: double.infinity,
                            child: child ?? const SizedBox.shrink(),
                          ),
                        ),
                      ),
                    ),
                    if (trailingChatSpace > 0)
                      SizedBox(width: trailingChatSpace),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _LobbyActionFloatingArea extends StatelessWidget {
  const _LobbyActionFloatingArea({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: const Key('lobby_action_button_floating_area'),
      padding: 16.horizontal,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: child,
      ),
    );
  }
}

bool shouldShowLobbyActionButton(SocketIoGameJoinEventPayload? gameData) {
  final gameStarted = gameData?.gameStarted ?? false;
  final currentPlayerIsSpectator = gameData?.me.isSpectator ?? true;
  final gameAcceptsLobbyActions = gameData != null && !gameStarted;

  return gameAcceptsLobbyActions && !currentPlayerIsSpectator;
}

@visibleForTesting
String startGameButtonLocaleKey({
  required int playerCount,
  required int readyPlayerCount,
}) {
  final hasNotReadyPlayers = playerCount > 0 && readyPlayerCount < playerCount;

  return hasNotReadyPlayers
      ? LocaleKeys.start_game_anyway
      : LocaleKeys.start_game;
}

@visibleForTesting
String? startGameButtonHelperText({
  required int playerCount,
  required int readyPlayerCount,
}) {
  if (playerCount == 0) return LocaleKeys.no_players_joined_yet.tr();

  final notReadyPlayerCount = playerCount - readyPlayerCount;
  if (notReadyPlayerCount <= 0) return null;

  return LocaleKeys.players_not_ready.plural(notReadyPlayerCount);
}
