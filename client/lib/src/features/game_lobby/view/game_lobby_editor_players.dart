import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyEditorPlayers extends WatchingWidget {
  const GameLobbyEditorPlayers({required this.axis, super.key});
  final Axis axis;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final players = gameData?.players ?? [];

    final children = <Widget>[
      const Text(LocaleKeys.showman),
      _PlayerDragTarget(
        onAcceptWithDetails: (details) {},
        toDo: LocaleKeys.game_lobby_editor_set_as_showman.tr(),
      ),
    ];

    return ListView.separated(
      itemCount: children.length,
      scrollDirection: axis,
      padding: axis == Axis.horizontal ? 16.horizontal : null,
      separatorBuilder: (context, index) => const SizedBox.square(dimension: 8),
      itemBuilder: (context, index) => children[index],
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
      constraints: GameLobbyStyles.playerTileConstrains(),
      child: DragTarget<PlayerData>(
        onAcceptWithDetails: onAcceptWithDetails,
        builder: (context, candidateData, rejectedData) {
          final dragging = candidateData.isNotEmpty;

          return DottedBorderWidget(
            radius: GameLobbyStyles.playerTileRadius,
            color: context.theme.colorScheme.onSurface,
            child: Text(
              dragging
                  ? LocaleKeys.release_to.tr(args: [toDo])
                  : LocaleKeys.drag_to.tr(args: [toDo]),
            ).center(),
          );
        },
      ),
    );
  }
}
