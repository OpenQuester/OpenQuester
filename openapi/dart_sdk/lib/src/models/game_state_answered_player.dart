// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'socket_io_game_answer_type.dart';

part 'game_state_answered_player.freezed.dart';
part 'game_state_answered_player.g.dart';

@Freezed()
abstract class GameStateAnsweredPlayer with _$GameStateAnsweredPlayer {
  const factory GameStateAnsweredPlayer({
    /// Id of answered player
    required int player,
    required int result,
    required int score,
    required SocketIOGameAnswerType answerType,
  }) = _GameStateAnsweredPlayer;
  
  factory GameStateAnsweredPlayer.fromJson(Map<String, Object?> json) => _$GameStateAnsweredPlayerFromJson(json);
}
