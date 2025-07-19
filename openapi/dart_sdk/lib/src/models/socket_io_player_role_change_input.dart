// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'player_role.dart';

part 'socket_io_player_role_change_input.freezed.dart';
part 'socket_io_player_role_change_input.g.dart';

/// Data sent to change a player's role
@Freezed()
abstract class SocketIOPlayerRoleChangeInput with _$SocketIOPlayerRoleChangeInput {
  const factory SocketIOPlayerRoleChangeInput({
    /// ID of the player whose role to change
    required int? playerId,

    /// The new role for the player
    required PlayerRole newRole,
  }) = _SocketIOPlayerRoleChangeInput;
  
  factory SocketIOPlayerRoleChangeInput.fromJson(Map<String, Object?> json) => _$SocketIOPlayerRoleChangeInputFromJson(json);
}
