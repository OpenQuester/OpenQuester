// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'answer_review_data.dart';
import 'final_round_phase.dart';

part 'final_submit_end_event_data.freezed.dart';
part 'final_submit_end_event_data.g.dart';

/// Data sent when final round answering phase ends
@Freezed()
abstract class FinalSubmitEndEventData with _$FinalSubmitEndEventData {
  const factory FinalSubmitEndEventData({
    required FinalRoundPhase phase,
    FinalRoundPhase? nextPhase,

    /// All answers revealed when transitioning to reviewing phase
    List<AnswerReviewData?>? allReviews,
  }) = _FinalSubmitEndEventData;
  
  factory FinalSubmitEndEventData.fromJson(Map<String, Object?> json) => _$FinalSubmitEndEventDataFromJson(json);
}
