// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_turn_player_change_event_payload.freezed.dart';
part 'socket_io_turn_player_change_event_payload.g.dart';

/// Data sent to all players when the turn player is changed
@Freezed()
abstract class SocketIOTurnPlayerChangeEventPayload with _$SocketIOTurnPlayerChangeEventPayload {
  const factory SocketIOTurnPlayerChangeEventPayload({
    /// ID of the player who now has the turn, or null if cleared
    required int? newTurnPlayerId,
  }) = _SocketIOTurnPlayerChangeEventPayload;
  
  factory SocketIOTurnPlayerChangeEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOTurnPlayerChangeEventPayloadFromJson(json);
}
