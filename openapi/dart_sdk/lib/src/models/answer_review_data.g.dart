// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'answer_review_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AnswerReviewData _$AnswerReviewDataFromJson(Map<String, dynamic> json) =>
    _AnswerReviewData(
      playerId: (json['playerId'] as num).toInt(),
      answerId: json['answerId'] as String,
      answerText: json['answerText'] as String,
      scoreChange: (json['scoreChange'] as num).toInt(),
      answerType: FinalAnswerType.fromJson(json['answerType'] as String),
      isCorrect: json['isCorrect'] as bool,
    );

Map<String, dynamic> _$AnswerReviewDataToJson(_AnswerReviewData instance) =>
    <String, dynamic>{
      'playerId': instance.playerId,
      'answerId': instance.answerId,
      'answerText': instance.answerText,
      'scoreChange': instance.scoreChange,
      'answerType': instance.answerType,
      'isCorrect': instance.isCorrect,
    };
