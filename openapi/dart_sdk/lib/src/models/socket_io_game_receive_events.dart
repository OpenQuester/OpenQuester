// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

@JsonEnum()
enum SocketIOGameReceiveEvents {
  @JsonValue('join')
  join('join'),
  @JsonValue('start')
  start('start'),
  @JsonValue('user-leave')
  userLeave('user-leave'),
  @JsonValue('game-data')
  gameData('game-data'),
  @JsonValue('question-answer')
  questionAnswer('question-answer'),
  @JsonValue('question-data')
  questionData('question-data'),
  @JsonValue('question-finish')
  questionFinish('question-finish'),
  @JsonValue('answer-submitted')
  answerSubmitted('answer-submitted'),
  @JsonValue('answer-result')
  answerResult('answer-result'),
  @JsonValue('next-round')
  nextRound('next-round'),
  @JsonValue('game-finished')
  gameFinished('game-finished'),
  @JsonValue('game-pause')
  gamePause('game-pause'),
  @JsonValue('game-unpause')
  gameUnpause('game-unpause'),
  @JsonValue('theme-eliminate')
  themeEliminate('theme-eliminate'),
  @JsonValue('question-skip')
  questionSkip('question-skip'),
  @JsonValue('question-unskip')
  questionUnskip('question-unskip'),
  @JsonValue('final-bid-submit')
  finalBidSubmit('final-bid-submit'),
  @JsonValue('final-answer-submit')
  finalAnswerSubmit('final-answer-submit'),
  @JsonValue('final-answer-review')
  finalAnswerReview('final-answer-review'),
  @JsonValue('final-phase-complete')
  finalPhaseComplete('final-phase-complete'),
  @JsonValue('final-question-data')
  finalQuestionData('final-question-data'),
  @JsonValue('final-submit-end')
  finalSubmitEnd('final-submit-end'),
  @JsonValue('final-auto-loss')
  finalAutoLoss('final-auto-loss'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const SocketIOGameReceiveEvents(this.json);

  factory SocketIOGameReceiveEvents.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  String? toJson() => json;
}
