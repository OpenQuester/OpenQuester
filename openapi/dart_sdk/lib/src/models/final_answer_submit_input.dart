// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_answer_submit_input.freezed.dart';
part 'final_answer_submit_input.g.dart';

/// Data sent by player to submit final answer in final round
@Freezed()
abstract class FinalAnswerSubmitInput with _$FinalAnswerSubmitInput {
  const factory FinalAnswerSubmitInput({
    /// Player's final answer text
    required String answerText,
  }) = _FinalAnswerSubmitInput;
  
  factory FinalAnswerSubmitInput.fromJson(Map<String, Object?> json) => _$FinalAnswerSubmitInputFromJson(json);
}
