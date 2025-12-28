import 'package:openquester/common_imports.dart';
import 'package:socket_io_client/socket_io_client.dart';

@singleton
class GameLobbyEditorController {
  GameLobbyController get _lobbyController => getIt<GameLobbyController>();
  Socket? get _socket => _lobbyController.socket;

  void giveTurnToPlayer(int playerId) {
    _socket?.emit(
      SocketIOGameSendEvents.turnPlayerChanged.json!,
      SocketIOTurnPlayerChangeInput(newTurnPlayerId: playerId).toJson(),
    );
  }

  void changeScore(int playerId, int newScore) {
    _socket?.emit(
      SocketIOGameSendEvents.scoreChanged.json!,
      SocketIOPlayerScoreChangeInput(
        playerId: playerId,
        newScore: newScore,
      ).toJson(),
    );
  }

  void addPlayerRestriction(SocketIOPlayerRestrictionInput restriction) {
    _socket?.emit(
      SocketIOGameSendEvents.playerRestricted.json!,
      restriction.toJson(),
    );
  }

  void kickPlayer(int playerId) {
    _socket?.emit(
      SocketIOGameSendEvents.playerKicked.json!,
      SocketIOPlayerKickInput(playerId: playerId).toJson(),
    );
  }

  void playerRoleChange(PlayerRole newRole, [int? playerId]) {
    _socket?.emit(
      SocketIOGameSendEvents.playerRoleChange.json!,
      SocketIOPlayerRoleChangeInput(
        newRole: newRole,
        playerId: playerId ?? _lobbyController.gameData.value!.me.meta.id,
      ).toJson(),
    );
  }
}
