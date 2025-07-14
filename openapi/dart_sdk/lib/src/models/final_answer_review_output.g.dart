// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_answer_review_output.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalAnswerReviewOutput _$FinalAnswerReviewOutputFromJson(
  Map<String, dynamic> json,
) => _FinalAnswerReviewOutput(
  answerId: json['answerId'] as String,
  playerId: (json['playerId'] as num).toInt(),
  isCorrect: json['isCorrect'] as bool,
  scoreChange: (json['scoreChange'] as num).toInt(),
);

Map<String, dynamic> _$FinalAnswerReviewOutputToJson(
  _FinalAnswerReviewOutput instance,
) => <String, dynamic>{
  'answerId': instance.answerId,
  'playerId': instance.playerId,
  'isCorrect': instance.isCorrect,
  'scoreChange': instance.scoreChange,
};
