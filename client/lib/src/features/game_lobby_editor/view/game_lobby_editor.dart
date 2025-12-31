import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyEditor extends WatchingWidget {
  const GameLobbyEditor({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: 16.all,
      children: const [
        _ReadyButton(),
        _RoleGroup(PlayerRole.showman, showDisconnected: false),
        _RoleGroup(PlayerRole.player),
        _RoleGroup(PlayerRole.spectator),
      ],
    );
  }
}

class _ReadyButton extends WatchingWidget {
  const _ReadyButton();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);

    if (getIt<GameLobbyController>().gameStarted) return const SizedBox();

    final playerCount = gameData?.players
        .where((p) => p.role == PlayerRole.player)
        .length;
    final readyPlayers = gameData?.gameState.readyPlayers;
    final imReady = readyPlayers?.contains(gameData?.me.meta.id) ?? false;
    final imShowman = gameData?.me.role == PlayerRole.showman;
    final imSpectator = gameData?.me.role == PlayerRole.spectator;

    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 8,
      children: [
        if (!imShowman)
          Text(
            LocaleKeys.game_lobby_hint.tr(),
            style: context.textTheme.bodyMedium,
          ),
        if (!imSpectator)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FilledButton.tonal(
                onPressed: () {
                  final controller = getIt<GameLobbyController>();
                  if (imShowman) {
                    controller.startGame();
                  } else {
                    controller.playerReady(ready: !imReady);
                  }
                },
                child: Text(
                  imShowman
                      ? [
                          LocaleKeys.start_game.tr(),
                          ' ',
                          '(',
                          LocaleKeys.game_lobby_editor_ready.tr(),
                          ' ',
                          ':',
                          ' ${readyPlayers?.length ?? 0}/$playerCount',
                          ')',
                        ].join()
                      : imReady
                      ? LocaleKeys.game_lobby_editor_not_ready.tr()
                      : LocaleKeys.game_lobby_editor_ready.tr(),
                ),
              ),
            ],
          ).paddingAll(16),
      ],
    );
  }
}

class _RoleGroup extends WatchingWidget {
  const _RoleGroup(this.role, {this.showDisconnected = true});
  final PlayerRole role;
  final bool showDisconnected;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final groupPlayers =
        gameData?.players
            .where(
              (e) =>
                  e.role == role &&
                  (showDisconnected || e.status == PlayerDataStatus.inGame),
            )
            .sortedBy((p) => p.slot ?? 0) ??
        [];

    final showmanFilled =
        !(role == PlayerRole.showman && groupPlayers.isNotEmpty);
    final notPlayerTargetForPlayer = ![
      role,
      gameData?.me.role,
    ].every((e) => e == PlayerRole.player);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 16,
      children: [
        _RoleTitle(role),
        _Wrap(
          children: [
            if (showmanFilled && notPlayerTargetForPlayer)
              _PlayerDragTarget(
                onChange: (data) => _playerRoleChange(data, role),
                role: role,
              ),
            for (final player in groupPlayers) _Player(player),
          ],
        ),
      ],
    ).paddingBottom(16);
  }

  void _playerRoleChange(
    PlayerData data,
    PlayerRole newRole,
  ) {
    getIt<GameLobbyEditorController>().playerRoleChange(
      newRole,
      data.meta.id,
    );
  }
}

class _Player extends WatchingWidget {
  const _Player(this.player);
  final PlayerData player;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final playerAvailableToChange = _playerAvailableToChange(gameData, player);
    final playerBoxConstraints = BoxConstraints.expand(
      width: 350,
      height: GameLobbyStyles.players.height,
    );

    final child = GameLobbyPlayer(
      player: player,
      settings: const PlayerTileSettings.empty(),
      constraints: playerBoxConstraints,
      playerTextStyle: GameLobbyStyles.playerTextStyleDesktop(context),
      actionButton:
          playerAvailableToChange && gameData?.me.meta.id != player.meta.id
          ? PlayerEditBtn(player: player)
          : null,
      customIcon: playerAvailableToChange
          ? const Icon(Icons.drag_handle, size: 28)
          : null,
    );

    if (!playerAvailableToChange) return child;

    return Draggable<PlayerData>(
      data: player,
      feedback: Opacity(
        opacity: .7,
        child: child,
      ),
      child: MouseRegion(
        cursor: SystemMouseCursors.grab,
        child: child,
      ),
    );
  }
}

class _PlayerDragTarget extends WatchingWidget {
  const _PlayerDragTarget({
    required this.role,
    required this.onChange,
  });
  final PlayerRole role;
  final void Function(PlayerData data) onChange;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);

    final toDoText = switch (role) {
      PlayerRole.showman => LocaleKeys.game_lobby_editor_set_as_showman.tr(),
      PlayerRole.player => LocaleKeys.game_lobby_editor_set_as_player.tr(),
      PlayerRole.spectator =>
        LocaleKeys.game_lobby_editor_set_as_spectator.tr(),
      PlayerRole.$unknown => '',
    };

    final playerBoxConstraints = BoxConstraints.expand(
      width: 350,
      height: GameLobbyStyles.players.height,
    );

    return ConstrainedBox(
      constraints: playerBoxConstraints,
      child: DragTarget<PlayerData>(
        onAcceptWithDetails: (details) => onChange(details.data),
        onWillAcceptWithDetails: (details) {
          if (role == details.data.role) return false;
          return _playerAvailableToChange(gameData, details.data);
        },
        builder: (context, candidateData, rejectedData) {
          final dragging = candidateData.isNotEmpty;
          final myRole = role == gameData?.me.role;

          return InkWell(
            borderRadius: GameLobbyStyles.playerTileRadius.circular,
            onTap: myRole ? null : () => onChange(gameData!.me),
            child: DottedBorderWidget(
              radius: GameLobbyStyles.playerTileRadius,
              color: context.theme.colorScheme.onSurface,
              padding: 8.all,
              gap: dragging ? 0 : 5,
              child: Text(
                dragging
                    ? LocaleKeys.release_to.tr(args: [toDoText])
                    : LocaleKeys.drag_or_tap_to.tr(args: [toDoText]),
                textAlign: TextAlign.center,
                style: context.textTheme.labelSmall,
              ).center(),
            ),
          );
        },
      ),
    );
  }
}

bool _playerAvailableToChange(
  SocketIoGameJoinEventPayload? gameData,
  PlayerData playerData,
) {
  final me = gameData?.me;
  if (me?.role == PlayerRole.showman) return true;
  if (playerData.meta.id == me?.meta.id) return true;
  return false;
}

class _Wrap extends StatelessWidget {
  const _Wrap({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: children,
    );
  }
}

class _RoleTitle extends WatchingWidget {
  const _RoleTitle(this.role);
  final PlayerRole role;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameList = watchValue((GameLobbyController e) => e.gameListData);

    final roleName = switch (role) {
      PlayerRole.showman => LocaleKeys.showman.tr(),
      PlayerRole.player => LocaleKeys.players.tr(),
      PlayerRole.spectator => LocaleKeys.spectators.tr(),
      PlayerRole.$unknown => '',
    };

    int getPlayerCount() {
      return gameData?.players.where((e) => e.role == role).length ?? 0;
    }

    final count = role == PlayerRole.player
        ? '(${getPlayerCount()} / ${gameList?.maxPlayers ?? ''})'
        : null;

    return Text(
      [roleName, count].nonNulls.join(' '),
      style: context.textTheme.headlineMedium,
    );
  }
}
