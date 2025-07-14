// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'socket_io_game_state_round_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SocketIOGameStateRoundData _$SocketIOGameStateRoundDataFromJson(
  Map<String, dynamic> json,
) => _SocketIOGameStateRoundData(
  order: (json['order'] as num).toInt(),
  name: json['name'] as String,
  type: PackageRoundType.fromJson(json['type'] as String),
  description: json['description'] as String?,
  themes: (json['themes'] as List<dynamic>)
      .map(
        (e) => SocketIOGameStateThemeData.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
);

Map<String, dynamic> _$SocketIOGameStateRoundDataToJson(
  _SocketIOGameStateRoundData instance,
) => <String, dynamic>{
  'order': instance.order,
  'name': instance.name,
  'type': instance.type,
  'description': instance.description,
  'themes': instance.themes,
};
