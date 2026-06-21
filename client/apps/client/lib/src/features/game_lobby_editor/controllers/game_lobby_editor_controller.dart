import 'package:openquester/common_imports.dart';
import 'package:socket_io_client/socket_io_client.dart';

@singleton
class GameLobbyEditorController {
  GameLobbyController get _lobbyController => getIt<GameLobbyController>();
  Socket? get _socket => _lobbyController.socket;

  void giveTurnToPlayer(int playerId) {
    _socket?.emit(
      SocketIoGameSendEvents.turnPlayerChanged.json!,
      SocketIoTurnPlayerChangeInput(newTurnPlayerId: playerId).toJson(),
    );
  }

  void changeScore(int playerId, int newScore) {
    _socket?.emit(
      SocketIoGameSendEvents.scoreChanged.json!,
      SocketIoPlayerScoreChangeInput(
        playerId: playerId,
        newScore: newScore,
      ).toJson(),
    );
  }

  void addPlayerRestriction(SocketIoPlayerRestrictionInput restriction) {
    _socket?.emit(
      SocketIoGameSendEvents.playerRestricted.json!,
      restriction.toJson(),
    );
  }

  void kickPlayer(int playerId) {
    _socket?.emit(
      SocketIoGameSendEvents.playerKicked.json!,
      SocketIoPlayerKickInput(playerId: playerId).toJson(),
    );
  }

  void playerRoleChange(PlayerRole newRole, [int? playerId]) {
    _socket?.emit(
      SocketIoGameSendEvents.playerRoleChange.json!,
      SocketIoPlayerRoleChangeInput(
        newRole: newRole,
        playerId: playerId ?? _lobbyController.gameData.value!.me.meta.id,
      ).toJson(),
    );
  }
}
