// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_round_game_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalRoundGameData _$FinalRoundGameDataFromJson(Map<String, dynamic> json) =>
    _FinalRoundGameData(
      phase: FinalRoundPhase.fromJson(json['phase'] as String),
      turnOrder: (json['turnOrder'] as List<dynamic>)
          .map((e) => (e as num).toInt())
          .toList(),
      bids: Map<String, int>.from(json['bids'] as Map),
      answers: (json['answers'] as List<dynamic>)
          .map((e) => FinalRoundAnswer.fromJson(e as Map<String, dynamic>))
          .toList(),
      eliminatedThemes: (json['eliminatedThemes'] as List<dynamic>)
          .map((e) => (e as num).toInt())
          .toList(),
    );

Map<String, dynamic> _$FinalRoundGameDataToJson(_FinalRoundGameData instance) =>
    <String, dynamic>{
      'phase': instance.phase,
      'turnOrder': instance.turnOrder,
      'bids': instance.bids,
      'answers': instance.answers,
      'eliminatedThemes': instance.eliminatedThemes,
    };
