// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_answer_submit_output.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalAnswerSubmitOutput _$FinalAnswerSubmitOutputFromJson(
  Map<String, dynamic> json,
) => _FinalAnswerSubmitOutput(
  playerId: (json['playerId'] as num).toInt(),
  answerText: json['answerText'] as String,
);

Map<String, dynamic> _$FinalAnswerSubmitOutputToJson(
  _FinalAnswerSubmitOutput instance,
) => <String, dynamic>{
  'playerId': instance.playerId,
  'answerText': instance.answerText,
};
