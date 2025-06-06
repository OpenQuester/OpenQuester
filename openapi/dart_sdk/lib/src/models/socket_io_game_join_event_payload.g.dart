// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'socket_io_game_join_event_payload.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SocketIOGameJoinEventPayload _$SocketIOGameJoinEventPayloadFromJson(
  Map<String, dynamic> json,
) => _SocketIOGameJoinEventPayload(
  meta: SocketIOGameJoinMeta.fromJson(json['meta'] as Map<String, dynamic>),
  players: (json['players'] as List<dynamic>)
      .map((e) => PlayerData.fromJson(e as Map<String, dynamic>))
      .toList(),
  gameState: GameState.fromJson(json['gameState'] as Map<String, dynamic>),
  chatMessages: (json['chatMessages'] as List<dynamic>)
      .map(
        (e) =>
            SocketIOChatMessageEventPayload.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
);

Map<String, dynamic> _$SocketIOGameJoinEventPayloadToJson(
  _SocketIOGameJoinEventPayload instance,
) => <String, dynamic>{
  'meta': instance.meta,
  'players': instance.players,
  'gameState': instance.gameState,
  'chatMessages': instance.chatMessages,
};
