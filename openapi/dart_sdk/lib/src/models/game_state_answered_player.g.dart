// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_state_answered_player.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_GameStateAnsweredPlayer _$GameStateAnsweredPlayerFromJson(
  Map<String, dynamic> json,
) => _GameStateAnsweredPlayer(
  player: (json['player'] as num).toInt(),
  result: (json['result'] as num).toInt(),
  score: (json['score'] as num).toInt(),
  answerType: SocketIOGameAnswerType.fromJson(json['answerType'] as String),
);

Map<String, dynamic> _$GameStateAnsweredPlayerToJson(
  _GameStateAnsweredPlayer instance,
) => <String, dynamic>{
  'player': instance.player,
  'result': instance.result,
  'score': instance.score,
  'answerType': instance.answerType,
};
