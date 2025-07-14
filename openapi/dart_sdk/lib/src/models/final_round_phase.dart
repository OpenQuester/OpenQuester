// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Phase of the final round
@JsonEnum()
enum FinalRoundPhase {
  @JsonValue('theme_elimination')
  themeElimination('theme_elimination'),
  @JsonValue('bidding')
  bidding('bidding'),
  @JsonValue('answering')
  answering('answering'),
  @JsonValue('reviewing')
  reviewing('reviewing'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const FinalRoundPhase(this.json);

  factory FinalRoundPhase.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  String? toJson() => json;
}
