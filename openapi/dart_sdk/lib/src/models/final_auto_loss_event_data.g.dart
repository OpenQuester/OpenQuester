// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_auto_loss_event_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalAutoLossEventData _$FinalAutoLossEventDataFromJson(
  Map<String, dynamic> json,
) => _FinalAutoLossEventData(
  playerId: (json['playerId'] as num).toInt(),
  reason: FinalAnswerLossReason.fromJson(json['reason'] as String),
);

Map<String, dynamic> _$FinalAutoLossEventDataToJson(
  _FinalAutoLossEventData instance,
) => <String, dynamic>{
  'playerId': instance.playerId,
  'reason': instance.reason,
};
