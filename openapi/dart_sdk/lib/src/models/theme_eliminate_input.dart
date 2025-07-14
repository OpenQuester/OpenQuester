// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'theme_eliminate_input.freezed.dart';
part 'theme_eliminate_input.g.dart';

/// Data sent to eliminate a theme in final round
@Freezed()
abstract class ThemeEliminateInput with _$ThemeEliminateInput {
  const factory ThemeEliminateInput({
    /// ID of the theme to eliminate
    required int themeId,
  }) = _ThemeEliminateInput;
  
  factory ThemeEliminateInput.fromJson(Map<String, Object?> json) => _$ThemeEliminateInputFromJson(json);
}
