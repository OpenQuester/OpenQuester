// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_kick_event_payload.freezed.dart';
part 'socket_io_player_kick_event_payload.g.dart';

/// Data sent to all players when a player is kicked
@Freezed()
abstract class SocketIOPlayerKickEventPayload with _$SocketIOPlayerKickEventPayload {
  const factory SocketIOPlayerKickEventPayload({
    /// ID of the player who was kicked
    required int playerId,
  }) = _SocketIOPlayerKickEventPayload;
  
  factory SocketIOPlayerKickEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOPlayerKickEventPayloadFromJson(json);
}
