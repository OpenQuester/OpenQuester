// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_round_answer.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalRoundAnswer _$FinalRoundAnswerFromJson(Map<String, dynamic> json) =>
    _FinalRoundAnswer(
      id: json['id'] as String,
      playerId: (json['playerId'] as num).toInt(),
      answer: json['answer'] as String,
      isCorrect: json['isCorrect'] as bool?,
      autoLoss: json['autoLoss'] as bool?,
      submittedAt: DateTime.parse(json['submittedAt'] as String),
      reviewedAt: json['reviewedAt'] == null
          ? null
          : DateTime.parse(json['reviewedAt'] as String),
    );

Map<String, dynamic> _$FinalRoundAnswerToJson(_FinalRoundAnswer instance) =>
    <String, dynamic>{
      'id': instance.id,
      'playerId': instance.playerId,
      'answer': instance.answer,
      'isCorrect': instance.isCorrect,
      'autoLoss': instance.autoLoss,
      'submittedAt': instance.submittedAt.toIso8601String(),
      'reviewedAt': instance.reviewedAt?.toIso8601String(),
    };
