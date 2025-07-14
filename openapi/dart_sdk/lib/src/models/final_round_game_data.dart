// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'final_round_answer.dart';
import 'final_round_phase.dart';

part 'final_round_game_data.freezed.dart';
part 'final_round_game_data.g.dart';

/// Final round game state data
@Freezed()
abstract class FinalRoundGameData with _$FinalRoundGameData {
  const factory FinalRoundGameData({
    required FinalRoundPhase phase,

    /// Turn order for final round theme elimination
    required List<int> turnOrder,

    /// Player bids mapped by player ID
    required Map<String, int> bids,

    /// All submitted answers
    required List<FinalRoundAnswer> answers,

    /// IDs of eliminated themes
    required List<int> eliminatedThemes,
  }) = _FinalRoundGameData;
  
  factory FinalRoundGameData.fromJson(Map<String, Object?> json) => _$FinalRoundGameDataFromJson(json);
}
