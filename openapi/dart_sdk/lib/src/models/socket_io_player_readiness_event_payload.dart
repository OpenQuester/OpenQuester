// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_readiness_event_payload.freezed.dart';
part 'socket_io_player_readiness_event_payload.g.dart';

/// This data is sent to all players in room when a player changes their ready status
@Freezed()
abstract class SocketIOPlayerReadinessEventPayload with _$SocketIOPlayerReadinessEventPayload {
  const factory SocketIOPlayerReadinessEventPayload({
    /// ID of the player who changed their ready status
    required int playerId,

    /// Whether the player is ready or not
    required bool isReady,

    /// Array of all currently ready player IDs
    required List<int> readyPlayers,

    /// Optional field indicating if game auto-start was triggered
    required bool autoStartTriggered,
  }) = _SocketIOPlayerReadinessEventPayload;
  
  factory SocketIOPlayerReadinessEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOPlayerReadinessEventPayloadFromJson(json);
}
