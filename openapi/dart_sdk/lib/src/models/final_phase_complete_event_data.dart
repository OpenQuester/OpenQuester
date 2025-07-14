// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'final_round_phase.dart';
import 'game_state_timer.dart';

part 'final_phase_complete_event_data.freezed.dart';
part 'final_phase_complete_event_data.g.dart';

/// Data sent when a final round phase is completed
@Freezed()
abstract class FinalPhaseCompleteEventData with _$FinalPhaseCompleteEventData {
  const factory FinalPhaseCompleteEventData({
    required FinalRoundPhase phase,
    required FinalRoundPhase nextPhase,
    required GameStateTimer timer,
  }) = _FinalPhaseCompleteEventData;
  
  factory FinalPhaseCompleteEventData.fromJson(Map<String, Object?> json) => _$FinalPhaseCompleteEventDataFromJson(json);
}
