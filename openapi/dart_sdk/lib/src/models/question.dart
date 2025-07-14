// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'question.freezed.dart';
part 'question.g.dart';

@Freezed()
abstract class Question with _$Question {
  const factory Question({
    /// Question ID
    required int id,

    /// Question order
    required int order,

    /// Question price/points
    required int? price,

    /// Question comment
    required String? questionComment,

    /// Whether question has been played
    required bool isPlayed,
  }) = _Question;
  
  factory Question.fromJson(Map<String, Object?> json) => _$QuestionFromJson(json);
}
