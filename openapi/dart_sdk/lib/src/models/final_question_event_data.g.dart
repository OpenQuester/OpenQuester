// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_question_event_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalQuestionEventData _$FinalQuestionEventDataFromJson(
  Map<String, dynamic> json,
) => _FinalQuestionEventData(
  questionData: FinalRoundQuestionData.fromJson(
    json['questionData'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$FinalQuestionEventDataToJson(
  _FinalQuestionEventData instance,
) => <String, dynamic>{'questionData': instance.questionData};
