// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'final_bid_submit_input.freezed.dart';
part 'final_bid_submit_input.g.dart';

/// Data sent by player to submit bid in final round
@Freezed()
abstract class FinalBidSubmitInput with _$FinalBidSubmitInput {
  const factory FinalBidSubmitInput({
    /// Player's bid amount
    required int bid,
  }) = _FinalBidSubmitInput;
  
  factory FinalBidSubmitInput.fromJson(Map<String, Object?> json) => _$FinalBidSubmitInputFromJson(json);
}
