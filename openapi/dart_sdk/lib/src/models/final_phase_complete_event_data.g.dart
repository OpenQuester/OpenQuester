// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_phase_complete_event_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalPhaseCompleteEventData _$FinalPhaseCompleteEventDataFromJson(
  Map<String, dynamic> json,
) => _FinalPhaseCompleteEventData(
  phase: FinalRoundPhase.fromJson(json['phase'] as String),
  nextPhase: FinalRoundPhase.fromJson(json['nextPhase'] as String),
  timer: GameStateTimer.fromJson(json['timer'] as Map<String, dynamic>),
);

Map<String, dynamic> _$FinalPhaseCompleteEventDataToJson(
  _FinalPhaseCompleteEventData instance,
) => <String, dynamic>{
  'phase': instance.phase,
  'nextPhase': instance.nextPhase,
  'timer': instance.timer,
};
