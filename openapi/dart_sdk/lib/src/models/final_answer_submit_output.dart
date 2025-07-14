// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_answer_submit_output.freezed.dart';
part 'final_answer_submit_output.g.dart';

/// Data sent to all players when a final answer is submitted
@Freezed()
abstract class FinalAnswerSubmitOutput with _$FinalAnswerSubmitOutput {
  const factory FinalAnswerSubmitOutput({
    /// ID of the player who submitted the answer
    required int playerId,

    /// The submitted answer text
    required String answerText,
  }) = _FinalAnswerSubmitOutput;
  
  factory FinalAnswerSubmitOutput.fromJson(Map<String, Object?> json) => _$FinalAnswerSubmitOutputFromJson(json);
}
