// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_slot_change_input.freezed.dart';
part 'socket_io_player_slot_change_input.g.dart';

/// Data sent to change a player's slot
@Freezed()
abstract class SocketIOPlayerSlotChangeInput with _$SocketIOPlayerSlotChangeInput {
  const factory SocketIOPlayerSlotChangeInput({
    /// The target slot to change to (0-indexed)
    required int targetSlot,

    /// Optional: ID of the player whose slot to change (for showman use)
    required int? playerId,
  }) = _SocketIOPlayerSlotChangeInput;
  
  factory SocketIOPlayerSlotChangeInput.fromJson(Map<String, Object?> json) => _$SocketIOPlayerSlotChangeInputFromJson(json);
}
