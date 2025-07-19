// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'player_data.dart';
import 'player_role.dart';

part 'socket_io_player_role_change_event_payload.freezed.dart';
part 'socket_io_player_role_change_event_payload.g.dart';

/// Data sent to all players when a player's role is changed
@Freezed()
abstract class SocketIOPlayerRoleChangeEventPayload with _$SocketIOPlayerRoleChangeEventPayload {
  const factory SocketIOPlayerRoleChangeEventPayload({
    /// ID of the player whose role was changed
    required int playerId,

    /// The new role of the player
    required PlayerRole newRole,

    /// Updated list of all players with their current data
    required List<PlayerData> players,
  }) = _SocketIOPlayerRoleChangeEventPayload;
  
  factory SocketIOPlayerRoleChangeEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOPlayerRoleChangeEventPayloadFromJson(json);
}
