// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'socket_io_game_answer_type.dart';

part 'socket_io_answer_result_input.freezed.dart';
part 'socket_io_answer_result_input.g.dart';

/// Data sent by the showman to evaluate a player's answer
@Freezed()
abstract class SocketIOAnswerResultInput with _$SocketIOAnswerResultInput {
  const factory SocketIOAnswerResultInput({
    /// Score result of the answer; positive for correct, negative for incorrect, zero for skip
    required int scoreResult,
    required SocketIOGameAnswerType answerType,
  }) = _SocketIOAnswerResultInput;
  
  factory SocketIOAnswerResultInput.fromJson(Map<String, Object?> json) => _$SocketIOAnswerResultInputFromJson(json);
}
