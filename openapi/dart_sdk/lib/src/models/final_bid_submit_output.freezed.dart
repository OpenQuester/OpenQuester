// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_bid_submit_output.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalBidSubmitOutput {

/// ID of the player who submitted the bid
 int get playerId;/// The bid amount
 int get bidAmount;
/// Create a copy of FinalBidSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalBidSubmitOutputCopyWith<FinalBidSubmitOutput> get copyWith => _$FinalBidSubmitOutputCopyWithImpl<FinalBidSubmitOutput>(this as FinalBidSubmitOutput, _$identity);

  /// Serializes this FinalBidSubmitOutput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalBidSubmitOutput&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.bidAmount, bidAmount) || other.bidAmount == bidAmount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,bidAmount);

@override
String toString() {
  return 'FinalBidSubmitOutput(playerId: $playerId, bidAmount: $bidAmount)';
}


}

/// @nodoc
abstract mixin class $FinalBidSubmitOutputCopyWith<$Res>  {
  factory $FinalBidSubmitOutputCopyWith(FinalBidSubmitOutput value, $Res Function(FinalBidSubmitOutput) _then) = _$FinalBidSubmitOutputCopyWithImpl;
@useResult
$Res call({
 int playerId, int bidAmount
});




}
/// @nodoc
class _$FinalBidSubmitOutputCopyWithImpl<$Res>
    implements $FinalBidSubmitOutputCopyWith<$Res> {
  _$FinalBidSubmitOutputCopyWithImpl(this._self, this._then);

  final FinalBidSubmitOutput _self;
  final $Res Function(FinalBidSubmitOutput) _then;

/// Create a copy of FinalBidSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? playerId = null,Object? bidAmount = null,}) {
  return _then(_self.copyWith(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,bidAmount: null == bidAmount ? _self.bidAmount : bidAmount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _FinalBidSubmitOutput implements FinalBidSubmitOutput {
  const _FinalBidSubmitOutput({required this.playerId, required this.bidAmount});
  factory _FinalBidSubmitOutput.fromJson(Map<String, dynamic> json) => _$FinalBidSubmitOutputFromJson(json);

/// ID of the player who submitted the bid
@override final  int playerId;
/// The bid amount
@override final  int bidAmount;

/// Create a copy of FinalBidSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalBidSubmitOutputCopyWith<_FinalBidSubmitOutput> get copyWith => __$FinalBidSubmitOutputCopyWithImpl<_FinalBidSubmitOutput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalBidSubmitOutputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalBidSubmitOutput&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.bidAmount, bidAmount) || other.bidAmount == bidAmount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,bidAmount);

@override
String toString() {
  return 'FinalBidSubmitOutput(playerId: $playerId, bidAmount: $bidAmount)';
}


}

/// @nodoc
abstract mixin class _$FinalBidSubmitOutputCopyWith<$Res> implements $FinalBidSubmitOutputCopyWith<$Res> {
  factory _$FinalBidSubmitOutputCopyWith(_FinalBidSubmitOutput value, $Res Function(_FinalBidSubmitOutput) _then) = __$FinalBidSubmitOutputCopyWithImpl;
@override @useResult
$Res call({
 int playerId, int bidAmount
});




}
/// @nodoc
class __$FinalBidSubmitOutputCopyWithImpl<$Res>
    implements _$FinalBidSubmitOutputCopyWith<$Res> {
  __$FinalBidSubmitOutputCopyWithImpl(this._self, this._then);

  final _FinalBidSubmitOutput _self;
  final $Res Function(_FinalBidSubmitOutput) _then;

/// Create a copy of FinalBidSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? playerId = null,Object? bidAmount = null,}) {
  return _then(_FinalBidSubmitOutput(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,bidAmount: null == bidAmount ? _self.bidAmount : bidAmount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
