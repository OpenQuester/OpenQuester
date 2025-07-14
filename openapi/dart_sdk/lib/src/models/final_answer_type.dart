// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Type of final round answer result
@JsonEnum()
enum FinalAnswerType {
  @JsonValue('correct')
  correct('correct'),
  @JsonValue('wrong')
  wrong('wrong'),
  @JsonValue('auto_loss')
  autoLoss('auto_loss'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const FinalAnswerType(this.json);

  factory FinalAnswerType.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  String? toJson() => json;
}
