// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'restrictions_event_data.freezed.dart';
part 'restrictions_event_data.g.dart';

@Freezed()
abstract class RestrictionsEventData with _$RestrictionsEventData {
  const factory RestrictionsEventData({
    /// If true - player muted in in-game chat
    required bool muted,

    /// Restricted players can only join as spectators
    required bool restricted,

    /// If true - player is banned from the game
    required bool banned,
  }) = _RestrictionsEventData;
  
  factory RestrictionsEventData.fromJson(Map<String, Object?> json) => _$RestrictionsEventDataFromJson(json);
}
