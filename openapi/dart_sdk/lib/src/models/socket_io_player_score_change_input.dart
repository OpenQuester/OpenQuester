// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'socket_io_player_score_change_input.freezed.dart';
part 'socket_io_player_score_change_input.g.dart';

/// Data sent to change a player's score (showman only)
@Freezed()
abstract class SocketIOPlayerScoreChangeInput with _$SocketIOPlayerScoreChangeInput {
  const factory SocketIOPlayerScoreChangeInput({
    /// ID of the player whose score to change
    required int playerId,

    /// The new score for the player
    required int newScore,
  }) = _SocketIOPlayerScoreChangeInput;
  
  factory SocketIOPlayerScoreChangeInput.fromJson(Map<String, Object?> json) => _$SocketIOPlayerScoreChangeInputFromJson(json);
}
