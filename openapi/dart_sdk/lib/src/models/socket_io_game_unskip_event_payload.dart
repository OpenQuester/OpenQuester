// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_game_unskip_event_payload.freezed.dart';
part 'socket_io_game_unskip_event_payload.g.dart';

/// Data sent to all players when player unskips a question
@Freezed()
abstract class SocketIOGameUnskipEventPayload with _$SocketIOGameUnskipEventPayload {
  const factory SocketIOGameUnskipEventPayload({
    /// ID of the player who unskipped the question
    required int playerId,
  }) = _SocketIOGameUnskipEventPayload;
  
  factory SocketIOGameUnskipEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOGameUnskipEventPayloadFromJson(json);
}
