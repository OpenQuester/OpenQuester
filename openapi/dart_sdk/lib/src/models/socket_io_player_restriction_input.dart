// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_restriction_input.freezed.dart';
part 'socket_io_player_restriction_input.g.dart';

/// Data sent to update player restrictions (showman only)
@Freezed()
abstract class SocketIOPlayerRestrictionInput with _$SocketIOPlayerRestrictionInput {
  const factory SocketIOPlayerRestrictionInput({
    /// ID of the player to restrict
    required int playerId,

    /// Whether the player is muted
    required bool muted,

    /// Whether the player is restricted
    required bool restricted,

    /// Whether the player is banned
    required bool banned,
  }) = _SocketIOPlayerRestrictionInput;
  
  factory SocketIOPlayerRestrictionInput.fromJson(Map<String, Object?> json) => _$SocketIOPlayerRestrictionInputFromJson(json);
}
