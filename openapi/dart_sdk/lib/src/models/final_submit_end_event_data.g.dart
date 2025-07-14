// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_submit_end_event_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalSubmitEndEventData _$FinalSubmitEndEventDataFromJson(
  Map<String, dynamic> json,
) => _FinalSubmitEndEventData(
  phase: FinalRoundPhase.fromJson(json['phase'] as String),
  nextPhase: json['nextPhase'] == null
      ? null
      : FinalRoundPhase.fromJson(json['nextPhase'] as String),
  allReviews: (json['allReviews'] as List<dynamic>?)
      ?.map(
        (e) => e == null
            ? null
            : AnswerReviewData.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
);

Map<String, dynamic> _$FinalSubmitEndEventDataToJson(
  _FinalSubmitEndEventData instance,
) => <String, dynamic>{
  'phase': instance.phase,
  'nextPhase': instance.nextPhase,
  'allReviews': instance.allReviews,
};
