// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_round_answer.freezed.dart';
part 'final_round_answer.g.dart';

/// Player answer in final round
@Freezed()
abstract class FinalRoundAnswer with _$FinalRoundAnswer {
  const factory FinalRoundAnswer({
    /// Unique ID of the answer
    required String id,

    /// ID of the player submitting the answer
    required int playerId,

    /// The player's answer text
    required String answer,

    /// Whether the answer is correct (null if not yet reviewed)
    required bool? isCorrect,

    /// Whether this is an automatic loss
    required bool? autoLoss,

    /// When the answer was submitted
    required DateTime submittedAt,

    /// When the answer was reviewed
    required DateTime? reviewedAt,
  }) = _FinalRoundAnswer;
  
  factory FinalRoundAnswer.fromJson(Map<String, Object?> json) => _$FinalRoundAnswerFromJson(json);
}
