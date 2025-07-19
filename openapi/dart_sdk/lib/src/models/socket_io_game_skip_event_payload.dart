// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_game_skip_event_payload.freezed.dart';
part 'socket_io_game_skip_event_payload.g.dart';

/// Data sent to all players when player skips a question
@Freezed()
abstract class SocketIOGameSkipEventPayload with _$SocketIOGameSkipEventPayload {
  const factory SocketIOGameSkipEventPayload({
    /// ID of the player who skipped the question
    required int playerId,
  }) = _SocketIOGameSkipEventPayload;
  
  factory SocketIOGameSkipEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOGameSkipEventPayloadFromJson(json);
}
