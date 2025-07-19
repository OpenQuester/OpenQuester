// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'player_data.dart';

part 'socket_io_player_slot_change_event_payload.freezed.dart';
part 'socket_io_player_slot_change_event_payload.g.dart';

/// Data sent to all players when a player changes their slot
@Freezed()
abstract class SocketIOPlayerSlotChangeEventPayload with _$SocketIOPlayerSlotChangeEventPayload {
  const factory SocketIOPlayerSlotChangeEventPayload({
    /// ID of the player who changed their slot
    required int playerId,

    /// The new slot number (0-indexed)
    required int newSlot,

    /// Updated list of all players with their current data
    required List<PlayerData> players,
  }) = _SocketIOPlayerSlotChangeEventPayload;
  
  factory SocketIOPlayerSlotChangeEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOPlayerSlotChangeEventPayloadFromJson(json);
}
