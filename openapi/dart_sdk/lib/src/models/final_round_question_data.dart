// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'question.dart';

part 'final_round_question_data.freezed.dart';
part 'final_round_question_data.g.dart';

/// Question data for final round
@Freezed()
abstract class FinalRoundQuestionData with _$FinalRoundQuestionData {
  const factory FinalRoundQuestionData({
    /// ID of the question theme
    required int themeId,

    /// Name of the question theme
    required String themeName,

    /// Question state data
    required Question question,
  }) = _FinalRoundQuestionData;
  
  factory FinalRoundQuestionData.fromJson(Map<String, Object?> json) => _$FinalRoundQuestionDataFromJson(json);
}
