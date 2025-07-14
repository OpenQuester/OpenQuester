// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'package_question_file.dart';
import 'question_answer_text.dart';

part 'question_finish_event_payload.freezed.dart';
part 'question_finish_event_payload.g.dart';

/// Data sent to all players when a question is finished (showing answer)
@Freezed()
abstract class QuestionFinishEventPayload with _$QuestionFinishEventPayload {
  const factory QuestionFinishEventPayload({
    required List<PackageQuestionFile>? answerFiles,
    required QuestionAnswerText? answerText,
  }) = _QuestionFinishEventPayload;
  
  factory QuestionFinishEventPayload.fromJson(Map<String, Object?> json) => _$QuestionFinishEventPayloadFromJson(json);
}
