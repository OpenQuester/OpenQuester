import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyEditor extends WatchingWidget {
  const GameLobbyEditor({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final players = gameData?.players ?? [];

    List<PlayerData> getList(PlayerRole role) {
      return players.where((e) => e.role == role).toList();
    }

    final showmans = getList(PlayerRole.showman);

    const gap = SizedBox();

    final children = <Widget>[
      Text(LocaleKeys.showman.tr()),
      Wrap(
        children: [
          if (showmans.isEmpty)
            _PlayerDragTarget(
              onAcceptWithDetails: (details) {},
              toDo: LocaleKeys.game_lobby_editor_set_as_showman.tr(),
            ),
          for (final player in showmans) playerWidget(player),
        ],
      ),
      gap,
      Text(LocaleKeys.players.tr()),
      Wrap(
        children: [
          _PlayerDragTarget(
            onAcceptWithDetails: (details) {},
            toDo: LocaleKeys.game_lobby_editor_set_as_player.tr(),
          ),
          for (final player in getList(PlayerRole.player)) playerWidget(player),
        ],
      ),
      gap,
      Text(LocaleKeys.spectators.tr()),
      Wrap(
        children: [
          _PlayerDragTarget(
            onAcceptWithDetails: (details) {},
            toDo: LocaleKeys.game_lobby_editor_set_as_spectator.tr(),
          ),
          for (final player in getList(PlayerRole.spectator))
            playerWidget(player),
        ],
      ),
    ];

    return ListView.separated(
      itemCount: children.length,
      padding: 16.horizontal,
      separatorBuilder: (context, index) =>
          const SizedBox.square(dimension: 16),
      itemBuilder: (context, index) => children[index],
    );
  }

  Widget playerWidget(PlayerData player) {
    final child = GameLobbyPlayer(
      player: player,
      playerAnswerState: PlayerAnswerState.none,
      answering: false,
      picking: false,
    );

    return Draggable<PlayerData>(
      data: player,
      feedback: Opacity(
        opacity: .7,
        child: child,
      ),
      child: child,
    );
  }
}

class _PlayerDragTarget extends StatelessWidget {
  const _PlayerDragTarget({
    required this.toDo,
    required this.onAcceptWithDetails,
  });
  final String toDo;
  final void Function(DragTargetDetails<PlayerData> details)
  onAcceptWithDetails;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: GameLobbyStyles.playerTileConstrains(context),
      child: DragTarget<PlayerData>(
        onAcceptWithDetails: onAcceptWithDetails,
        builder: (context, candidateData, rejectedData) {
          final dragging = candidateData.isNotEmpty;

          return DottedBorderWidget(
            radius: GameLobbyStyles.playerTileRadius,
            color: context.theme.colorScheme.onSurface,
            padding: 8.all,
            child: Text(
              dragging
                  ? LocaleKeys.release_to.tr(args: [toDo])
                  : LocaleKeys.drag_to.tr(args: [toDo]),
              textAlign: TextAlign.center,
            ).center(),
          );
        },
      ),
    );
  }
}
