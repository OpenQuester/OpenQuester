// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_turn_player_change_input.freezed.dart';
part 'socket_io_turn_player_change_input.g.dart';

/// Data sent to change the current turn player (showman only)
@Freezed()
abstract class SocketIOTurnPlayerChangeInput with _$SocketIOTurnPlayerChangeInput {
  const factory SocketIOTurnPlayerChangeInput({
    /// ID of the player who should have the turn, or null to clear
    required int? newTurnPlayerId,
  }) = _SocketIOTurnPlayerChangeInput;
  
  factory SocketIOTurnPlayerChangeInput.fromJson(Map<String, Object?> json) => _$SocketIOTurnPlayerChangeInputFromJson(json);
}
