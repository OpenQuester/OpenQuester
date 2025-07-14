// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_answer_review_output.freezed.dart';
part 'final_answer_review_output.g.dart';

/// Data sent to all players when an answer is reviewed
@Freezed()
abstract class FinalAnswerReviewOutput with _$FinalAnswerReviewOutput {
  const factory FinalAnswerReviewOutput({
    /// ID of the reviewed answer
    required String answerId,

    /// ID of the player whose answer was reviewed
    required int playerId,

    /// Whether the answer was correct
    required bool isCorrect,

    /// Score change for the player
    required int scoreChange,
  }) = _FinalAnswerReviewOutput;
  
  factory FinalAnswerReviewOutput.fromJson(Map<String, Object?> json) => _$FinalAnswerReviewOutputFromJson(json);
}
