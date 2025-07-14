// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_answer_review_input.freezed.dart';
part 'final_answer_review_input.g.dart';

/// Data sent by showman to review a final answer
@Freezed()
abstract class FinalAnswerReviewInput with _$FinalAnswerReviewInput {
  const factory FinalAnswerReviewInput({
    /// ID of the answer being reviewed
    required String answerId,

    /// Whether the answer is correct
    required bool isCorrect,
  }) = _FinalAnswerReviewInput;
  
  factory FinalAnswerReviewInput.fromJson(Map<String, Object?> json) => _$FinalAnswerReviewInputFromJson(json);
}
