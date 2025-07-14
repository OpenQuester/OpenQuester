// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'final_round_question_data.dart';

part 'final_question_event_data.freezed.dart';
part 'final_question_event_data.g.dart';

/// Data sent when final round question is revealed
@Freezed()
abstract class FinalQuestionEventData with _$FinalQuestionEventData {
  const factory FinalQuestionEventData({
    required FinalRoundQuestionData questionData,
  }) = _FinalQuestionEventData;
  
  factory FinalQuestionEventData.fromJson(Map<String, Object?> json) => _$FinalQuestionEventDataFromJson(json);
}
