// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Reason for automatic loss in final round
@JsonEnum()
enum FinalAnswerLossReason {
  @JsonValue('empty_answer')
  emptyAnswer('empty_answer'),
  @JsonValue('timeout')
  timeout('timeout'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const FinalAnswerLossReason(this.json);

  factory FinalAnswerLossReason.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  String? toJson() => json;
}
