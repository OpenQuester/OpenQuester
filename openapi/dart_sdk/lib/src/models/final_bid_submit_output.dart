// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_bid_submit_output.freezed.dart';
part 'final_bid_submit_output.g.dart';

/// Data sent to all players when a bid is submitted
@Freezed()
abstract class FinalBidSubmitOutput with _$FinalBidSubmitOutput {
  const factory FinalBidSubmitOutput({
    /// ID of the player who submitted the bid
    required int playerId,

    /// The bid amount
    required int bidAmount,
  }) = _FinalBidSubmitOutput;
  
  factory FinalBidSubmitOutput.fromJson(Map<String, Object?> json) => _$FinalBidSubmitOutputFromJson(json);
}
