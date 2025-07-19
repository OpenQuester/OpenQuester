// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_score_change_event_payload.freezed.dart';
part 'socket_io_player_score_change_event_payload.g.dart';

/// Data sent to all players when a player's score is changed
@Freezed()
abstract class SocketIOPlayerScoreChangeEventPayload with _$SocketIOPlayerScoreChangeEventPayload {
  const factory SocketIOPlayerScoreChangeEventPayload({
    /// ID of the player whose score was changed
    required int playerId,

    /// The new score of the player
    required int newScore,
  }) = _SocketIOPlayerScoreChangeEventPayload;
  
  factory SocketIOPlayerScoreChangeEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOPlayerScoreChangeEventPayloadFromJson(json);
}
