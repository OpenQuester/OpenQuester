// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_kick_input.freezed.dart';
part 'socket_io_player_kick_input.g.dart';

/// Data sent to kick a player from the game (showman only)
@Freezed()
abstract class SocketIOPlayerKickInput with _$SocketIOPlayerKickInput {
  const factory SocketIOPlayerKickInput({
    /// ID of the player to kick
    required int playerId,
  }) = _SocketIOPlayerKickInput;
  
  factory SocketIOPlayerKickInput.fromJson(Map<String, Object?> json) => _$SocketIOPlayerKickInputFromJson(json);
}
