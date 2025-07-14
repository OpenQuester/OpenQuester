// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'final_bid_submit_output.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FinalBidSubmitOutput _$FinalBidSubmitOutputFromJson(
  Map<String, dynamic> json,
) => _FinalBidSubmitOutput(
  playerId: (json['playerId'] as num).toInt(),
  bidAmount: (json['bidAmount'] as num).toInt(),
);

Map<String, dynamic> _$FinalBidSubmitOutputToJson(
  _FinalBidSubmitOutput instance,
) => <String, dynamic>{
  'playerId': instance.playerId,
  'bidAmount': instance.bidAmount,
};
