// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'game_state_timer.dart';

part 'socket_io_game_pause_event_payload.freezed.dart';
part 'socket_io_game_pause_event_payload.g.dart';

/// Data sent to all players when the game is paused
@Freezed()
abstract class SocketIOGamePauseEventPayload with _$SocketIOGamePauseEventPayload {
  const factory SocketIOGamePauseEventPayload({
    required GameStateTimer timer,
  }) = _SocketIOGamePauseEventPayload;
  
  factory SocketIOGamePauseEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOGamePauseEventPayloadFromJson(json);
}
