// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'game_state_timer.dart';

part 'socket_io_game_unpause_event_payload.freezed.dart';
part 'socket_io_game_unpause_event_payload.g.dart';

/// Data sent to all players when the game is unpaused
@Freezed()
abstract class SocketIOGameUnpauseEventPayload with _$SocketIOGameUnpauseEventPayload {
  const factory SocketIOGameUnpauseEventPayload({
    required GameStateTimer timer,
  }) = _SocketIOGameUnpauseEventPayload;
  
  factory SocketIOGameUnpauseEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOGameUnpauseEventPayloadFromJson(json);
}
