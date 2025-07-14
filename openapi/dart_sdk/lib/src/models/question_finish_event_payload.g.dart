// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question_finish_event_payload.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_QuestionFinishEventPayload _$QuestionFinishEventPayloadFromJson(
  Map<String, dynamic> json,
) => _QuestionFinishEventPayload(
  answerFiles: (json['answerFiles'] as List<dynamic>?)
      ?.map((e) => PackageQuestionFile.fromJson(e as Map<String, dynamic>))
      .toList(),
  answerText: json['answerText'] as String?,
  nextTurnPlayerId: (json['nextTurnPlayerId'] as num?)?.toInt(),
);

Map<String, dynamic> _$QuestionFinishEventPayloadToJson(
  _QuestionFinishEventPayload instance,
) => <String, dynamic>{
  'answerFiles': instance.answerFiles,
  'answerText': instance.answerText,
  'nextTurnPlayerId': instance.nextTurnPlayerId,
};
