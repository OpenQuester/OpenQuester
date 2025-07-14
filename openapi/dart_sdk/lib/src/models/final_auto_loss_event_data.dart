// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'final_answer_loss_reason.dart';

part 'final_auto_loss_event_data.freezed.dart';
part 'final_auto_loss_event_data.g.dart';

/// Data sent when a player automatically loses in final round
@Freezed()
abstract class FinalAutoLossEventData with _$FinalAutoLossEventData {
  const factory FinalAutoLossEventData({
    /// ID of the player who lost
    required int playerId,
    required FinalAnswerLossReason reason,
  }) = _FinalAutoLossEventData;
  
  factory FinalAutoLossEventData.fromJson(Map<String, Object?> json) => _$FinalAutoLossEventDataFromJson(json);
}
