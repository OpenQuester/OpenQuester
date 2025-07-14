// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_round_question_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalRoundQuestionData _$FinalRoundQuestionDataFromJson(
  Map<String, dynamic> json,
) => _FinalRoundQuestionData(
  themeId: (json['themeId'] as num).toInt(),
  themeName: json['themeName'] as String,
  question: Question.fromJson(json['question'] as Map<String, dynamic>),
);

Map<String, dynamic> _$FinalRoundQuestionDataToJson(
  _FinalRoundQuestionData instance,
) => <String, dynamic>{
  'themeId': instance.themeId,
  'themeName': instance.themeName,
  'question': instance.question,
};
