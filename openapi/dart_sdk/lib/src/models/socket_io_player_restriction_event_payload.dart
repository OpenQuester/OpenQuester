// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_restriction_event_payload.freezed.dart';
part 'socket_io_player_restriction_event_payload.g.dart';

/// Data sent to all players when player restrictions are updated
@Freezed()
abstract class SocketIOPlayerRestrictionEventPayload with _$SocketIOPlayerRestrictionEventPayload {
  const factory SocketIOPlayerRestrictionEventPayload({
    /// ID of the player whose restrictions were updated
    required int playerId,

    /// Whether the player is muted
    required bool muted,

    /// Whether the player is restricted
    required bool restricted,

    /// Whether the player is banned
    required bool banned,
  }) = _SocketIOPlayerRestrictionEventPayload;
  
  factory SocketIOPlayerRestrictionEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOPlayerRestrictionEventPayloadFromJson(json);
}
