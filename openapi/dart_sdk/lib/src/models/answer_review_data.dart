// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'final_answer_type.dart';

part 'answer_review_data.freezed.dart';
part 'answer_review_data.g.dart';

/// Data for reviewing final round answers
@Freezed()
abstract class AnswerReviewData with _$AnswerReviewData {
  const factory AnswerReviewData({
    /// ID of the player
    required int playerId,

    /// Unique ID of the answer
    required String answerId,

    /// Player's answer text
    required String answerText,

    /// Score change for the player
    required int scoreChange,
    required FinalAnswerType answerType,

    /// Whether the answer is correct (optional, present after review)
    required bool isCorrect,
  }) = _AnswerReviewData;
  
  factory AnswerReviewData.fromJson(Map<String, Object?> json) => _$AnswerReviewDataFromJson(json);
}
