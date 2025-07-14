// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_GameState _$GameStateFromJson(Map<String, dynamic> json) => _GameState(
  questionState: json['questionState'] == null
      ? null
      : GameStateQuestionState.fromJson(json['questionState'] as String?),
  isPaused: json['isPaused'] as bool,
  answeringPlayer: (json['answeringPlayer'] as num?)?.toInt(),
  answeredPlayers: (json['answeredPlayers'] as List<dynamic>?)
      ?.map((e) => GameStateAnsweredPlayer.fromJson(e as Map<String, dynamic>))
      .toList(),
  currentRound: json['currentRound'] == null
      ? null
      : SocketIOGameStateRoundData.fromJson(
          json['currentRound'] as Map<String, dynamic>,
        ),
  currentQuestion: json['currentQuestion'] == null
      ? null
      : PackageQuestionData.fromJson(
          json['currentQuestion'] as Map<String, dynamic>,
        ),
  timer: json['timer'] == null
      ? null
      : GameStateTimer.fromJson(json['timer'] as Map<String, dynamic>),
  finalRoundData: json['finalRoundData'] == null
      ? null
      : FinalRoundGameData.fromJson(
          json['finalRoundData'] as Map<String, dynamic>,
        ),
  currentTurnPlayerId: (json['currentTurnPlayerId'] as num?)?.toInt(),
);

Map<String, dynamic> _$GameStateToJson(_GameState instance) =>
    <String, dynamic>{
      'questionState': instance.questionState,
      'isPaused': instance.isPaused,
      'answeringPlayer': instance.answeringPlayer,
      'answeredPlayers': instance.answeredPlayers,
      'currentRound': instance.currentRound,
      'currentQuestion': instance.currentQuestion,
      'timer': instance.timer,
      'finalRoundData': instance.finalRoundData,
      'currentTurnPlayerId': instance.currentTurnPlayerId,
    };
