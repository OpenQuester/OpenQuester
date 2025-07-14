// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'theme_eliminate_output.freezed.dart';
part 'theme_eliminate_output.g.dart';

/// Data sent to all players when a theme is eliminated in final round
@Freezed()
abstract class ThemeEliminateOutput with _$ThemeEliminateOutput {
  const factory ThemeEliminateOutput({
    /// ID of the eliminated theme
    required int themeId,

    /// ID of the player who eliminated the theme
    required int eliminatedBy,

    /// Next player to pick theme, null if elimination complete
    required int? nextPlayerId,
  }) = _ThemeEliminateOutput;
  
  factory ThemeEliminateOutput.fromJson(Map<String, Object?> json) => _$ThemeEliminateOutputFromJson(json);
}
