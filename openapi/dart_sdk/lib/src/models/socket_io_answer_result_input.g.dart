// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'socket_io_answer_result_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SocketIOAnswerResultInput _$SocketIOAnswerResultInputFromJson(
  Map<String, dynamic> json,
) => _SocketIOAnswerResultInput(
  scoreResult: (json['scoreResult'] as num).toInt(),
  answerType: SocketIOGameAnswerType.fromJson(json['answerType'] as String),
);

Map<String, dynamic> _$SocketIOAnswerResultInputToJson(
  _SocketIOAnswerResultInput instance,
) => <String, dynamic>{
  'scoreResult': instance.scoreResult,
  'answerType': instance.answerType,
};
