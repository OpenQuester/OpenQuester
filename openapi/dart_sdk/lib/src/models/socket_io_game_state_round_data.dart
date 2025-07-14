// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'package_entities_order.dart';
import 'package_round_type.dart';
import 'socket_io_game_state_theme_data.dart';

part 'socket_io_game_state_round_data.freezed.dart';
part 'socket_io_game_state_round_data.g.dart';

/// Info about current round of the game
@Freezed()
abstract class SocketIOGameStateRoundData with _$SocketIOGameStateRoundData {
  const factory SocketIOGameStateRoundData({
    required PackageEntitiesOrder order,
    required String name,
    required PackageRoundType type,
    required String? description,
    required List<SocketIOGameStateThemeData> themes,
  }) = _SocketIOGameStateRoundData;
  
  factory SocketIOGameStateRoundData.fromJson(Map<String, Object?> json) => _$SocketIOGameStateRoundDataFromJson(json);
}
